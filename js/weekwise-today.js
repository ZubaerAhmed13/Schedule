/* Read-only daily decisions in the saved planner zone, retaining canonical references. */
(function(root){
 'use strict';
 function clock(store,epoch=Date.now()){return {...root.WeekwisePlanning.planningClock(store,epoch),epoch};}
 function occursOn(record,date){const task=record.task,source=record.dateKey||root.WeekwisePlanning.dateAt(record.week,task.day);if(source===date)return true;if(task.allDay)return source<date&&root.WeekwisePlanning.dateAt(source,Math.max(1,Math.ceil((task.duration||0)/1440)))>date;return !task.unscheduled&&task.start!=null&&source===root.WeekwisePlanning.dateAt(date,-1)&&Number(task.start)+Number(task.duration)>1440;}
 function daily(records,store,epoch=Date.now()){
  const current=clock(store,epoch),priorDate=root.WeekwisePlanning.dateAt(current.date,-1),timed=[],review=[];
  for(const record of records){
   const task=record.task,date=record.dateKey||root.WeekwisePlanning.dateAt(record.week,task.day);
   if(task.allDay||task.unscheduled||task.start==null||!(task.duration>0))continue;
   // Only nearby source dates can carry into today; keep large archives inexpensive.
   if(date<priorDate||date>current.date)continue;
   try{
    const span=root.WeekwiseCalendarRange.instant(record,current.zone),begin=root.WeekwiseCalendarRange.parts(span.start,current.zone),end=root.WeekwiseCalendarRange.parts(span.end,current.zone);
    if(begin.date>current.date||end.date<current.date||(end.date===current.date&&end.minute===0))continue;
    timed.push({...record,start:begin.date<current.date?0:begin.minute,end:end.date>current.date?1440:end.minute,instant:span,carried:begin.date<current.date});
   }catch(error){if(date===current.date)review.push({...record,reason:error.message});}
  }
  timed.sort((a,b)=>a.instant.start-b.instant.start);
  const next=timed.find(r=>!r.task.done&&r.task.status!=='done'&&r.instant.end>epoch);
  const scheduled=root.WeekwisePlanning.merge(timed.map(r=>[r.start,r.end])).reduce((total,[a,b])=>total+b-a,0);
  return {...current,timed,review,next,scheduled};
 }
 root.WeekwiseToday=Object.freeze({clock,daily,occursOn});
})(typeof window!=='undefined'?window:globalThis);
