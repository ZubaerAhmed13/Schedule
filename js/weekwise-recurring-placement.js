/* Indexed occupancy for generated occurrences. Existing records remain read-only. */
(function(root){
 'use strict';
 function create(store){
  const model=root.WeekwiseCalendarRange,zone=store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone,days=new Map();
  function index(record){
   if(!record.allDay&&!record.zoneError&&(!record.instant||record.instant.end<=record.instant.start))return;
   const first=model.ordinal(record.date)-(record.zoneError?1:0),last=record.zoneError?first+2:record.allDay?first+Math.max(1,Math.ceil((record.duration||0)/1440))-1:model.ordinal(model.parts(record.instant.end-1,zone).date);
   for(let day=first;day<=last;day++){const key=model.key(day);if(!days.has(key))days.set(key,new Set());days.get(key).add(record);}
  }
  model.project(store,zone).forEach(index);
  function add({week,task}){model.project({settings:store.settings,weeks:{[week]:{tasks:[task]}}},zone).forEach(index);}
  function place(date,preferred,duration){
   if(preferred==null)return {start:null};
   const review=reason=>({start:null,review:{date,zone,preferred,duration,reason}});
   let requested;try{requested=model.slot(date,preferred,duration,zone,zone);}catch(error){return review(error.message);}
   const free=slot=>{
    const span=slot.scheduleInstant,first=model.ordinal(model.parts(span.start,zone).date),last=model.ordinal(model.parts(span.end-1,zone).date),records=new Set();
    for(let day=first;day<=last;day++)for(const item of days.get(model.key(day))||[])records.add(item);
    return ![...records].some(other=>other.allDay||other.zoneError||other.instant&&span.start<other.instant.end&&other.instant.start<span.end);
   };
   if(free(requested))return requested;
   if(preferred+duration>1440)return review('The recurring overnight slot overlaps another activity. Review this occurrence; its expected hours were not shifted.');
   const candidates=[];for(let start=0;start+duration<=1440;start+=15)if(start!==preferred)candidates.push(start);candidates.sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred));
   for(const start of candidates){let slot;try{slot=model.slot(date,start,duration,zone,zone);}catch(_){continue;}if(free(slot))return slot;}
   return review('No free slot fits this recurring occurrence. Choose its hours explicitly.');
  }
  return Object.freeze({place,add});
 }
 root.WeekwiseRecurringPlacement=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
