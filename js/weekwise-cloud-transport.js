/* Capture one session token for each write so an account change cannot retarget it. */
(function(root){
 'use strict';
 async function save({client,url,key,userId,payload,revision,fetchImpl=root.fetch}){
  const response=await client.auth.getSession(),session=response.data?.session;
  if(response.error||!session?.access_token||session.user?.id!==userId)throw new Error('Your sign-in changed before saving. Sign in again and retry.');
  const token=String(session.access_token);
  const result=await fetchImpl(url.replace(/\/$/,'')+'/rest/v1/rpc/weekwise_save',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_data:payload,p_expected_revision:revision})});
  const body=await result.json().catch(()=>null);
  if(!result.ok)throw new Error(body?.message||'Cloud save could not be confirmed.');
  return {data:body,error:null};
 }
 root.WeekwiseCloudTransport=Object.freeze({save});
})(typeof window!=='undefined'?window:globalThis);
