import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET','POST','PUT'];
function n(prefix){return prefix+'-'+new Date().getUTCFullYear()+'-'+String(Date.now()).slice(-7)}
export default async function(req,res){
  const actor=req.user;
  if(req.method==='GET'){
    const {rows}=await db.query("SELECT * FROM incidents ORDER BY created_at DESC LIMIT 100"); return res.json({incidents:rows});
  }
  if(req.method==='POST'){
    const b=req.body||{}; if(!b.category||!b.location_text||!b.summary) return res.status(400).json({error:'category, location_text and summary are required'});
    const no=n('CAD');
    const {rows}=await db.query("INSERT INTO incidents (incident_no,source,priority,category,subtype,status,caller_name,caller_phone,location_text,eircode,summary,risk_flags,assigned_units,created_by) VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13) RETURNING *",[no,b.source||'999',b.priority||'P3',b.category,b.subtype||null,b.caller_name||null,b.caller_phone||null,b.location_text,b.eircode||null,b.summary,JSON.stringify(b.risk_flags||[]),JSON.stringify(b.assigned_units||[]),actor.id]);
    await db.query("INSERT INTO incident_logs (incident_id,entry_type,body,actor_id,actor_name) VALUES ($1,'created',$2,$3,$4)",[rows[0].id,'Incident created',actor.id,actor.name||actor.email]);
    await db.query("INSERT INTO audit_log (actor_id,actor_name,action,entity_type,entity_id,detail) VALUES ($1,$2,'create','incident',$3,$4::jsonb)",[actor.id,actor.name||actor.email,String(rows[0].id),JSON.stringify({incident_no:no})]);
    return res.status(201).json({incident:rows[0]});
  }
  const b=req.body||{}; if(!b.id) return res.status(400).json({error:'id required'});
  const {rows}=await db.query("UPDATE incidents SET priority=COALESCE($2,priority), status=COALESCE($3,status), assigned_units=COALESCE($4::jsonb,assigned_units), summary=COALESCE($5,summary), location_text=COALESCE($6,location_text), dispatched_at=CASE WHEN $3='dispatched' AND dispatched_at IS NULL THEN now() ELSE dispatched_at END, arrived_at=CASE WHEN $3='on_scene' AND arrived_at IS NULL THEN now() ELSE arrived_at END, closed_at=CASE WHEN $3='closed' AND closed_at IS NULL THEN now() ELSE closed_at END, updated_at=now() WHERE id=$1 RETURNING *",[b.id,b.priority||null,b.status||null,b.assigned_units?JSON.stringify(b.assigned_units):null,b.summary||null,b.location_text||null]);
  if(!rows[0]) return res.status(404).json({error:'not found'});
  if(b.log) await db.query("INSERT INTO incident_logs (incident_id,entry_type,body,actor_id,actor_name) VALUES ($1,$2,$3,$4,$5)",[b.id,b.log_type||'update',b.log,actor.id,actor.name||actor.email]);
  return res.json({incident:rows[0]});
}