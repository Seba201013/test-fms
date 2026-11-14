import { db } from 'hatchable';
export const access='user';
export const methods=['GET','POST'];
const clean=(v,n=1000)=>String(v??'').trim().slice(0,n);
export default async function(req,res){
 if(req.method==='GET'){
  const {rows:incidents}=await db.query("SELECT id,incident_no,priority,category,subtype,status,region,division,location_text,assigned_units,created_at,dispatched_at,arrived_at,closed_at,quality_status,target_minutes FROM incidents WHERE status<>'closed' ORDER BY CASE priority WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,created_at");
  const {rows:units}=await db.query("SELECT id,unit_code,name,unit_type,division,status,crew,location_text,capabilities FROM units WHERE active=true ORDER BY division,unit_code");
  const {rows:calls}=await db.query("SELECT status,count(*)::int AS count FROM emergency_calls WHERE created_at>now()-interval '24 hours' GROUP BY status");
  const now=Date.now();const queue=incidents.map(x=>{const age=Math.floor((now-new Date(x.created_at).getTime())/60000);const response=x.arrived_at?Math.floor((new Date(x.arrived_at)-new Date(x.created_at))/60000):null;return {...x,age_minutes:age,response_minutes:response,target_breached:!x.arrived_at&&x.target_minutes&&age>x.target_minutes}});
  return res.json({queue,units,call_volume:calls});
 }
 const b=req.body||{},id=Number(b.incident_id),action=clean(b.action,40);if(!id)return res.status(400).json({error:'incident_id required'});
 if(action==='ownership'){const {rows}=await db.query('UPDATE incidents SET region=COALESCE($2,region),division=COALESCE($3,division),call_taker=COALESCE($4,call_taker),dispatcher=COALESCE($5,dispatcher),updated_at=now() WHERE id=$1 RETURNING *',[id,clean(b.region,80)||null,clean(b.division,80)||null,clean(b.call_taker,120)||null,clean(b.dispatcher,120)||null]);return res.json({incident:rows[0]});}
 if(action==='quality'){const status=clean(b.quality_status,30);if(!['unreviewed','reviewed','action_required','compliant'].includes(status))return res.status(400).json({error:'invalid quality status'});const {rows}=await db.query('UPDATE incidents SET quality_status=$2,quality_notes=$3,updated_at=now() WHERE id=$1 RETURNING *',[id,status,clean(b.quality_notes,2000)]);await db.query("INSERT INTO incident_logs(incident_id,entry_type,body,actor_id,actor_name) VALUES($1,'quality',$2,$3,$4)",[id,'Quality review: '+status+(b.quality_notes?' — '+clean(b.quality_notes,1000):''),req.user.id,req.user.name||req.user.email]);return res.json({incident:rows[0]});}
 if(action==='risk'){const {rows}=await db.query('UPDATE incidents SET vulnerability_flags=$2::jsonb,intelligence_flags=$3::jsonb,target_minutes=$4,updated_at=now() WHERE id=$1 RETURNING *',[id,JSON.stringify(b.vulnerability_flags||[]),JSON.stringify(b.intelligence_flags||[]),Number(b.target_minutes)||null]);return res.json({incident:rows[0]});}
 return res.status(400).json({error:'unknown action'});
}