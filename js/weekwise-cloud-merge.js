/* Reconcile independent records against the last acknowledged cloud copy. */
(function(root){
'use strict';
const missing=Symbol('missing');
const object=value=>value!==missing&&value!==null&&typeof value==='object'&&!Array.isArray(value);
function canonical(value){return value===missing?missing:JSON.stringify(value,(_,v)=>object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
const equal=(a,b)=>canonical(a)===canonical(b);
function copy(value){return value===missing?missing:JSON.parse(JSON.stringify(value));}
function records(value){return Array.isArray(value)&&value.every(v=>object(v)&&typeof v.id==='string'&&v.id.length)&&new Set(value.map(v=>v.id)).size===value.length;}
function combine(base,local,remote,atomic=false){
 if(equal(local,remote))return copy(local);
 if(equal(local,base))return copy(remote);
 if(equal(remote,base))return copy(local);
 if(atomic||local===missing||remote===missing)throw new Error('Conflicting change');
 if(records(local)&&records(remote)&&(records(base)||base===missing)){
  const previous=base===missing?[]:base,maps=[previous,local,remote].map(rows=>new Map(rows.map(v=>[v.id,v]))),merged=new Map();
  for(const id of new Set([...maps[0].keys(),...maps[1].keys(),...maps[2].keys()])){const value=combine(...maps.map(m=>m.has(id)?m.get(id):missing),true);if(value!==missing)merged.set(id,value);}
  const common=previous.map(v=>v.id).filter(id=>maps[1].has(id)&&maps[2].has(id));
  const order=rows=>rows.map(v=>v.id).filter(id=>common.includes(id)),oldOrder=JSON.stringify(common),localOrder=JSON.stringify(order(local)),remoteOrder=JSON.stringify(order(remote));
  if(localOrder!==oldOrder&&remoteOrder!==oldOrder&&localOrder!==remoteOrder)throw new Error('Conflicting order');
  const preferred=localOrder!==oldOrder?local:remote,ids=[...new Set([...preferred,...local,...remote].map(v=>v.id))];
  return ids.filter(id=>merged.has(id)).map(id=>merged.get(id));
 }
 if(object(local)&&object(remote)&&(object(base)||base===missing)){
  const old=base===missing?{}:base,result=Object.create(null);
  for(const key of new Set([...Object.keys(old),...Object.keys(local),...Object.keys(remote)])){
   const value=combine(...[old,local,remote].map(v=>Object.prototype.hasOwnProperty.call(v,key)?v[key]:missing));
   if(value!==missing)result[key]=value;
  }
  return result;
 }
 throw new Error('Conflicting change');
}
function merge(base,local,remote){
 try{
  const payload=combine(base,local,remote),ids=new Set(),occurrences=new Set();
  for(const week of Object.values(payload.store?.weeks||{}))for(const task of week.tasks||[]){
   if(ids.has(task.id))throw new Error('Duplicate task');ids.add(task.id);
   if(task.seriesId&&task.occurrenceDate){const key=task.seriesId+'::'+task.occurrenceDate;if(occurrences.has(key))throw new Error('Duplicate occurrence');occurrences.add(key);}
  }
  return {merged:true,payload};
 }catch(_){return {merged:false};}
}
root.WeekwiseCloudMerge=Object.freeze({merge,fingerprint:canonical});
})(typeof window!=='undefined'?window:globalThis);
