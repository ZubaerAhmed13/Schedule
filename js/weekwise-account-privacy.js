/* Account-scoped local erasure. Shared recovery checkpoints remain explicit. */
(function(root){
 'use strict';
 function ownedEntries(storage,owner){if(typeof owner!=='string'||!owner||owner==='local')throw new Error('Choose a signed-in account.');
  const exact=new Set(['weekwise-account-cache-v1:'+owner,'weekwise-focus-active-v1:'+owner,'weekwise-editor-draft-v1:'+owner,'weekwise-onboarding-v1:'+encodeURIComponent(owner),'weekwise-nav-groups-v1:'+encodeURIComponent(owner),'weekwise-zone-review-v1:'+encodeURIComponent(owner),'weekwise-zone-backup-v1:'+encodeURIComponent(owner)]);
  exact.add('weekwise-quick-edit-v1:'+encodeURIComponent(owner));
  exact.add('weekwise-performance-v1:'+encodeURIComponent(owner));exact.add('weekwise-device-checks-v1:'+encodeURIComponent(owner));
  exact.add('weekwise-diagnostics-v1:'+encodeURIComponent(owner));
  const entries=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(exact.has(key)||key.startsWith('weekwise-editor-draft-archive-v1:'+owner+':'))entries.push([key,storage.getItem(key)]);}
  if(storage.getItem('weekwise-offline-owner-v1')===owner)entries.push(['weekwise-offline-owner-v1',owner]);return entries;
 }
 function removeOwned(storage,entries){for(const [key,raw]of entries)if(storage.getItem(key)!==raw)throw new Error('A local account copy changed. Refresh before removing it.');
  try{for(const [key]of entries)storage.removeItem(key);}catch(_){let failed=false;for(const [key,raw]of entries){try{storage.setItem(key,raw);}catch(_){failed=true;}}throw new Error(failed?'Local cleanup failed and rollback was incomplete. Keep your exported backup.':'Local cleanup failed; previous copies were restored.');}return entries.length;
 }
 root.WeekwiseAccountPrivacy=Object.freeze({ownedEntries,removeOwned});
})(typeof window!=='undefined'?window:globalThis);
