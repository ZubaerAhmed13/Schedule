/* Same restore entries as production; rehearsal uses a private in-memory store. */
(function(root){
 'use strict';
 const names={reminders:'weekwise-reminders-v1',focusSessions:'weekwise-focus-sessions-v1',habits:'weekwise-habits-v1',countdowns:'weekwise-countdowns-v1',savedTaskFilters:'weekwise-saved-filters-v1',taskTemplates:'weekwise-task-templates-v1'};
 function entries(data){return [['weekwise-planner-v2',JSON.stringify(root.WeekwiseData.storeFromBackup(data))],...Object.entries(names).filter(([name])=>Array.isArray(data[name])).map(([name,key])=>[key,JSON.stringify(data[name])])];}
 async function rehearse(raw){
  const data=root.WeekwiseData.parseBackup(raw),expected=entries(data),values=new Map(),memory={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  root.WeekwiseData.commitStorage(memory,expected,'isolated-pre-restore');
  const store=root.WeekwiseData.parseStore(memory.getItem('weekwise-planner-v2'));
  for(const [name,key]of Object.entries(names))if(Array.isArray(data[name]))root.WeekwiseData.validateCollection(JSON.parse(memory.getItem(key)),name);
  if(expected.some(([key,value])=>memory.getItem(key)!==value))throw new Error('Rehearsal did not preserve the complete restored entries.');
  const digest=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  return {kind:'isolated-backup-rehearsal',version:1,backupVersion:data.version??'legacy',sha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join(''),bytes:new TextEncoder().encode(raw).byteLength,weeks:Object.keys(store.weeks).length,tasks:Object.values(store.weeks).reduce((n,w)=>n+w.tasks.length,0),history:(store.taskHistory||[]).length,collections:Object.fromEntries(Object.keys(names).map(name=>[name,Array.isArray(data[name])?data[name].length:null])),roundtripEqual:true,scope:'In-memory restore only. Planner, account, cloud and existing checkpoints were not changed.'};
 }
 root.WeekwiseRecovery=Object.freeze({entries,rehearse,keys:Object.freeze(['weekwise-planner-v2',...Object.values(names)])});
})(typeof window!=='undefined'?window:globalThis);
