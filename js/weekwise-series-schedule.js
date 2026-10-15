/* Previewed future-series scheduling. Saved history and independent edits win. */
(function(root){
 'use strict';const copy=value=>JSON.parse(JSON.stringify(value)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const day=key=>Date.parse(key+'T00:00:00Z')/86400000,key=n=>new Date(n*86400000).toISOString().slice(0,10);
 const records=store=>Object.entries(store.weeks).flatMap(([week,value])=>value.tasks.map(task=>({week,task})));
 function dateAt(anchor,index,frequency){
  const date=new Date(anchor+'T00:00:00Z'),y=date.getUTCFullYear(),m=date.getUTCMonth(),d=date.getUTCDate();
  if(frequency==='daily'||frequency==='weekly')return key(day(anchor)+index*(frequency==='daily'?1:7));
  const month=frequency==='monthly'?m+index:m,year=frequency==='yearly'?y+index:y;
  const first=new Date(Date.UTC(year,month,1)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  first.setUTCDate(Math.min(d,last));return first.toISOString().slice(0,10);
 }
 function interval(record){const t=record.task,a=(day(record.week)+t.day)*1440;return t.allDay?[a,a+1440]:t.start!=null&&!t.unscheduled?[a+t.start,a+t.start+(t.duration||0)]:null;}
 function preview(store,request){
  root.WeekwiseData.validateStore(store);
  const {seriesId,fromDate,newStartDate,frequency,start,duration,endDate=null,allDay=false,zone=store.settings.timeZone||'UTC',createdAt=new Date().toISOString()}=request||{};
  if(!root.WeekwiseData.validDate(fromDate)||!root.WeekwiseData.validDate(newStartDate)||!['daily','weekly','monthly','yearly'].includes(frequency)||(start!==null&&(!Number.isInteger(start)||start<0||start>=1440))||!Number.isInteger(duration)||duration<1||duration>1440||(endDate!==null&&(!root.WeekwiseData.validDate(endDate)||endDate<newStartDate))||typeof allDay!=='boolean')throw new Error('Review the recurring date, cadence, time and duration.');
  if(!Number.isFinite(Date.parse(createdAt)))throw new Error('Invalid preview timestamp.');
  const current=root.WeekwiseTimeZones.zonedParts(Date.parse(createdAt),zone),today=String(current[0]).padStart(4,'0')+'-'+String(current[1]).padStart(2,'0')+'-'+String(current[2]).padStart(2,'0');if(newStartDate<today)throw new Error('Future recurring changes cannot start in the past.');
  const rule=store.recurringTemplates?.find(rule=>rule.id===seriesId);if(!rule)throw new Error('This recurring rule is no longer available.');
  const all=records(store),eligible=[],skipped={completed:0,customized:0},blocked=[];
  for(const record of all){const t=record.task;if(t.seriesId!==seriesId||!t.occurrenceDate||t.occurrenceDate<fromDate)continue;
   if(t.done||t.status==='done'||t.status==='in-progress'||t.subtasks?.some(sub=>sub.done)){skipped.completed++;continue;}
   const independentHistory=t.reschedulingHistory?.length&&t.recurringScheduleRevision!==rule.scheduleRevision;
   const metadataChanged=root.WeekwiseRecurringBulk.FIELDS.some(field=>!same(t[field]??(['tags','attachments'].includes(field)?[]:null),rule[field]??(['tags','attachments'].includes(field)?[]:null)));
   if(t.fixed||t.recurrenceOverride||independentHistory||t.parentTaskId||t.planningChildren?.length||metadataChanged||t.start!==rule.start||t.duration!==rule.duration||!!t.allDay!==!!rule.allDay){skipped.customized++;continue;}
   const expectedDue=rule.dueOffsetDays==null?null:key(day(t.occurrenceDate)+rule.dueOffsetDays);
   const expectedReminders=(rule.reminderRules||[]).map(r=>key(day(t.occurrenceDate)+r.offsetDays)+'T'+r.time);
   if((t.dueDate||null)!==expectedDue||!same(t.reminderTimes||[],expectedReminders)||(t.reminderNotifiedTimes||[]).length||t.reminderNotifiedAt){skipped.customized++;continue;}
   eligible.push(record);
  }
  eligible.sort((a,b)=>a.task.occurrenceDate.localeCompare(b.task.occurrenceDate)||a.task.id.localeCompare(b.task.id));
  const moving=new Set(eligible.map(r=>r.week+'::'+r.task.id)),reserved=all.filter(r=>!moving.has(r.week+'::'+r.task.id)),changes=[];
  const occupiedDates=new Set(reserved.filter(r=>r.task.seriesId===seriesId).map(r=>r.task.occurrenceDate));
  const excluded=new Set(rule.excludedDates||[]);let index=0;
  for(const record of eligible){
   let date,tries=0;do{date=dateAt(newStartDate,index++,frequency);if(++tries>20000)throw new Error('Too many protected recurring dates.');}while(occupiedDates.has(date)||excluded.has(date));
   if(endDate&&date>endDate){blocked.push(record.task.title+': the end date leaves no occurrence for this saved task.');continue;}
   const epochDay=day(date),weekday=new Date(date+'T00:00:00Z').getUTCDay(),week=key(epochDay-weekday),delta=epochDay-day(record.task.occurrenceDate);
   const task=copy(record.task);Object.assign(task,{day:weekday,start:allDay?null:start,duration,allDay,allDayDate:allDay?date:null,unscheduled:!allDay&&start===null,occurrenceDate:date,recurrence:frequency});
   if(task.dueDate)task.dueDate=key(day(task.dueDate)+delta);
   task.reminderTimes=(task.reminderTimes||[]).map(value=>key(day(value.slice(0,10))+delta)+value.slice(10));task.reminderAt=task.reminderTimes[0]||null;
   const projected={week,task},span=interval(projected);
   if(span&&reserved.concat(changes.map(change=>({week:change.toWeek,task:change.task}))).some(other=>{const otherSpan=interval(other);return otherSpan&&span[0]<otherSpan[1]&&otherSpan[0]<span[1];}))blocked.push(task.title+': the new slot overlaps a retained activity.');
   if(start!==null&&!allDay){try{
    const wall=(date,minute)=>{const d=new Date((day(date)+Math.floor(minute/1440))*86400000),m=minute%1440;return root.WeekwiseTimeZones.wallTimeInZone({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:Math.floor(m/60),minute:m%60},zone);};
    const begin=wall(date,start),end=wall(date,start+duration);
    if((end-begin)/60000!==duration)throw new Error('duration crosses a daylight-saving discontinuity');
    if(begin.getTime()<=Date.parse(createdAt))throw new Error('the proposed time has already passed');
   }catch(error){blocked.push(task.title+': '+error.message);}}
   if(reserved.some(other=>other.week===week&&other.task.id===task.id)||changes.some(other=>other.toWeek===week&&other.id===task.id))blocked.push(task.title+': identity already exists in its destination week.');
   changes.push({week:record.week,id:task.id,before:JSON.stringify(record.task),toWeek:week,date,task});occupiedDates.add(date);
  }
  const nextRule={...copy(rule),startDate:newStartDate,frequency,start:allDay?null:start,duration,allDay,endDate,updatedAt:createdAt,scheduleRevision:(Number(rule.scheduleRevision)||0)+1};
  return {request:{seriesId,fromDate,newStartDate,frequency,start,duration,endDate,allDay,zone,createdAt},ruleBefore:JSON.stringify(rule),nextRule,changes,skipped,blocked};
 }
 function apply(store,plan){
  const verified=preview(store,plan?.request);if(!same(plan,verified))throw new Error('The recurring preview changed. Build it again.');
  if(plan.blocked.length)throw new Error('Resolve every blocked recurring placement before applying.');
  const next=copy(store);
  for(const change of plan.changes)next.weeks[change.week].tasks=next.weeks[change.week].tasks.filter(task=>task.id!==change.id);
  for(const change of plan.changes){const task=copy(change.task),before=JSON.parse(change.before);
   task.recurringScheduleRevision=plan.nextRule.scheduleRevision;
   task.reschedulingHistory=[...(before.reschedulingHistory||[]),{fromWeek:change.week,fromDay:before.day,fromStart:before.start,fromDuration:before.duration,toWeek:change.toWeek,toDay:task.day,toStart:task.start,changedAt:plan.request.createdAt,reason:'User-approved recurring schedule'}];
   if(!next.weeks[change.toWeek])next.weeks[change.toWeek]={tasks:[]};next.weeks[change.toWeek].tasks.push(task);
  }
  next.recurringTemplates[next.recurringTemplates.findIndex(rule=>rule.id===plan.request.seriesId)]=copy(plan.nextRule);
  root.WeekwiseData.validateStore(next);return next;
 }
 root.WeekwiseSeriesSchedule=Object.freeze({preview,apply,dateAt});
})(typeof window!=='undefined'?window:globalThis);
