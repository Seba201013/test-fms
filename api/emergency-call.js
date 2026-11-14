import { db, events } from 'hatchable';
export const access='public';
export const methods=['GET','POST'];
function clean(v,n=500){return String(v||'').trim().slice(0,n)}
export default async function(req,res){
  if(req.method==='POST'){
    const action=clean(req.body?.action,30);
    if(action==='start'){
      const service=clean(req.body?.service,40)||'Garda';
      const location=clean(req.body?.location_text,240);
      if(!location)return res.status(400).json({error:'Exact in-game location is required.'});
      const token=crypto.randomUUID()+crypto.randomUUID();
      const ref='999-'+new Date().getUTCFullYear()+'-'+Math.floor(100000+Math.random()*900000);
      const {rows}=await db.query('INSERT INTO emergency_calls (call_ref,access_token,service,caller_name,caller_contact,location_text) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,call_ref,status,service,location_text,created_at',[ref,token,service,clean(req.body?.caller_name,120),clean(req.body?.caller_contact,120),location]);
      const call=rows[0];
      await db.query('INSERT INTO emergency_call_messages (call_id,sender_type,sender_name,body) VALUES ($1,$2,$3,$4)',[call.id,'system','Control System','Roleplay emergency call connected. An operator will respond here.']);
      await events.publish('emergency-queue','new_call',{call_id:call.id,call_ref:call.call_ref,service:call.service,location_text:call.location_text});
      return res.status(201).json({call,access_token:token});
    }
    if(action==='message'){
      const token=clean(req.body?.access_token,200), callId=Number(req.body?.call_id), body=clean(req.body?.body,1000);
      if(!callId||!token||!body)return res.status(400).json({error:'Missing call details or message.'});
      const {rows:c}=await db.query('SELECT id,call_ref,status FROM emergency_calls WHERE id=$1 AND access_token=$2',[callId,token]);
      if(!c[0])return res.status(404).json({error:'Call session not found.'});
      if(c[0].status==='closed')return res.status(409).json({error:'This call has been closed.'});
      const {rows:m}=await db.query('INSERT INTO emergency_call_messages (call_id,sender_type,sender_name,body) VALUES ($1,$2,$3,$4) RETURNING id,sender_type,sender_name,body,created_at',[callId,'caller','Caller',body]);
      await db.query('UPDATE emergency_calls SET updated_at=now() WHERE id=$1',[callId]);
      const {rows:link}=await db.query('SELECT incident_id FROM emergency_calls WHERE id=$1',[callId]);
      if(link[0]?.incident_id)await db.query("INSERT INTO incident_logs (incident_id,entry_type,body,actor_name,created_at) VALUES ($1,'999_transcript',$2,'Caller',$3)",[link[0].incident_id,'CALLER: '+body,m[0].created_at]);
      await events.publish('emergency-call-'+callId,'message',m[0]);
      await events.publish('emergency-queue','message',{call_id:callId});
      return res.status(201).json({message:m[0]});
    }
    return res.status(400).json({error:'Unknown action.'});
  }
  const callId=Number(req.query?.call_id), token=clean(req.query?.access_token,200);
  if(!callId||!token)return res.status(400).json({error:'Call id and access token required.'});
  const {rows:c}=await db.query('SELECT ec.id,ec.call_ref,ec.status,ec.service,ec.location_text,ec.operator_name,ec.created_at,ec.answered_at,ec.closed_at,ec.incident_id,i.incident_no,i.priority AS incident_priority FROM emergency_calls ec LEFT JOIN incidents i ON i.id=ec.incident_id WHERE ec.id=$1 AND ec.access_token=$2',[callId,token]);
  if(!c[0])return res.status(404).json({error:'Call session not found.'});
  const {rows:messages}=await db.query('SELECT id,sender_type,sender_name,body,created_at FROM emergency_call_messages WHERE call_id=$1 ORDER BY id',[callId]);
  res.json({call:c[0],messages});
}