/* Authenticated offline cache eligibility for a single device.
   This is a local UX gate, not cryptographic protection for data at rest.
   Never use an account identifier alone as proof of an offline session. */
(function(root){
 'use strict';
 const KEY='weekwise-offline-access-v1',LOCK='weekwise-account-device-v1',SIGNED_OUT='weekwise-explicit-signout-v1';
 const WINDOW_MS=30*24*60*60*1000;
 const read=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch(_){return null;}};
 function grant(storage,owner,now=Date.now()){
  if(typeof owner!=='string'||!owner||owner==='local')return false;
  try{
   storage.setItem(KEY,JSON.stringify({owner,verifiedAt:now}));
   storage.setItem(LOCK,'true');
   storage.removeItem(SIGNED_OUT);
   return true;
  }catch(_){return false;}
 }
 function allows(storage,owner,now=Date.now()){
  if(typeof owner!=='string'||!owner||owner==='local'||isSignedOut(storage))return false;
  const marker=read(storage,KEY);
  return marker?.owner===owner&&Number.isFinite(marker.verifiedAt)&&marker.verifiedAt<=now&&now-marker.verifiedAt<=WINDOW_MS;
 }
 function unlockAfterPassword(storage){try{storage.removeItem(SIGNED_OUT);}catch(_){}}
 function isSignedOut(storage){try{return storage.getItem(SIGNED_OUT)==='true';}catch(_){return true;}}
 function isAccountDevice(storage){try{return storage.getItem(LOCK)==='true';}catch(_){return false;}}
 function revoke(storage){
  try{storage.removeItem(KEY);storage.removeItem('weekwise-offline-owner-v1');storage.setItem(SIGNED_OUT,'true');storage.setItem(LOCK,'true');}catch(_){}
 }
 function canOpenOffline(storage,owner,online,now=Date.now()){return !online&&allows(storage,owner,now);}
 function display({owner,online,signedIn,offlineCopy,dirty,busy,conflict,ready,message}){
  if(!owner||owner==='local')return {label:'Device only',tone:'neutral'};
  if(conflict)return {label:'Review sync',tone:'warning'};
  if(!online||offlineCopy)return {label:dirty?'Saved offline':'Offline ready',tone:'warning'};
  if(!signedIn)return {label:'Sign in to sync',tone:'warning'};
  if(busy||/syncing|checking cloud|uploading/i.test(message||''))return {label:'Syncing',tone:'progress'};
  if(/fail|error|rejected|could not|unavailable/i.test(message||''))return {label:'Sync paused',tone:'warning'};
  if(!ready||dirty)return {label:dirty?'Waiting to sync':'Connecting',tone:'progress'};
  return {label:'Synced',tone:'success'};
 }
 root.WeekwiseOfflineAccess=Object.freeze({grant,allows,revoke,unlockAfterPassword,isSignedOut,isAccountDevice,canOpenOffline,display,WINDOW_MS});
})(typeof window!=='undefined'?window:globalThis);
