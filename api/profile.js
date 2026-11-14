import { db } from 'hatchable';
export const access='user'; export const methods=['GET','PUT'];

async function isSuperadmin(email){
  const {rows}=await db.query("SELECT value FROM system_settings WHERE key='superadmin_emails' LIMIT 1");
  const list=Array.isArray(rows[0]?.value)?rows[0].value:[];
  return list.map(v=>String(v).toLowerCase()).includes(String(email||'').toLowerCase());
}

async function ensureSuperadmin(u){
  if(!(await isSuperadmin(u.email))) return null;
  const permissions={all:true,cad:true,calls:true,dispatch:true,mdt:true,custody:true,supervision:true,admin:true,users:true,units:true,settings:true,audit:true,reports:true,emergency999:true};
  const {rows}=await db.query("INSERT INTO staff_profiles (user_id,display_name,callsign,rank,role,division,active,permissions) VALUES ($1,$2,$3,$4,$5,$6,true,$7::jsonb) ON CONFLICT (user_id) DO UPDATE SET role='admin',rank='System Administrator',division='National Command',active=true,permissions=$7::jsonb,updated_at=now() RETURNING *",[u.id,u.name||u.email,'SYS-01','System Administrator','admin','National Command',JSON.stringify(permissions)]);
  return rows[0];
}

export default async function(req,res){
  const u=req.user;
  if(req.method==='GET'){
    const elevated=await ensureSuperadmin(u);
    if(elevated)return res.json({user:u,profile:elevated});
    const {rows}=await db.query("SELECT * FROM staff_profiles WHERE user_id=$1",[u.id]);
    return res.json({user:u,profile:rows[0]||null});
  }
  const elevated=await ensureSuperadmin(u);
  if(elevated)return res.json({profile:elevated});
  const b=req.body||{};
  const {rows}=await db.query("INSERT INTO staff_profiles (user_id,display_name,callsign,rank,role,division) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id) DO UPDATE SET display_name=EXCLUDED.display_name,callsign=EXCLUDED.callsign,rank=EXCLUDED.rank,role=EXCLUDED.role,division=EXCLUDED.division,updated_at=now() RETURNING *",[u.id,b.display_name||u.name||u.email,b.callsign||null,b.rank||'Member',b.role||'officer',b.division||'National']);
  return res.json({profile:rows[0]});
}