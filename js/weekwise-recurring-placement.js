/* Indexed occupancy for generated occurrences. Existing records remain read-only. */
(function(root){
 'use strict';
 function create(store){
  const model=root.WeekwiseCalendarRange,zone=store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone,days=new Map();
  function index(record){
   if(!record.allDay&&!record.zoneError&&(!record.instant||record.instant.end<=record.instant.start))return;
   const first=model.ordinal(record.date)-(record.zoneError?1:0),last=record.zoneError?first+2:record.allDay?first+Math.max(1,Math.ceil((record.duration||0)/1440))-1:model.ordinal(model.parts(record.instant.end+(root.WeekwiseTaskOptions?.breakAfter||(()=>0))(record.task.breakAfter)*60000-1,zone).date);
   for(let day=first;day<=last;day++){const key=model.key(day);if(!days.has(key))days.set(key,new Set());days.get(key).add(record);}
  }
  model.project(store,zone).forEach(index);
  function add({week,task}){model.project({settings:store.settings,weeks:{[week]:{tasks:[task]}}},zone).forEach(index);}
  function free(slot,breakAfter=0){
    const span=slot.scheduleInstant,buffer=(root.WeekwiseTaskOptions?.breakAfter||(()=>0))(breakAfter)*60000,first=model.ordinal(model.parts(span.start,zone).date),last=model.ordinal(model.parts(span.end+buffer-1,zone).date),records=new Set();
    for(let day=first;day<=last;day++)for(const item of days.get(model.key(day))||[])records.add(item);
    return ![...records].some(other=>other.allDay||other.zoneError||other.instant&&span.start<other.instant.end+(root.WeekwiseTaskOptions?.breakAfter||(()=>0))(other.task.breakAfter)*60000&&other.instant.start<span.end+buffer);
  }
  function place(date,preferred,duration,breakAfter=0){
   if(preferred==null)return {start:null};
   const review=reason=>({start:null,review:{date,zone,preferred,duration,reason}});
   let requested;try{requested=model.slot(date,preferred,duration,zone,zone);}catch(error){return review(error.message);}

   if(free(requested,breakAfter))return requested;
   if(preferred+duration>1440)return review('The recurring overnight slot overlaps another activity. Review this occurrence; its expected hours were not shifted.');
   const candidates=[];for(let start=0;start+duration<=1440;start+=15)if(start!==preferred)candidates.push(start);candidates.sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred));
   for(const start of candidates){let slot;try{slot=model.slot(date,start,duration,zone,zone);}catch(_){continue;}if(free(slot,breakAfter))return slot;}
   return review('No free slot fits this recurring occurrence. Choose its hours explicitly.');
  }
  function placeRule(template,date){
   const preferred=template.start==null?null:Number(template.start),duration=Math.max(10,Number(template.duration)||30),breakAfter=(root.WeekwiseTaskOptions?.breakAfter||(()=>0))(template.breakAfter),sourceZone=template.timeZone||zone;
      if(sourceZone===zone||template.allDay||preferred===null)return {...place(date,template.allDay?null:preferred,duration,breakAfter),week:model.range(date)[0],day:new Date(date+'T00:00:00Z').getUTCDay(),duration};
   try{
    const start=model.wall(date,preferred,sourceZone),end=model.wall(date,preferred+duration,sourceZone);
    if((end-start)/60000!==duration)throw new Error('The recurring source interval crosses a clock change.');
    const begin=model.parts(start,zone),finish=model.parts(end,zone),day=new Date(begin.date+'T00:00:00Z').getUTCDay(),week=model.key(model.ordinal(begin.date)-day),wallMinutes=(model.ordinal(finish.date)-model.ordinal(begin.date))*1440+finish.minute-begin.minute,span={start,end},minutes=wallMinutes>0?wallMinutes:duration;
    const requested={week,day,start:begin.minute,duration:minutes,scheduleInstant:{...span,anchor:{week,day,start:begin.minute,duration:minutes,zone}}};
    if(!free(requested,breakAfter))return {...requested,start:null,scheduleInstant:undefined,review:{date:begin.date,zone,preferred:begin.minute,duration:minutes,sourceZone,reason:'The original-zone recurring instant overlaps another activity. Choose reviewed hours.'}};
    return requested;
   }catch(error){return {week:model.range(date)[0],day:new Date(date+'T00:00:00Z').getUTCDay(),start:null,duration,review:{date,zone,preferred,duration,sourceZone,reason:error.message}};}
  }
  return Object.freeze({place,placeRule,add});
 }
 root.WeekwiseRecurringPlacement=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
