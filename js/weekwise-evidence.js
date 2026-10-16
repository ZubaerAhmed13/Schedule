/* Device-only evidence: bounded numeric samples and explicit human confirmations. */
(function(root){
 'use strict';
 const views=['today','tomorrow','inbox','upcoming','search','calendar','plan','insights','settings','board','matrix','filters','list','folder','tag'];
 const checks=['closed-push','installed-offline','phone-keyboard','two-device','screen-reader','zoom-keyboard','real-backup'];
 const key=(kind,owner)=>{if(typeof owner!=='string'||!owner||owner.length>1000)throw new Error('Choose an account or device planner.');return 'weekwise-'+kind+'-v1:'+encodeURIComponent(owner);};
 const numeric=(n,max)=>n===null||typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
 const exact=(value,names)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>names.includes(k));
 function sample(value){
  if(!exact(value,['id','day','build','viewport','lcp','inp','cls','navigation'])||typeof value.id!=='string'||!value.id||value.id.length>100||!root.WeekwiseData.validDate(value.day)||typeof value.build!=='string'||value.build.length>80||!['phone','desktop'].includes(value.viewport)||!numeric(value.lcp,300000)||!numeric(value.inp,60000)||!numeric(value.cls,100)||!Array.isArray(value.navigation)||value.navigation.length>50)throw new Error('Saved performance evidence needs review.');
  for(const n of value.navigation)if(!exact(n,['view','ms'])||!views.includes(n.view)||!numeric(n.ms,300000)||n.ms===null)throw new Error('Saved navigation evidence needs review.');
  return value;
 }
 function read(storage,owner){
  const name=key('performance',owner),raw=storage.getItem(name);let value;
  try{value=raw===null?{version:1,enabled:false,generation:0,samples:[]}:JSON.parse(raw);}catch(_){throw new Error('Saved performance evidence cannot be read. It was retained.');}
  if(!exact(value,['version','enabled','generation','samples'])||value.version!==1||typeof value.enabled!=='boolean'||!Number.isSafeInteger(value.generation)||value.generation<0||!Array.isArray(value.samples)||value.samples.length>80)throw new Error('Saved performance evidence needs review.');
  value.samples.forEach(sample);return {name,raw,value};
 }
 function write(storage,entry,value){if(storage.getItem(entry.name)!==entry.raw)throw new Error('Another tab changed the device evidence. Refresh this panel.');storage.setItem(entry.name,JSON.stringify(value));return value;}
 function recording(storage,owner,enabled){const entry=read(storage,owner);return write(storage,entry,{...entry.value,enabled:!!enabled,generation:entry.value.generation+1});}
 function put(storage,owner,generation,row){
  sample(row);const entry=read(storage,owner);if(!entry.value.enabled||entry.value.generation!==generation)return false;
  const rows=entry.value.samples.filter(s=>s.id!==row.id);rows.push(JSON.parse(JSON.stringify(row)));write(storage,entry,{...entry.value,samples:rows.slice(-80)});return true;
 }
 function clear(storage,owner){const entry=read(storage,owner);return write(storage,entry,{version:1,enabled:false,generation:entry.value.generation+1,samples:[]});}
 function percentile(values){if(!values.length)return null;const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.ceil(sorted.length*.75)-1];}
 function summary(value,viewport,build){
  const rows=value.samples.filter(s=>s.viewport===viewport&&s.build===build),metric=name=>{const values=rows.map(s=>s[name]).filter(n=>n!==null);return {samples:values.length,p75:percentile(values)};};
  return {viewport,build,pageSamples:rows.length,lcp:metric('lcp'),inp:metric('inp'),cls:metric('cls'),navigation:views.map(view=>{const values=rows.flatMap(s=>s.navigation.filter(n=>n.view===view).map(n=>n.ms));return {view,samples:values.length,p75:percentile(values)};}).filter(s=>s.samples)};
 }
 function readChecks(storage,owner){
  const name=key('device-checks',owner),raw=storage.getItem(name);let value;
  try{value=raw===null?{version:1,checks:{}}:JSON.parse(raw);}catch(_){throw new Error('Saved device confirmations cannot be read. They were retained.');}
  if(!exact(value,['version','checks'])||value.version!==1||!value.checks||typeof value.checks!=='object'||Array.isArray(value.checks)||Object.keys(value.checks).some(k=>!checks.includes(k)))throw new Error('Saved device confirmations need review.');
  for(const v of Object.values(value.checks))if(!exact(v,['confirmed','day','build'])||typeof v.confirmed!=='boolean'||!root.WeekwiseData.validDate(v.day)||typeof v.build!=='string'||v.build.length>80)throw new Error('Saved device confirmations need review.');
  return {name,raw,value};
 }
 function check(storage,owner,id,confirmed,day,build){if(!checks.includes(id)||typeof confirmed!=='boolean'||!root.WeekwiseData.validDate(day)||typeof build!=='string'||build.length>80)throw new Error('Invalid device confirmation.');const e=readChecks(storage,owner);return write(storage,e,{version:1,checks:{...e.value.checks,[id]:{confirmed,day,build}}});}
 function checkSummary(saved,build){const current=checks.filter(id=>saved[id]?.confirmed&&saved[id].build===build).length,previous=checks.filter(id=>saved[id]?.confirmed&&saved[id].build!==build).length;return {current,previous,total:checks.length,remaining:checks.length-current};}
 function exportPerformance(value){return {kind:'private-device-performance',version:1,method:'web-vitals 6.1.0; local samples, not a public field score',samples:value.samples.map(({id,...row})=>row)};}
 root.WeekwiseEvidence=Object.freeze({key,read,recording,put,clear,summary,percentile,readChecks,check,checkSummary,exportPerformance,views});
})(typeof window!=='undefined'?window:globalThis);
