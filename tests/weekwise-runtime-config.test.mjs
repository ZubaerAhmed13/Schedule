import test from 'node:test';import assert from 'node:assert/strict';
import {runtimeConfiguration,pushConfiguration} from '../supabase/functions/_shared/runtime-config.mjs';
test('server configuration respects explicit environment values and only loads allowed missing keys',async()=>{let requested;const admin={async rpc(name,args){requested=args.p_names;return {data:{VAPID_SUBJECT:'https://example.invalid',UNRELATED_SECRET:'must-ignore'}};}};const v=await runtimeConfiguration(admin,key=>key==='WEEKWISE_ACCOUNT_ERASURE_ENABLED'?'false':null,['WEEKWISE_ACCOUNT_ERASURE_ENABLED','VAPID_SUBJECT']);assert.equal(v.WEEKWISE_ACCOUNT_ERASURE_ENABLED,'false');assert.equal(v.VAPID_SUBJECT,'https://example.invalid');assert.equal(v.UNRELATED_SECRET,undefined);assert.deepEqual(requested,['VAPID_SUBJECT']);await assert.rejects(()=>runtimeConfiguration(admin,()=>null,['NOT_ALLOWED']),/Unknown/);});
test('server configuration does not relay a credential-bearing database error',async()=>{await assert.rejects(()=>runtimeConfiguration({async rpc(){return {error:{message:'do-not-relay-test-secret'}};}},()=>null,['VAPID_PRIVATE_KEY']),error=>error.message==='Secure Weekwise configuration is unavailable.');});
test('push bootstrap rereads the winning key pair after an atomic install and never rotates existing keys',async()=>{let reads=0,installed=0;const admin={async rpc(name){if(name==='weekwise_install_vapid_keys'){installed++;return {data:false};}reads++;return {data:reads===1?{VAPID_SUBJECT:'https://example.invalid',WEEKWISE_PUSH_CRON_SECRET:'fixture-cron'}:{VAPID_PUBLIC_KEY:'winning-public',VAPID_PRIVATE_KEY:'winning-private',VAPID_SUBJECT:'https://example.invalid',WEEKWISE_PUSH_CRON_SECRET:'fixture-cron'}};}};const v=await pushConfiguration(admin,()=>null,()=>({publicKey:'generated-public',privateKey:'generated-private'}));assert.equal(v.VAPID_PUBLIC_KEY,'winning-public');assert.equal(v.VAPID_PRIVATE_KEY,'winning-private');assert.equal(installed,1);await pushConfiguration(admin,()=>null,()=>{throw new Error('Existing keys must not rotate');});assert.equal(installed,1);});
test('partial existing push configuration refuses provisioning rather than inventing a mixed key pair',async()=>{await assert.rejects(()=>pushConfiguration({async rpc(){return {data:{VAPID_PRIVATE_KEY:'existing-private'}};}},()=>null,()=>{throw new Error('Must not generate');}),/incomplete/);});

test('activation operator secret requires the exact bounded server value',async()=>{
 const {activationSecretMatches}=await import('../supabase/functions/_shared/runtime-config.mjs');
 const expected='a'.repeat(64);
 assert.equal(activationSecretMatches(expected,expected),true);
 for(const actual of [null,'',expected+'a','b'+expected.slice(1),'a'.repeat(100000)])assert.equal(activationSecretMatches(actual,expected),false);
 assert.equal(activationSecretMatches('',''),false);
});

test('operator proof expires and authenticates exact nonce/time without revealing the key',async()=>{
 const {createHmac}=await import('node:crypto'),{activationRequestMatches}=await import('../supabase/functions/_shared/runtime-config.mjs');
 const key='a'.repeat(64),nonce='12345678-1234-1234-1234-123456789abc',time=1791900000000;
 const proof=createHmac('sha256',key).update('weekwise-activation:'+nonce+':'+time).digest('hex');
 const headers=new Headers({'x-weekwise-activation-nonce':nonce,'x-weekwise-activation-time':String(time),'x-weekwise-activation-proof':proof});
 assert.equal(await activationRequestMatches(headers,key,time),true);
 assert.equal(await activationRequestMatches(headers,key,time+60001),false);
 headers.set('x-weekwise-activation-nonce','22345678-1234-1234-1234-123456789abc');assert.equal(await activationRequestMatches(headers,key,time),false);
 assert.equal(await activationRequestMatches(new Headers(),key,time),false);
});
