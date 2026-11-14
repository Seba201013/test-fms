import { db } from 'hatchable';
export const access='user'; export const methods=['GET','POST','PUT'];
function clean(v,n=1500){return String(v??'').trim().slice(0,n)}
function ref(){return 'CAD-'+new Date().getUTCFullYear()+'-'+String(Date.now()).slice(-7)}
export default async function(req,res){
 const actor=req.user;
 if(req.method==='GET'){const {rows}=await db.query("SELECT * FROM public_reports ORDER BY CASE status WHEN 'received' THEN 0 WHEN 'reviewing' THEN 1 WHEN 'converted' THEN 2 ELSE 3 END, created_at DESC LIMIT 200");return res.json({reports:rows});}
 const b=req.body||{};
 if(req.method==='POST'&&b.action==='convert'){
   const id=Number(b.id); if(!id)return res.status(400).json({error:'report id required'});
   const {rows:r}=await db.query('SELECT * FROM public_reports WHERE id=$1',[id]);const report=r[0];if(!report)return res.status(404).json({error:'report not found'});
   const no=ref(),priority=clean(b.priority,10)||'P3',category=clean(b.category,100)||report.report_type||'Online report',summary=clean(b.summary,1500)||report.details;
   const {rows:i}=await db.query("INSERT INTO incidents (incident_no,source,priority,category,status,caller_name,caller_phone,location_text,summary,created_by) VALUES ($1,'Online',$2,$3,'open',$4,$5,$6,$7,$8) RETURNING *",[no,priority,category,report.reporter_name,report.contact_phone,report.location_text||'Online report',summary,actor.id]);
   await db.query("INSERT INTO incident_logs (incident_id,entry_type,body,actor_id,actor_name) VALUES ($1,'created',$2,$3,$4)",[i[0].id,'Created from public report '+report.report_no,actor.id,actor.name||actor.email]);
   await db.query("UPDATE public_reports SET status='converted' WHERE id=$1",[id]);
   return res.status(201).json({incident:i[0],report_no:report.report_no});
 }
 if(req.method==='PUT'){
   const id=Number(b.id),status=clean(b.status,30);if(!id||!status)return res.status(400).json({error:'id and status required'});
   const allowed=['received','reviewing','converted','closed','no_further_action'];if(!allowed.includes(status))return res.status(400).json({error:'invalid status'});
   const {rows}=await db.query('UPDATE public_reports SET status=$2 WHERE id=$1 RETURNING *',[id,status]);return res.json({report:rows[0]});
 }
 return res.status(400).json({error:'unsupported action'});
}