import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {probeServices,publicConfiguration,report} from '../scripts/probe-services.mjs';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),version='1234567890abcdef';
const response=(body,status=200)=>new Response(typeof body==='string'?body:JSON.stringify(body),{status});
function fetcher(overrides={},calls=[]){return async(url,options)=>{calls.push({url,options});if(overrides[url])return overrides[url]();if(url.endsWith('/health'))return response({name:'GoTrue'});if(url.endsWith('/settings'))return response({external:{email:true},disable_signup:false});if(url.includes('/rest/v1/'))return response('private-error-body',403);if(url.endsWith('/weekwise-account'))return response({configured:true,operation:'delete-own-account'});if(url.endsWith('/weekwise-push'))return response('Use POST',405);if(url.endsWith('/build-info.json'))return response({commit:'a'.repeat(40),run_id:'123',assetVersion:version});return response('<title>Weekwise</title><script src="./js/weekwise-app.js?v='+version+'"></script>');}}
test('public probes use GET only, no session and no planner writes; report no public key or response body',async()=>{
 const calls=[],results=await probeServices({source,fetchImpl:fetcher({},calls),attempts:1});assert.equal(results.length,6);assert.equal(results.every(r=>r.state==='passed'),true);assert.equal(calls.every(c=>c.options.method==='GET'),true);assert.equal(calls.some(c=>c.options.headers.Authorization),false);
 assert.doesNotMatch(report(results),/private-error-body|sb_publishable_|eyJ|user_id|supabase.co/);
 assert.throws(()=>publicConfiguration(source.replace('iajkzlsurghfvsmqkmut','other-project')),/Weekwise project/);
});
test('public probes expose regressions without private response text and retry bounded failures',async()=>{
 const url='https://iajkzlsurghfvsmqkmut.supabase.co/rest/v1/weekwise_cloud_data?select=user_id&limit=1';let attempts=0;
 const results=await probeServices({source,fetchImpl:fetcher({[url]:()=>{attempts++;return response('[{"user_id":"private-user"}]')}}),attempts:2,pause:async()=>{}});assert.equal(attempts,2);assert.equal(results.find(v=>v.check==='Anonymous planner access denied').state,'failed');assert.doesNotMatch(report(results),/private-user/);
 const mismatch=await probeServices({source,fetchImpl:fetcher({'https://zubaerahmed13.github.io/Schedule/':()=>response('<title>Weekwise</title><script src="./js/app.js?v=ffffffffffffffff"></script>')}),attempts:1});assert.equal(mismatch.find(v=>v.check==='Published app and build agree').state,'failed');
});
