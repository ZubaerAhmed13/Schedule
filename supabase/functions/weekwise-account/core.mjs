export const CONFIRMATION='DELETE MY WEEKWISE ACCOUNT';
const MAX_BYTES=16384;
async function bodyJSON(request){
 const reader=request.body?.getReader();if(!reader)throw new Error('body');let size=0,text='';const decoder=new TextDecoder();
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw new Error('size');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return JSON.parse(text);
}
export function createHandler({enabled=false,origin='https://zubaerahmed13.github.io',getUser,reauthenticate,revokeSessions,deleteUser,now=()=>Date.now()}){
 const attempts=new Map();
 return async request=>{
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==origin)return reply({error:'Origin is not allowed.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method==='GET')return reply({configured:enabled,version:1,operation:'delete-own-account'});
  if(request.method!=='POST')return reply({error:'Method is not allowed.'},405);
  if(!enabled)return reply({error:'Account erasure is not activated on this project.'},503);
  const token=/^Bearer (\S+)$/.exec(request.headers.get('Authorization')||'')?.[1];
  if(!token||token.length>16384)return reply({error:'Sign in before requesting account erasure.'},401);
  let body;
  try{body=await bodyJSON(request);}catch(error){return reply({error:'Use a valid, bounded account-erasure request.'},error.message==='size'?413:400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['confirmation','password','backedUp'].includes(key))||body.confirmation!==CONFIRMATION||body.backedUp!==true||typeof body.password!=='string'||!body.password||body.password.length>2048)return reply({error:'Confirm the account-erasure phrase, backup acknowledgement and password.'},400);
  try{
   const user=await getUser(token);if(!user?.id||!user.email)return reply({error:'A verified password account is required.'},401);
   const prior=attempts.get(user.id),time=now();
   if(prior&&time-prior.at<600000&&prior.count>=5)return reply({error:'Too many attempts. Wait ten minutes before retrying.'},429);
   if(attempts.size>=1000&&!prior)attempts.delete(attempts.keys().next().value);
   attempts.set(user.id,{at:prior&&time-prior.at<600000?prior.at:time,count:prior&&time-prior.at<600000?prior.count+1:1});
   const fresh=await reauthenticate(user.email,body.password);
   if(!fresh?.id||!fresh.token||fresh.id!==user.id)return reply({error:'Password reauthentication failed. Nothing was deleted.'},401);
   // Revocation precedes erasure; a failure never continues to privileged delete.
   await revokeSessions(fresh.token);
   await deleteUser(user.id);
   attempts.delete(user.id);
   return reply({deleted:true,owner:user.id,revokedRefreshSessions:true});
  }catch(_){return reply({error:'Erasure was not confirmed. Your account may be signed out; retry after signing in. No local copies were cleared.'},500);}
 };
}
