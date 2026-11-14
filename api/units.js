import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET','POST','PUT'];
export default async function(req,res){
 const actor=req.user; if(req.method==='GET'){const {rows}=await db.query("SELECT * FROM units ORDER BY unit_code");return res.json({units:rows});}
 const b=req.body||{};
 if(req.method==='POST'){if(!b.unit_code||!b.name)return res.status(400).json({error:'unit_code and name required'});const {rows}=await db.query("INSERT INTO units (unit_code,name,unit_type,division,radio_channel,status,crew,location_text,notes) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) RETURNING *",[b.unit_code,b.name,b.unit_type||'patrol',b.division||'National',b.radio_channel||null,b.status||'available',JSON.stringify(b.crew||[]),b.location_text||null,b.notes||null]);return res.status(201).json({unit:rows[0]});}
 if(!b.id)return res.status(400).json({error:'id required'});const {rows}=await db.query("UPDATE units SET status=COALESCE($2,status), crew=COALESCE($3::jsonb,crew), location_text=COALESCE($4,location_text), radio_channel=COALESCE($5,radio_channel), notes=COALESCE($6,notes), updated_at=now() WHERE id=$1 RETURNING *",[b.id,b.status||null,b.crew?JSON.stringify(b.crew):null,b.location_text||null,b.radio_channel||null,b.notes||null]);await db.query("INSERT INTO audit_log (actor_id,actor_name,action,entity_type,entity_id,detail) VALUES ($1,$2,'update','unit',$3,$4::jsonb)",[actor.id,actor.name||actor.email,String(b.id),JSON.stringify({status:b.status||null})]);return res.json({unit:rows[0]});
}