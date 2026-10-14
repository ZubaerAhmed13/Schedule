#!/usr/bin/env node
/* Public, non-writing service checks. No account session, planner fixture, or secret. */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const PROJECT='https://iajkzlsurghfvsmqkmut.supabase.co';
const SITE='https://zubaerahmed13.github.io/Schedule/';
export function publicConfiguration(source){
 const url=source.match(/const SUPABASE_URL='([^']+)'/)?.[1],key=source.match(/const SUPABASE_PUBLISHABLE_KEY='([^']+)'/)?.[1];
 let allowed=typeof key==='string'&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
 if(!allowed&&typeof key==='string')try{allowed=JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role==='anon';}catch(_){}
 if(url!==PROJECT||!allowed||key.length>4096)throw new Error('Public configuration does not match the Weekwise project.');
 return {url,key};
}
async function boundedText(response,max){
 const reader=response.body?.getReader();if(!reader)return '';let text='',size=0;const decoder=new TextDecoder();
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new Error('Response exceeded the public probe limit.');text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{await reader.cancel().catch(()=>{});}
}
export async function probeServices({source,fetchImpl=fetch,timeoutMs=8000,attempts=3,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const {url,key}=publicConfiguration(source),headers={apikey:key};
 async function request(target,verify){
  for(let n=0;n<attempts;n++){
   const control=new AbortController(),timer=setTimeout(()=>control.abort(),timeoutMs);
   try{const response=await fetchImpl(target,{method:'GET',headers:target.startsWith(url)?headers:{},redirect:'error',signal:control.signal,cache:'no-store'});return await verify(response);}
   catch(_){if(n===attempts-1)throw new Error('Public service check failed.');await pause(1200);}
   finally{clearTimeout(timer);}
  }
 }
 const definitions=[
  ['Authentication health',()=>request(url+'/auth/v1/health',async r=>{if(!r.ok)throw new Error();const v=JSON.parse(await boundedText(r,16384));if(!v.name)throw new Error();})],
  ['Email sign-in available',()=>request(url+'/auth/v1/settings',async r=>{if(!r.ok)throw new Error();const v=JSON.parse(await boundedText(r,32768));if(v.external?.email!==true||v.disable_signup===true)throw new Error();})],
  ['Anonymous planner access denied',()=>request(url+'/rest/v1/weekwise_cloud_data?select=user_id&limit=1',async r=>{await r.body?.cancel();if(![401,403].includes(r.status))throw new Error();})],
  ['Account erasure configured',()=>request(url+'/functions/v1/weekwise-account',async r=>{if(!r.ok)throw new Error();const v=JSON.parse(await boundedText(r,16384));if(v.configured!==true||v.operation!=='delete-own-account')throw new Error();})],
  ['Push route available',()=>request(url+'/functions/v1/weekwise-push',async r=>{await r.body?.cancel();if(r.status!==405)throw new Error();})],
  ['Published app and build agree',async()=>{
   const info=await request(SITE+'build-info.json',async r=>{if(!r.ok)throw new Error();const v=JSON.parse(await boundedText(r,16384));if(!/^[a-f0-9]{40}$/.test(v.commit||'')||!/^\d+$/.test(String(v.run_id||''))||!/^[a-f0-9]{16}$/.test(v.assetVersion||''))throw new Error();return v;});
   await request(SITE,async r=>{if(!r.ok)throw new Error();const html=await boundedText(r,512000);const versions=[...html.matchAll(/(?:src|href)="\.\/[^"?]+\.(?:js|css)\?v=([a-f0-9]{16})"/g)].map(m=>m[1]);if(!versions.length||versions.some(v=>v!==info.assetVersion)||!/<title>Weekwise/.test(html))throw new Error();});
  }]
 ];
 return Promise.all(definitions.map(async([check,run])=>{const start=Date.now();try{await run();return {check,state:'passed',elapsedMs:Date.now()-start};}catch(_){return {check,state:'failed',elapsedMs:Date.now()-start};}}));
}
export function report(checks){return ['| Public service check | Result |','|---|---|',...checks.map(v=>'| '+v.check+' | '+v.state+' |'),'','These GET-only checks do not verify signed-in sync, mail delivery, reminder scheduling, OS notification delivery, historical restore, or an availability SLA.'].join('\n');}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const results=await probeServices({source:fs.readFileSync(new URL('../index.html',import.meta.url),'utf8')});const text=report(results);console.log(text);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,text+'\n');if(results.some(v=>v.state!=='passed'))process.exitCode=1;}
 catch(_){console.error('Weekwise public service checks could not run. Configuration or service response needs review.');process.exitCode=1;}
}
