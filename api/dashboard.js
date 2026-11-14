import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET'];
export default async function(req,res){
  const [i,u,c,r] = await Promise.all([
    db.query("SELECT id, incident_no, priority, category, status, location_text, summary, assigned_units, created_at FROM incidents WHERE status <> 'closed' ORDER BY CASE priority WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END, created_at DESC LIMIT 40"),
    db.query("SELECT id, unit_code, name, unit_type, division, radio_channel, status, crew, location_text FROM units WHERE active=true ORDER BY unit_code"),
    db.query("SELECT id, custody_no, person_name, station, reason, risk_level, status, booked_at FROM custody_records WHERE status='in_custody' ORDER BY booked_at DESC LIMIT 30"),
    db.query("SELECT role, count(*)::int AS count FROM staff_profiles WHERE active=true GROUP BY role ORDER BY role")
  ]);
  res.json({incidents:i.rows, units:u.rows, custody:c.rows, staffByRole:r.rows, now:new Date().toISOString()});
}