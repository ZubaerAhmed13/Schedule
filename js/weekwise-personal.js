/* Personal calendar tools derive from the owner's canonical planner. */
(function(root){
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 function history(store,query=''){
  const names=new Map(),q=String(query).trim().toLocaleLowerCase();
  const add=(task,date)=>{const title=String(task.title||'').trim(),key=title.toLocaleLowerCase();if(!title||q&&!key.includes(q))return;const prior=names.get(key),stamp=String(task.updatedAt||task.createdAt||date);if(prior){prior.count++;if(stamp>prior.last){prior.title=title;prior.last=stamp;}}else names.set(key,{title,count:1,last:stamp});};
  for(const [week,value] of Object.entries(store.weeks))for(const task of value.tasks)add(task,root.WeekwisePlanning.dateAt(week,task.day));
  for(const entry of store.taskHistory||[])if(entry.kind==='archive')for(const item of entry.items)add(item.task,entry.createdAt);
  return [...names.values()].sort((a,b)=>b.last.localeCompare(a.last)||b.count-a.count||a.title.localeCompare(b.title)).slice(0,8);
 }
 function duplicate(store,ref,{date,start,zone,id,now=new Date().toISOString()}){
  root.WeekwiseData.validateStore(store);
  const original=store.weeks[ref.week]?.tasks.find(task=>task.id===ref.id);
  if(!original)throw new Error('The source activity is no longer available.');
  if(!id||Object.values(store.weeks).some(value=>value.tasks.some(task=>task.id===id)))throw new Error('Choose a new activity identity.');
  if(!root.WeekwiseData.validDate(date))throw new Error('Choose a valid destination date.');
  const task=clone(original);
  for(const field of ['seriesId','recurrence','occurrenceDate','recurrenceOverride','recurrenceScheduleReview','scheduleInstant','reschedulingHistory','calendarProvider','calendarEventId','providerEventId','externalEventId','googleEventId','outlookEventId','planningParent','planningParentId','planningChildren','parentTaskId','reminderAt','reminderTimes','reminderInstants','reminderNotifiedTimes','notifiedAt','allDayDate'])delete task[field];
  task.id=id;task.fixed=false;task.workday=false;task.cityday=false;task.custom=true;task.done=false;task.status='todo';task.todayPriority=false;task.createdAt=now;task.updatedAt=now;task.recurrence='none';task.copiedFrom={week:ref.week,id:ref.id,at:now};
  if(Array.isArray(task.subtasks))task.subtasks=task.subtasks.map((sub,index)=>typeof sub==='string'?{id:id+'-sub-'+index,title:sub,done:false}:{...sub,id:id+'-sub-'+index,taskId:undefined,done:false});
  const next=clone(store),projected=root.WeekwiseCalendarRange.project(store,zone);
  if(original.allDay){
   const days=Math.max(1,Math.ceil((original.duration||1440)/1440)),begin=root.WeekwiseCalendarRange.ordinal(date),end=begin+days;
   if(projected.some(record=>{if(record.task.unscheduled&&!record.allDay)return false;const a=root.WeekwiseCalendarRange.ordinal(record.date),b=record.allDay?a+Math.max(1,Math.ceil(record.duration/1440)):root.WeekwiseCalendarRange.ordinal(record.endDate||record.date)+(record.endMinute===0?0:1);return a<end&&b>begin;}))throw new Error('The destination overlaps an activity. Choose a clear day.');
   const week=root.WeekwiseCalendarRange.range(date)[0];Object.assign(task,{day:begin-root.WeekwiseCalendarRange.ordinal(week),start:null,allDay:true,allDayDate:date,unscheduled:false});
   (next.weeks[week]||(next.weeks[week]={tasks:[]})).tasks.push(task);return root.WeekwiseData.validateStore(next);
  }
  const source=projected.find(record=>record.week===ref.week&&record.task.id===ref.id);
  if(source.zoneError)throw new Error('Review the original clock time before copying this activity.');
  task.duration=source.instant?(source.instant.end-source.instant.start)/60000:original.duration||30;task.start=null;task.unscheduled=true;task.allDay=false;
  next.weeks[ref.week].tasks.push(task);
  const placed=root.WeekwiseCalendarRange.move(next,{week:ref.week,id},date,start,zone);
  for(const week of Object.values(placed.weeks)){const added=week.tasks.find(t=>t.id===id);if(added)delete added.reschedulingHistory;}
  return root.WeekwiseData.validateStore(placed);
 }
 function summary(store,anchor,focusSessions=[],habits=[],now=Date.now()){
  const week=root.WeekwiseCalendarRange.range(anchor,1)[0],end=root.WeekwisePlanning.dateAt(week,7),zone=store.settings.timeZone||'UTC';
  const records=Object.entries(store.weeks).flatMap(([key,value])=>value.tasks.map(task=>({week:key,task,dateKey:root.WeekwisePlanning.dateAt(key,task.day)})));
  const rows=records.filter(record=>record.dateKey>=week&&record.dateKey<end),timed=rows.filter(r=>r.task.start!=null&&!r.task.unscheduled&&!r.task.allDay);
  const done=timed.filter(r=>r.task.done||r.task.status==='done'),unfinished=timed.filter(r=>!r.task.done&&r.task.status!=='done'&&r.task.requiresCompletion!==false);
  let past=0,ahead=0,reviews=0;
  for(const record of unfinished){try{const stop=root.WeekwiseCalendarRange.instant(record,zone).end;if(stop<=now)past+=record.task.duration||0;else ahead+=record.task.duration||0;}catch(_){reviews++;}}
  const sessions=focusSessions.filter(s=>{const day=root.WeekwiseInsights.localDay(s.endedAt,zone);return day&&day>=week&&day<end;});
  const workload=root.WeekwiseInsights.weekly(records,week,focusSessions,zone),previous=root.WeekwiseInsights.weekly(records,root.WeekwisePlanning.dateAt(week,-7),focusSessions,zone);
  const days=workload.days.map(day=>({...day,planned:timed.filter(r=>r.dateKey===day.date).reduce((n,r)=>n+(r.task.duration||0),0),done:done.filter(r=>r.dateKey===day.date).reduce((n,r)=>n+(r.task.duration||0),0)}));
  return {week,end,rows,timed,done,past,ahead,reviews,days,planned:timed.reduce((n,r)=>n+(r.task.duration||0),0),completed:done.reduce((n,r)=>n+(r.task.duration||0),0),occupied:workload.totalMinutes,previousOccupied:previous.totalMinutes,focus:sessions.reduce((n,s)=>n+Number(s.seconds!=null?s.seconds/60:s.minutes||0),0),sessions:sessions.length,backlog:rows.filter(r=>r.task.unscheduled||r.task.start==null&&!r.task.allDay).length,habits:habits.map(h=>({title:h.title,count:(h.checkIns||[]).filter(day=>day>=week&&day<end).length,target:root.WeekwiseHabits.target(h),paused:!!h.paused})),categories:['workday','job','study','language','life','hobby','other'].map(type=>({type,planned:timed.filter(r=>(r.task.workday||/^work day$|^Picnic work shift$/i.test(r.task.title)?'workday':['job','study','language','life','hobby'].includes(r.task.type)?r.task.type:'other')===type).reduce((n,r)=>n+(r.task.duration||0),0),done:done.filter(r=>(r.task.workday||/^work day$|^Picnic work shift$/i.test(r.task.title)?'workday':['job','study','language','life','hobby'].includes(r.task.type)?r.task.type:'other')===type).reduce((n,r)=>n+(r.task.duration||0),0)}))};
 }
 root.WeekwisePersonal=Object.freeze({history,duplicate,summary});
})(typeof window!=='undefined'?window:globalThis);
