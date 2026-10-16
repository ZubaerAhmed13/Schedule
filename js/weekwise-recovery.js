/* Same restore entries as production; rehearsal uses a private in-memory store. */
(function(root){
 'use strict';
 const names={reminders:'weekwise-reminders-v1',focusSessions:'weekwise-focus-sessions-v1',habits:'weekwise-habits-v1',countdowns:'weekwise-countdowns-v1',savedTaskFilters:'weekwise-saved-filters-v1',taskTemplates:'weekwise-task-templates-v1'};
 function entries(data){return [['weekwise-planner-v2',JSON.stringify(root.WeekwiseData.storeFromBackup(data))],...Object.entries(names).filter(([name])=>Array.isArray(data[name])).map(([name,key])=>[key,JSON.stringify(data[name])])];}
 async function fingerprint(raw){const bytes=new TextEncoder().encode(raw),digest=await root.crypto.subtle.digest('SHA-256',bytes);return {sha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join(''),bytes:bytes.byteLength};}
 function compareValues(original,restored){
  const pending=[[original,restored]];let preserved=true,added=0;
  while(pending.length){const [a,b]=pending.pop();if(a===null||typeof a!=='object'){if(a!==b)preserved=false;continue;}
   if(b===null||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b)){preserved=false;continue;}
   const keys=Object.keys(a),other=Object.keys(b);added+=other.filter(key=>!Object.hasOwn(a,key)).length;
   for(const key of keys){if(!Object.hasOwn(b,key))preserved=false;else pending.push([a[key],b[key]]);}
  }
  return {preserved,added,identical:preserved&&added===0};
 }
 async function compare(originalRaw,restoredRaw){
  const original=root.WeekwiseData.parseBackup(originalRaw),restored=root.WeekwiseData.parseBackup(restoredRaw);
  const source=root.WeekwiseData.storeFromBackup(original),copy=root.WeekwiseData.storeFromBackup(restored),known=['settings','weeks','recurringTemplates','customLists','taskHistory'];
  const other=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!known.includes(key)));
  const sections=known.filter(key=>Object.hasOwn(source,key)||Object.hasOwn(copy,key)).map(section=>({section,...(Object.hasOwn(source,section)?compareValues(source[section],copy[section]):{preserved:true,added:1,identical:false})}));
  sections.push({section:'otherPlannerData',...compareValues(other(source),other(copy))});
  for(const section of Object.keys(names))if(Array.isArray(original[section]))sections.push({section,...compareValues(original[section],restored[section])});
  const counts=value=>({weeks:Object.keys(value.weeks).length,tasks:Object.values(value.weeks).reduce((n,w)=>n+w.tasks.length,0),history:(value.taskHistory||[]).length,...Object.fromEntries(Object.keys(names).map(name=>[name,Array.isArray(value[name])?value[name].length:null]))});
  const [originalFile,restoredFile]=await Promise.all([fingerprint(originalRaw),fingerprint(restoredRaw)]);
  return {kind:'backup-file-comparison',version:1,original:{...originalFile,backupVersion:original.version??'legacy',counts:counts(original)},restored:{...restoredFile,backupVersion:restored.version??'legacy',counts:counts(restored)},preserved:sections.every(s=>s.preserved),identical:sections.every(s=>s.identical),sections,scope:'Compares original stored values and included collections. Added fields/entries are reported separately. Export metadata and collections absent from the original are excluded. File comparison does not prove cloud or server recovery.'};
 }
 async function rehearse(raw){
  const data=root.WeekwiseData.parseBackup(raw),expected=entries(data),values=new Map(),memory={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  root.WeekwiseData.commitStorage(memory,expected,'isolated-pre-restore');
  const store=root.WeekwiseData.parseStore(memory.getItem('weekwise-planner-v2'));
  for(const [name,key]of Object.entries(names))if(Array.isArray(data[name]))root.WeekwiseData.validateCollection(JSON.parse(memory.getItem(key)),name);
  if(expected.some(([key,value])=>memory.getItem(key)!==value))throw new Error('Rehearsal did not preserve the complete restored entries.');
  return {kind:'isolated-backup-rehearsal',version:1,backupVersion:data.version??'legacy',...await fingerprint(raw),weeks:Object.keys(store.weeks).length,tasks:Object.values(store.weeks).reduce((n,w)=>n+w.tasks.length,0),history:(store.taskHistory||[]).length,collections:Object.fromEntries(Object.keys(names).map(name=>[name,Array.isArray(data[name])?data[name].length:null])),roundtripEqual:true,scope:'In-memory restore only. Planner, account, cloud and existing checkpoints were not changed.'};
 }
 root.WeekwiseRecovery=Object.freeze({entries,rehearse,compare,keys:Object.freeze(['weekwise-planner-v2',...Object.values(names)])});
})(typeof window!=='undefined'?window:globalThis);
