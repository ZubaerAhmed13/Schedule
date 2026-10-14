/* Explicit opt-in operational evidence. Fixed codes only; no error text or identities. */
(function(root){
 'use strict';
 const operations=['sync-save','sync-read','runtime'];
 const outcomes=['success','failed','review'];
 const key=owner=>{if(typeof owner!=='string'||!owner||owner.length>1000)throw new Error('Choose a planner first.');return 'weekwise-diagnostics-v1:'+encodeURIComponent(owner);};
 function read(storage,owner){
  const name=key(owner),raw=storage.getItem(name);let value;
  try{value=raw===null?{version:1,enabled:false,events:[]}:JSON.parse(raw);}catch(_){throw new Error('Saved diagnostics cannot be read. They were retained.');}
  if(!value||Array.isArray(value)||Object.keys(value).some(k=>!['version','enabled','events'].includes(k))||value.version!==1||typeof value.enabled!=='boolean'||!Array.isArray(value.events)||value.events.length>80)throw new Error('Saved diagnostics need review.');
  for(const e of value.events)if(!e||Array.isArray(e)||Object.keys(e).some(k=>!['day','build','operation','outcome','durationMs'].includes(k))||!root.WeekwiseData.validDate(e.day)||typeof e.build!=='string'||!/^(?:development|[a-f0-9]{16})$/.test(e.build)||!operations.includes(e.operation)||!outcomes.includes(e.outcome)||!(e.durationMs===null||Number.isInteger(e.durationMs)&&e.durationMs>=0&&e.durationMs<=300000))throw new Error('Saved diagnostics need review.');
  return {name,raw,value};
 }
 function write(storage,entry,value){if(storage.getItem(entry.name)!==entry.raw)throw new Error('Another tab changed diagnostics. Open this panel again.');storage.setItem(entry.name,JSON.stringify(value));return value;}
 function configure(storage,owner,enabled){const e=read(storage,owner);return write(storage,e,{...e.value,enabled:!!enabled});}
 function clear(storage,owner){const e=read(storage,owner);return write(storage,e,{version:1,enabled:false,events:[]});}
 function record(storage,owner,event){
  const e=read(storage,owner);if(!e.value.enabled)return false;
  if(!operations.includes(event?.operation)||!outcomes.includes(event?.outcome))return false;
  const row={day:new Date().toISOString().slice(0,10),build:typeof event.build==='string'&&/^(?:development|[a-f0-9]{16})$/.test(event.build)?event.build:'development',operation:event.operation,outcome:event.outcome,durationMs:Number.isFinite(event.durationMs)?Math.min(300000,Math.max(0,Math.round(event.durationMs))):null};
  write(storage,e,{...e.value,events:[...e.value.events,row].slice(-80)});return true;
 }
 function summary(value,build){const rows=value.events.filter(e=>e.build===build);return {events:rows.length,success:rows.filter(e=>e.outcome==='success').length,failed:rows.filter(e=>e.outcome==='failed').length,review:rows.filter(e=>e.outcome==='review').length};}
 root.WeekwiseDiagnostics=Object.freeze({key,read,configure,clear,record,summary});
})(typeof window!=='undefined'?window:globalThis);
