import { events, db } from 'hatchable';
export const access='public';
export const methods=['POST'];
export default async function(req,res){const callId=Number(req.body?.call_id),token=String(req.body?.access_token||'');if(!callId||!token)return res.status(400).json({error:'Missing call credentials.'});const {rows}=await db.query('SELECT id FROM emergency_calls WHERE id=$1 AND access_token=$2',[callId,token]);if(!rows[0])return res.status(404).json({error:'Call not found.'});const grant=await events.grant(['emergency-call-'+callId],{ttl:3600});res.json(grant)}