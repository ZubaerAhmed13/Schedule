// Temporary signed, one-use acceptance check. Tokens/passwords never leave Edge.
// No email is sent. Only fresh reserved-domain identities and their own rows are
// tested/deleted. Retire to HTTP 410 immediately after the acceptance run.
import {createClient} from "npm:@supabase/supabase-js@2.117.3";
import {runtimeConfiguration,activationRequestMatches} from "../_shared/runtime-config.mjs";
import {CONFIRMATION} from "../weekwise-account/core.mjs";
const url=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',origin='https://zubaerahmed13.github.io';
const options={auth:{persistSession:false,autoRefreshToken:false}};
const payload=(label:string)=>({version:1,store:{settings:{timeZone:'UTC'},weeks:{},recurringTemplates:[],customLists:[],fixture:label},reminders:[],focusSessions:[],habits:[],countdowns:[],savedTaskFilters:[],taskTemplates:[]});
Deno.serve(async(request:Request)=>{
 if(request.method!=='POST')return Response.json({error:'Use POST.'},{status:405});
 const admin=createClient(url,key,options);let cfg:Record<string,string>;
 try{cfg=await runtimeConfiguration(admin,(name:string)=>Deno.env.get(name),['WEEKWISE_ACTIVATION_CHECK_SECRET']);}catch(_){return Response.json({error:'Check unavailable.'},{status:503});}
 if(!await activationRequestMatches(request.headers,cfg.WEEKWISE_ACTIVATION_CHECK_SECRET))return Response.json({error:'Operator authentication required.'},{status:401});
 const claim=await admin.rpc('weekwise_claim_activation_check');
 if(claim.error||claim.data!==true)return Response.json({error:'Check disabled.'},{status:403});
 const ids:string[]=[],report:Record<string,boolean>={};let checkId:string|null=null,stage='prepare',passed=false;
 const required=(condition:boolean,label:string)=>{report[label]=condition;if(!condition)throw new Error(label);};
 const create=async(code?:string)=>{
  const email='weekwise-disposable-'+crypto.randomUUID()+'@example.com',password=crypto.randomUUID()+'aA1!';
  const value=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{weekwise_disposable_backend_check:true,...(code===undefined?{}:{weekwise_referral_code:code})}});
  if(value.data?.user)ids.push(value.data.user.id);
  return {...value,email,password};
 };
 const publicClient=(token:string)=>createClient(url,anon,{...options,global:{headers:{Authorization:'Bearer '+token}}});
 const push=async(token:string,body:Record<string,unknown>)=>{
  const response=await fetch(url+'/functions/v1/weekwise-push',{method:'POST',headers:{Origin:origin,apikey:anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {status:response.status,ok:response.ok,data:await response.json()};
 };
 try{
  const setup=await admin.rpc('weekwise_prepare_backend_check_invites');required(!setup.error&&!!setup.data?.check_id,'private_check_invites_ready');
  checkId=setup.data.check_id;const codes=setup.data;
  stage='invitation';
  for(const [label,code]of [['missing',undefined],['incorrect','incorrect-disposable'],['revoked',codes.revoked],['expired',codes.expired]] as const){
   const result=await create(code);required(!!result.error&&!result.data.user,'invite_'+label+'_rejected');
  }
  const users=[];
  for(let index=0;index<2;index++){
   const created=await create(codes.valid);required(!created.error&&!!created.data.user,'valid_invite_created');
   const stored=await admin.auth.admin.getUserById(created.data.user!.id);required(!stored.error&&!!stored.data.user&&!Object.hasOwn(stored.data.user.user_metadata,'weekwise_referral_code')&&stored.data.user.user_metadata.weekwise_disposable_backend_check===true,'new_invite_metadata_minimized');
   const auth=createClient(url,anon,options),login=await auth.auth.signInWithPassword({email:created.email,password:created.password});
   required(!login.error&&!!login.data.session&&login.data.user?.id===created.data.user!.id,'password_signin_verified');
   required(!Object.hasOwn(login.data.user!.user_metadata,'weekwise_referral_code'),'signedin_invite_metadata_minimized');
   users.push({id:created.data.user!.id,email:created.email,password:created.password,auth,session:login.data.session!});
  }
  const replay=await create(codes.valid);required(!!replay.error&&!replay.data.user,'invite_use_limit_rejected');
  const [a,b]=users,ac=publicClient(a.session.access_token),bc=publicClient(b.session.access_token);
  stage='cloud';
  const initial=await ac.rpc('weekwise_save',{p_data:payload('a'),p_expected_revision:0}),bInitial=await bc.rpc('weekwise_save',{p_data:payload('b'),p_expected_revision:0});
  required(!initial.error&&initial.data?.[0]?.saved===true&&initial.data[0].revision===1,'first_cloud_save_verified');
  required(!bInitial.error&&bInitial.data?.[0]?.saved===true,'second_account_save_verified');
  const own=await ac.from('weekwise_cloud_data').select('user_id,data,revision').eq('user_id',a.id);
  required(!own.error&&own.data?.length===1&&own.data[0].data.store.fixture==='a','own_cloud_read_verified');
  for(const [client,target]of [[ac,b.id],[bc,a.id]] as const){const other=await client.from('weekwise_cloud_data').select('user_id').eq('user_id',target);required(!other.error&&other.data?.length===0,'cross_account_reads_empty');}
  required(!!(await createClient(url,anon,options).from('weekwise_cloud_data').select('user_id')).error,'anonymous_cloud_read_denied');
  required(!!(await ac.from('weekwise_cloud_data').insert({user_id:b.id,data:payload('forbidden'),revision:1})).error,'direct_cloud_insert_denied');
  required(!!(await ac.from('weekwise_cloud_data').update({data:payload('forbidden')}).eq('user_id',a.id)).error,'direct_cloud_update_denied');
  required(!!(await ac.from('weekwise_cloud_data').delete().eq('user_id',a.id)).error,'direct_cloud_delete_denied');
  required(!!(await ac.rpc('weekwise_save',{p_data:payload('forbidden'),p_expected_revision:1,p_user_id:b.id})).error,'supplied_cloud_owner_rejected');
  required(!!(await ac.rpc('weekwise_save',{p_data:{store:{weeks:[]}},p_expected_revision:1})).error,'malformed_cloud_save_rejected');
  const competing=await Promise.all([ac.rpc('weekwise_save',{p_data:payload('race_one'),p_expected_revision:1}),publicClient(a.session.access_token).rpc('weekwise_save',{p_data:payload('race_two'),p_expected_revision:1})]);
  required(competing.every(r=>!r.error)&&competing.filter(r=>r.data?.[0]?.saved===true).length===1&&competing.filter(r=>r.data?.[0]?.saved===false).length===1,'competing_revision_one_winner');
  const winner=competing.find(r=>r.data?.[0]?.saved===true)!.data[0];
  required(competing.every(r=>r.data[0].revision===2&&JSON.stringify(r.data[0].data)===JSON.stringify(winner.data)),'losing_save_receives_winner');
  const freshAuth=createClient(url,anon,options),fresh=await freshAuth.auth.signInWithPassword({email:a.email,password:a.password});required(!fresh.error&&!!fresh.data.session,'fresh_device_signin');
  const reloaded=await publicClient(fresh.data.session!.access_token).from('weekwise_cloud_data').select('data,revision').eq('user_id',a.id).single();
  required(!reloaded.error&&reloaded.data.revision===2&&JSON.stringify(reloaded.data.data)===JSON.stringify(winner.data),'fresh_device_reload_preserves_winner');
  const stale=await ac.rpc('weekwise_save',{p_data:payload('stale'),p_expected_revision:1});required(!stale.error&&stale.data[0].saved===false&&stale.data[0].revision===2,'stale_save_cannot_overwrite');
  stage='push';
  const endpoint='https://fcm.googleapis.com/fcm/send/weekwise-disposable-'+crypto.randomUUID();
  const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const base64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const subscription={endpoint,keys:{p256dh:base64(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))),auth:base64(crypto.getRandomValues(new Uint8Array(16)))}};
  required((await push('invalid-token',{action:'status',endpoint})).status===401,'push_invalid_token_rejected');
  required((await push(a.session.access_token,{action:'subscribe',subscription:{endpoint:'https://example.com/blocked',keys:subscription.keys},timezone:'UTC'})).status===400,'push_untrusted_endpoint_rejected');
  const registered=await push(a.session.access_token,{action:'subscribe',subscription,timezone:'UTC'});required(registered.ok&&registered.data.enabled===true,'push_owner_subscribe_verified');
  const foreign=await push(b.session.access_token,{action:'status',endpoint});required(foreign.ok&&foreign.data.enabled===false&&foreign.data.deviceCount===0,'push_other_account_status_isolated');
  required((await push(b.session.access_token,{action:'subscribe',subscription,timezone:'UTC'})).status===409,'push_subscription_owner_preserved');
  await push(b.session.access_token,{action:'unsubscribe',endpoint});const retained=await push(a.session.access_token,{action:'status',endpoint});required(retained.ok&&retained.data.enabled===true,'push_other_account_optout_preserves_owner');
  const claimed=await admin.rpc('weekwise_claim_push_delivery',{p_user_id:a.id,p_task_id:'future-fixture',p_reminder_at:'2099-01-01T00:00:00Z'}),duplicate=await admin.rpc('weekwise_claim_push_delivery',{p_user_id:a.id,p_task_id:'future-fixture',p_reminder_at:'2099-01-01T00:00:00Z'});
  required(!claimed.error&&claimed.data===true&&!duplicate.error&&duplicate.data===false,'push_duplicate_delivery_claim_denied');
  required(!!(await ac.rpc('weekwise_claim_push_delivery',{p_user_id:a.id,p_task_id:'forbidden',p_reminder_at:'2099-01-01T00:00:00Z'})).error,'browser_delivery_claim_denied');
  const removed=await push(a.session.access_token,{action:'unsubscribe',endpoint}),disabled=await push(a.session.access_token,{action:'status',endpoint});required(removed.ok&&disabled.ok&&disabled.data.enabled===false&&disabled.data.deviceCount===0,'push_optout_verified');
  stage='session';
  const refreshed=await a.auth.auth.refreshSession({refresh_token:a.session.refresh_token});required(!refreshed.error&&refreshed.data.user?.id===a.id&&!!refreshed.data.session,'session_refresh_verified');
  const signedOut=await admin.auth.admin.signOut(refreshed.data.session!.access_token,'global');required(!signedOut.error,'global_session_revocation_verified');
  const denied=await createClient(url,anon,options).auth.refreshSession({refresh_token:refreshed.data.session!.refresh_token});required(!!denied.error&&!denied.data.session,'revoked_refresh_rejected');
  stage='recovery';
  const link=await admin.auth.admin.generateLink({type:'recovery',email:a.email});required(!link.error&&!!link.data.properties?.hashed_token,'recovery_link_generated_without_email');
  const recovery=createClient(url,anon,options),otp=await recovery.auth.verifyOtp({type:'recovery',token_hash:link.data.properties!.hashed_token});required(!otp.error&&otp.data.user?.id===a.id&&!!otp.data.session,'recovery_token_verified');
  const newPassword=crypto.randomUUID()+'aA1!',changed=await recovery.auth.updateUser({password:newPassword});required(!changed.error&&changed.data.user?.id===a.id,'recovered_password_updated');
  const reused=await createClient(url,anon,options).auth.verifyOtp({type:'recovery',token_hash:link.data.properties!.hashed_token});required(!!reused.error,'used_recovery_token_rejected');
  const oldLogin=await createClient(url,anon,options).auth.signInWithPassword({email:a.email,password:a.password});required(!!oldLogin.error&&!oldLogin.data.session,'old_password_rejected');
  const newLogin=await createClient(url,anon,options).auth.signInWithPassword({email:a.email,password:newPassword});required(!newLogin.error&&newLogin.data.user?.id===a.id&&!!newLogin.data.session,'new_password_signin_verified');
  stage='erasure';
  const response=await fetch(url+'/functions/v1/weekwise-account',{method:'POST',headers:{Origin:origin,apikey:anon,Authorization:'Bearer '+newLogin.data.session!.access_token,'Content-Type':'application/json'},body:JSON.stringify({confirmation:CONFIRMATION,backedUp:true,password:newPassword})}),outcome=await response.json();
  required(response.ok&&outcome.deleted===true&&outcome.owner===a.id,'recovered_account_erasure_verified');
  required(!!(await publicClient(newLogin.data.session!.access_token).rpc('weekwise_save',{p_data:payload('deleted'),p_expected_revision:0})).error,'deleted_account_cannot_recreate_cloud');
  const bAfter=await bc.from('weekwise_cloud_data').select('data,revision').eq('user_id',b.id).single();required(!bAfter.error&&bAfter.data.revision===1&&JSON.stringify(bAfter.data.data)===JSON.stringify(bInitial.data[0].data),'other_account_unchanged');
  passed=true;
 }catch(_){report['failure_'+stage]=true;}
 finally{
  let cleaned=true;
  for(const id of ids){const existing=await admin.auth.admin.getUserById(id);if(existing.data?.user){const removed=await admin.auth.admin.deleteUser(id);if(removed.error)cleaned=false;}else if(existing.error&&existing.error.status!==404&&existing.error.code!=='user_not_found')cleaned=false;}
  report.disposable_identities_cleaned=cleaned;
  const cleanup=checkId?await admin.rpc('weekwise_cleanup_backend_check_invites',{p_check_id:checkId}):null;
  report.disposable_invites_cleaned=!!cleanup&&!cleanup.error&&cleanup.data===true;
  passed=passed&&cleaned&&report.disposable_invites_cleaned;
  const receipt=await admin.rpc('weekwise_record_activation_check',{p_passed:passed,p_report:report});if(receipt.error)passed=false;
 }
 return Response.json({passed,checks:report},{status:passed?200:500,headers:{'Cache-Control':'no-store'}});
});
