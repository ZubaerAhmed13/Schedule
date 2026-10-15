import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-offline-access.js';

const access=globalThis.WeekwiseOfflineAccess;
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};

test('offline editing eligibility requires a recently verified matching owner and no signout',()=>{
 const db=storage(),now=Date.parse('2026-10-15T12:00:00Z');
 assert.equal(access.canOpenOffline(db,'alice',false,now),false);
 assert.equal(access.grant(db,'alice',now),true);
 assert.equal(access.allows(db,'alice',now),true);
 assert.equal(access.canOpenOffline(db,'alice',false,now),true);
 assert.equal(access.canOpenOffline(db,'alice',true,now),false);
 assert.equal(access.allows(db,'bob',now),false,'a different account cannot inherit access');
 assert.equal(access.allows(db,'alice',now+access.WINDOW_MS+1),false,'offline eligibility must expire');
 assert.equal(access.allows(db,'alice',now-1),false,'a future timestamp is not accepted');
});

test('explicit signout locks both cached offline account access and previous guest entry',()=>{
 const db=storage(),now=Date.now();access.grant(db,'alice',now);
 db.setItem('weekwise-offline-owner-v1','alice');
 access.revoke(db);
 assert.equal(access.allows(db,'alice',now),false);
 assert.equal(access.isSignedOut(db),true);
 assert.equal(access.isAccountDevice(db),true);
 assert.equal(db.getItem('weekwise-offline-owner-v1'),null);
 access.unlockAfterPassword(db);
 assert.equal(access.isSignedOut(db),false);
 assert.equal(access.allows(db,'alice',now),false,'successful login must be verified online to restore offline trust');
 access.grant(db,'bob',now);
 assert.equal(access.allows(db,'alice',now),false);
 assert.equal(access.allows(db,'bob',now),true);
});

test('mobile status distinguishes queued offline edits, review conflicts, and synced records',()=>{
 assert.deepEqual(access.display({owner:'alex',online:false,signedIn:true,dirty:true}),{label:'Saved offline',tone:'warning'});
 assert.deepEqual(access.display({owner:'alex',online:true,signedIn:false,dirty:true}),{label:'Sign in to sync',tone:'warning'});
 assert.deepEqual(access.display({owner:'alex',online:true,signedIn:true,busy:false,ready:true,dirty:false}),{label:'Synced',tone:'success'});
 assert.deepEqual(access.display({owner:'alex',online:true,signedIn:true,conflict:true}),{label:'Review sync',tone:'warning'});
 assert.deepEqual(access.display({owner:'local',online:false}),{label:'Device only',tone:'neutral'});
});
