/* Editor clock arithmetic and date-aware placement over canonical records. */
(function(root){
 'use strict';const model=()=>root.WeekwiseCalendarRange;
 function duration(start,end,nextDay=false){
  if(!Number.isInteger(start)||start<0||start>=1440||!Number.isInteger(end)||end<0||end>1440)throw new Error('Enter valid 24-hour start and end times.');
  const result=end+(nextDay?1440:0)-start;
  if(result<1||result>1440)throw new Error('Choose an end after the start, within 24 hours. Select next day for an overnight activity.');
  return result;
 }
 function placement(store,{week,id=null,day,start,duration:minutes,breakAfter=0,exact=null}){
  root.WeekwiseData.validateStore(store);breakAfter=root.WeekwiseTaskOptions.breakAfter(breakAfter);if(!Number.isInteger(day)||day<0||day>6||!Number.isInteger(start)||start<0||start>=1440||!Number.isInteger(minutes)||minutes<1||minutes>1440)throw new Error('Choose a valid activity of at most 24 hours.');
  const zone=store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone,date=model().key(model().ordinal(week)+day),rows=model().project(store,zone),original=rows.find(r=>r.week===week&&r.task.id===id);
  // Metadata-only edits never reschedule a retained legacy event, including
  // existing overlap or a time that still needs an explicit DST review.
  if(original&&!original.task.allDay&&!original.task.unscheduled&&original.task.day===day&&original.task.start===start&&original.task.duration===minutes&&root.WeekwiseTaskOptions.breakAfter(original.task.breakAfter)===breakAfter)return {start,scheduleInstant:original.task.scheduleInstant};
  const makeSlot=candidate=>{
   if(exact&&exact.week===week&&exact.day===day&&exact.start===candidate&&exact.duration===minutes)return exact;
   return model().slot(date,candidate,minutes,zone,zone);
  };
  const occupied=rows.filter(r=>!(r.week===week&&r.task.id===id));
  const free=slot=>{
   const span=slot.scheduleInstant,first=model().parts(span.start,zone).date,last=model().parts(span.end-1,zone).date;
   return !occupied.some(other=>(other.instant&&span.start<other.instant.end+root.WeekwiseTaskOptions.breakAfter(other.task.breakAfter)*60000&&other.instant.start<span.end+breakAfter*60000)||(other.allDay&&model().ordinal(other.date)<=model().ordinal(last)&&model().ordinal(other.date)+Math.max(1,Math.ceil((other.duration||0)/1440))>model().ordinal(first))||(other.zoneError&&model().ordinal(other.date)>=model().ordinal(first)-1&&model().ordinal(other.date)<=model().ordinal(last)+1));
  };
  const preferred=makeSlot(start);if(free(preferred))return preferred;
   if(original&&original.task.day===day&&original.task.start===start&&original.task.duration===minutes)throw new Error('The requested recovery break overlaps another activity. Choose a shorter break or a new start time; nothing changed.');
  if(start+minutes>1440)throw new Error('This overnight time overlaps another activity. Choose a different start or end; nothing was changed.');
  const candidates=[];for(let value=0;value+minutes<=1440;value+=15)if(value!==start)candidates.push(value);candidates.sort((a,b)=>Math.abs(a-start)-Math.abs(b-start));
  for(const candidate of candidates){let slot;try{slot=makeSlot(candidate);}catch(_){continue;}if(free(slot))return slot;}
  return {start:null};
 }
 root.WeekwiseTaskSchedule=Object.freeze({duration,placement});
})(typeof window!=='undefined'?window:globalThis);
