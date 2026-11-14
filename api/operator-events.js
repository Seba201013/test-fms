import { events } from 'hatchable';
export const access='user';
export const methods=['POST'];
export default async function(req,res){const chans=['emergency-queue'];const id=Number(req.body?.call_id);if(id)chans.push('emergency-call-'+id);const grant=await events.grant(chans,{ttl:3600});res.json(grant)}