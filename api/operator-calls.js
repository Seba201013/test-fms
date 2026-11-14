import { db, events } from 'hatchable';
export const access='user';
export const methods=['GET','POST'];
function clean(v,n=1000){return String(v||'').trim().slice(0,n)}
function incidentNo(){return 'CAD-'+new Date().getUTCFullYear()+'-'+String(Date.now()).slice(-7)}
export default async function(req,res){
 const user=req.user;
 if(req.method==='POST'){
  const b=req.body||{},action=clean(b.action,40),callId=Number(b.call_id);if(!callId)return res.status(400).json({error:'Call id required.'});
  const {rows:calls}=await db.query('SELECT * FROM emergency_calls WHERE id=$1',[callId]);const call=calls[0];if(!call)return res.status(404).json({error:'Call not found.'});
  if(action==='answer'){
   const name=clean(b.operator_name,120)||user.name||user.email;const {rows}=await db.query("UPDATE emergency_calls SET status='connected',operator_user_id=$2,operator_name=$3,answered_at=COALESCE(answered_at,now()),updated_at=now() WHERE id=$1 AND status<>'closed' RETURNING *",[callId,user.id,name]);
   if(!rows[0])return res.status(404).json({error:'Call unavailable.'});const {rows:m}=await db.query('INSERT INTO emergency_call_messages (call_id,sender_type,sender_name,body) VALUES ($1,$2,$3,$4) RETURNING id,sender_type,sender_name,body,created_at',[callId,'operator',name,'Emergency operator connected. Tell me exactly what is happening now.']);
   await events.publish('emergency-call-'+callId,'message',m[0]).catch(()=>{});return res.json({call:rows[0],message:m[0]});
  }
  if(action==='message'){
   const body=clean(b.body);if(!body)return res.status(400).json({error:'Message required.'});if(call.status==='closed')return res.status(409).json({error:'Call is closed.'});const name=call.operator_name||user.name||user.email;
   const {rows:m}=await db.query('INSERT INTO emergency_call_messages (call_id,sender_type,sender_name,body) VALUES ($1,$2,$3,$4) RETURNING id,sender_type,sender_name,body,created_at',[callId,'operator',name,body]);await db.query('UPDATE emergency_calls SET updated_at=now() WHERE id=$1',[callId]);if(call.incident_id)await db.query("INSERT INTO incident_logs (incident_id,entry_type,body,actor_id,actor_name,created_at) VALUES ($1,'999_transcript',$2,$3,$4,$5)",[call.incident_id,'OPERATOR: '+body,user.id,name,m[0].created_at]);await events.publish('emergency-call-'+callId,'message',m[0]).catch(()=>{});return res.status(201).json({message:m[0]});
  }
  if(action==='create_incident'){
   if(call.incident_id)return res.status(409).json({error:'This call is already linked to an incident.'});
   const no=incidentNo(),priority=clean(b.priority,4)||'P1',category=clean(b.category,120)||'Emergency call',summary=clean(b.summary,2000)||('Live '+call.service+' 999 call from '+(call.caller_name||'caller'));
   const tx=await db.transaction([
    {sql:"INSERT INTO incidents (incident_no,source,priority,category,subtype,status,caller_name,caller_phone,location_text,summary,risk_flags,assigned_units,created_by) VALUES ($1,'999',$2,$3,$4,'open',$5,$6,$7,$8,$9::jsonb,'[]'::jsonb,$10) RETURNING *",params:[no,priority,category,clean(b.subtype,120)||null,call.caller_name,call.caller_contact,clean(b.location_text,300)||call.location_text,summary,JSON.stringify(b.risk_flags||[]),user.id]},
    {sql:"UPDATE emergency_calls SET incident_id=(SELECT id FROM incidents WHERE incident_no=$1),updated_at=now() WHERE id=$2 RETURNING incident_id",params:[no,callId]}
   ]);
   const incident=tx.results[0].rows[0];await db.query("INSERT INTO incident_logs (incident_id,entry_type,body,actor_id,actor_name) VALUES ($1,'call_link',$2,$3,$4)",[incident.id,'Incident created from live emergency call '+call.call_ref,user.id,user.name||user.email]);
   const {rows:history}=await db.query("SELECT sender_type,sender_name,body,created_at FROM emergency_call_messages WHERE call_id=$1 AND sender_type IN ('caller','operator') ORDER BY id",[callId]);
   for(const msg of history){await db.query("INSERT INTO incident_logs (incident_id,entry_type,body,actor_id,actor_name,created_at) VALUES ($1,'999_transcript',$2,$3,$4,$5)",[incident.id,(msg.sender_type==='caller'?'CALLER: ':'OPERATOR: ')+msg.body,user.id,msg.sender_name||msg.sender_type,msg.created_at]);}
   const {rows:m}=await db.query('INSERT INTO emergency_call_messages (call_id,sender_type,sender_name,body) VALUES ($1,$2,$3,$4) RETURNING id,sender_type,sender_name,body,created_at',[callId,'system','CAD','CAD event '+no+' created and linked to this call.']);await events.publish('emergency-call-'+callId,'message',m[0]).catch(()=>{});return res.status(201).json({incident,message:m[0]});
  }
  if(action==='update_linked_incident'){
   if(!call.incident_id)return res.status(409).json({error:'No linked incident.'});const priority=clean(b.priority,4)||null,status=clean(b.status,30)||null,summary=clean(b.summary,2000)||null,location=clean(b.location_text,300)||null;
   const {rows}=await db.query("UPDATE incidents SET priority=COALESCE($2,priority),status=COALESCE($3,status),summary=COALESCE($4,summary),location_text=COALESCE($5,location_text),updated_at=now() WHERE id=$1 RETURNING *",[call.incident_id,priority,status,summary,location]);
   if(b.log)await db.query("INSERT INTO incident_logs (incident_id,entry_type,body,actor_id,actor_name) VALUES ($1,'call_update',$2,$3,$4)",[call.incident_id,clean(b.log,2000),user.id,user.name||user.email]);return res.json({incident:rows[0]});
  }
  if(action==='close'){
   const {rows}=await db.query("UPDATE emergency_calls SET status='closed',closed_at=now(),updated_at=now() WHERE id=$1 RETURNING *",[callId]);await events.publish('emergency-call-'+callId,'status',{status:'closed'}).catch(()=>{});return res.json({call:rows[0]||null});
  }
  return res.status(400).json({error:'Unknown action.'});
 }
 const callId=Number(req.query?.call_id);
 if(callId){const {rows:c}=await db.query('SELECT * FROM emergency_calls WHERE id=$1',[callId]);if(!c[0])return res.status(404).json({error:'Call not found.'});const {rows:messages}=await db.query('SELECT id,sender_type,sender_name,body,created_at FROM emergency_call_messages WHERE call_id=$1 ORDER BY id',[callId]);let incident=null,logs=[];if(c[0].incident_id){const ir=await db.query('SELECT * FROM incidents WHERE id=$1',[c[0].incident_id]);incident=ir.rows[0]||null;if(incident){const lr=await db.query('SELECT * FROM incident_logs WHERE incident_id=$1 ORDER BY created_at DESC LIMIT 60',[incident.id]);logs=lr.rows;}}return res.json({call:c[0],messages,incident,logs});}
 const {rows:calls}=await db.query("SELECT id,call_ref,status,service,caller_name,location_text,priority,operator_name,incident_id,created_at,updated_at FROM emergency_calls WHERE status<>'closed' ORDER BY CASE status WHEN 'waiting' THEN 0 ELSE 1 END, created_at ASC LIMIT 100");res.json({calls});
}