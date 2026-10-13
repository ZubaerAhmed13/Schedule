// Temporary one-time operator-enabled check. Passwords/tokens stay inside this runtime.
// Only freshly created disposable identities are ever selected, altered or deleted.
import {createClient} from "npm:@supabase/supabase-js@2.117.3";
import {accountServices} from "../_shared/account-services.ts";
import {createHandler,CONFIRMATION} from "../weekwise-account/core.mjs";
const url=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',origin='https://zubaerahmed13.github.io';
const options={auth:{persistSession:false,autoRefreshToken:false}};
Deno.serve(async(request:Request)=>{
 if(request.method!=='POST')return Response.json({error:'Use POST for an operator-enabled check.'},{status:405});
 const admin=createClient(url,key,options),{data:claimed,error:claimError}=await admin.rpc('weekwise_claim_activation_check');
 if(claimError||claimed!==true)return Response.json({error:'Activation check is disabled.'},{status:403});
 const ids:string[]=[],report:Record<string,boolean>={};let complete=false,stage="creating_fixture";
 const required=(condition:boolean,label:string)=>{report[label]=condition;if(!condition)throw new Error(label);};
 try{
  const users=[];
  for(let index=0;index<2;index++){
   const nonce=crypto.randomUUID(),email='weekwise-disposable-'+nonce+'@example.invalid',password=crypto.randomUUID()+crypto.randomUUID()+'aA1!';
   const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{weekwise_disposable_activation_check:true}});if(error||!data.user)throw new Error('fixture_creation');
   ids.push(data.user.id);const auth=createClient(url,anon,options),login=await auth.auth.signInWithPassword({email,password});if(login.error||!login.data.session)throw new Error('fixture_login');
   users.push({id:data.user.id,email,password,token:login.data.session.access_token,refresh:login.data.session.refresh_token});
   const cloud={version:1,store:{settings:{timeZone:'Europe/Berlin'},weeks:{},recurringTemplates:[],customLists:[]},reminders:[],focusSessions:[],habits:[],countdowns:[],savedTaskFilters:[],taskTemplates:[]};
   stage="seeding_fixture";
   const rows=[['weekwise_cloud_data',{user_id:data.user.id,data:cloud,revision:1}],['weekwise_push_subscriptions',{user_id:data.user.id,endpoint:'https://fcm.googleapis.com/fcm/send/weekwise-disposable-'+nonce,subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/weekwise-disposable-'+nonce,keys:{auth:'synthetic',p256dh:'synthetic'}},timezone:'Europe/Berlin'}],['weekwise_push_delivery_log',{user_id:data.user.id,task_id:'synthetic',reminder_at:'2099-01-01T00:00:00Z',status:'sent'}],['weekwise_calendar_oauth_states',{user_id:data.user.id,state_hash:nonce,provider:'google',code_verifier:'synthetic',expires_at:'2099-01-01T00:00:00Z'}],['weekwise_calendar_connections',{user_id:data.user.id,provider:'google',encrypted_access_token:'synthetic-only',encrypted_refresh_token:'synthetic-only',access_token_expires_at:'2099-01-01T00:00:00Z'}],['weekwise_calendar_event_links',{user_id:data.user.id,provider:'google',task_id:'synthetic',provider_event_id:nonce,weekwise_fingerprint:'synthetic',origin:'weekwise'}]] as const;
   for(const [table,row]of rows){const inserted=await admin.from(table).insert(row);if(inserted.error)throw new Error('fixture_rows');}
  }
  stage="checking_core";
  const [a,b]=users,core=createHandler({enabled:true,origin,...accountServices(url,key,anon)});
  const call=(token:string,password:string,extra:Record<string,unknown>={})=>core(new Request(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({confirmation:CONFIRMATION,backedUp:true,password,...extra})}));
  const before=await admin.from('weekwise_cloud_data').select('data,revision,updated_at').eq('user_id',b.id).single();if(before.error)throw new Error('fixture_snapshot');
  required((await call(a.token,'incorrect-disposable-password')).status===401,'wrong_password_rejected');
  required((await call(a.token,a.password,{userId:b.id})).status===400,'supplied_target_rejected');
  required((await call('invalid-token',a.password)).status===401,'invalid_token_rejected');
  const deleted=await call(a.token,a.password),value=await deleted.json();required(deleted.ok&&value.deleted===true&&value.owner===a.id,'core_erasure_verified');
  for(const table of ['weekwise_cloud_data','weekwise_push_subscriptions','weekwise_push_delivery_log','weekwise_calendar_oauth_states','weekwise_calendar_connections','weekwise_calendar_event_links']){
   const remaining=await admin.from(table).select('user_id',{count:'exact',head:true}).eq('user_id',a.id);required(!remaining.error&&remaining.count===0,'cascade_'+table.replace('weekwise_',''));
  }
  const after=await admin.from('weekwise_cloud_data').select('data,revision,updated_at').eq('user_id',b.id).single();required(!after.error&&JSON.stringify(before.data)===JSON.stringify(after.data),'other_fixture_preserved');
  const old=await admin.auth.getUser(a.token);required(!!old.error&&!old.data.user,'deleted_identity_rejected');const refresh=await createClient(url,anon,options).auth.refreshSession({refresh_token:a.refresh});required(!!refresh.error,'refresh_revoked');
  stage="enabling_erasure";
  const enable=await admin.rpc('weekwise_set_erasure_enabled',{p_enabled:true});if(enable.error)throw new Error('enable_failed');
  stage="checking_deployed_endpoint";
  const endpoint=url+'/functions/v1/weekwise-account',headers={Origin:origin,apikey:anon,Authorization:'Bearer '+b.token,'Content-Type':'application/json'};
  const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({confirmation:CONFIRMATION,backedUp:true,password:b.password})}),outcome=await response.json();required(response.ok&&outcome.deleted===true&&outcome.owner===b.id,'deployed_endpoint_verified');
  complete=true;
 }catch(_){report["failure_"+stage]=true;complete=false;}
 finally{
  let cleaned=true;for(const id of ids){const remaining=await admin.auth.admin.getUserById(id);if(remaining.error&&remaining.error.status!==404&&remaining.error.code!=='user_not_found')cleaned=false;if(remaining.data?.user){const removed=await admin.auth.admin.deleteUser(id);if(removed.error)cleaned=false;}}
  report.disposable_identities_cleaned=cleaned;complete=complete&&cleaned;
  if(!complete)await admin.rpc('weekwise_set_erasure_enabled',{p_enabled:false});
  await admin.rpc('weekwise_record_activation_check',{p_passed:complete,p_report:report});
 }
 return Response.json({passed:complete,checks:report},{status:complete?200:500});
});
