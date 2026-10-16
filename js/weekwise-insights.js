/* Review metrics derived from recorded planner history — no guessed actual work time. */
(function(root){'use strict';
 const dateAt=(start,index)=>root.WeekwisePlanning.dateAt(start,index);
 function localDay(iso,zone){
  const t=new Date(iso);if(!Number.isFinite(t.getTime()))return null;
  if(zone)return root.WeekwiseCalendarRange.parts(t.getTime(),zone).date;
  return [t.getFullYear(),String(t.getMonth()+1).padStart(2,'0'),String(t.getDate()).padStart(2,'0')].join('-');
 }
 function sessionsInWeek(sessions,week,zone){const end=dateAt(week,7);return sessions.flatMap(session=>{const ended=typeof session?.endedAt==='string'?localDay(session.endedAt,zone):null,minutes=Number(session?.seconds!=null?Number(session.seconds)/60:session?.minutes);return ended&&ended>=week&&ended<end&&Number.isFinite(minutes)&&minutes>0&&minutes<=1440?[{session,minutes}]:[];});}
 function weekly(records,week,focusSessions=[],zone){
  root.WeekwisePlanning.ordinal(week);
  if(!Array.isArray(records)||!Array.isArray(focusSessions))throw new Error('Invalid Weekwise Insights history.');
  const dates=Array.from({length:7},(_,i)=>dateAt(week,i));
  const windows=new Map(dates.map(date=>[date,[]])),end=dateAt(week,7);
  const uniqueMoves=new Set(),movedTasks=new Set(),recordedTasks=new Map(),tasksById=new Map(),plannedIds=new Set();let committedTotal=0,committedDone=0,dueOnly=0,enteredEstimates=0;
  for(const record of records){
   const task=record?.task;if(!task||typeof task!=='object')continue;
   const date=record.dateKey||record.date;
   const ref=(record.week||'')+'::'+String(task.id||'');
   if(typeof date==='string'&&date>=week&&date<end&&typeof task.id==='string'&&!recordedTasks.has(ref)){
    recordedTasks.set(ref,task);tasksById.set(task.id,[...(tasksById.get(task.id)||[]),ref]);
    const estimate=Number(task.estimatedDurationMinutes??task.focusEstimateMinutes);if(Number.isFinite(estimate)&&estimate>0&&estimate<=10080)enteredEstimates+=estimate;
   }
   const start=task.start==null?NaN:Number(task.start),duration=Number(task.duration);
   const scheduled=task.allDay||(!task.unscheduled&&Number.isFinite(start)&&Number.isFinite(duration)&&start>=0&&start<1440&&duration>0&&duration<=1440);
   if(typeof date==='string'&&date>=week&&date<end&&scheduled&&task.requiresCompletion!==false&&task.status!=='skipped'&&!task.archived&&!task.deleted&&!plannedIds.has(ref)){
    plannedIds.add(ref);committedTotal++;if(task.done||task.status==='done')committedDone++;
   }
   if(task.requiresCompletion!==false&&!task.allDay&&!scheduled&&!task.done&&!['done','skipped'].includes(task.status)&&!task.archived&&!task.deleted&&typeof task.dueDate==='string'&&task.dueDate>=week&&task.dueDate<end)dueOnly++;
   if(!task.allDay&&!task.unscheduled&&Number.isFinite(start)&&Number.isFinite(duration)&&start>=0&&start<1440&&duration>0&&duration<=1440&&typeof date==='string'){
    const stop=start+duration;
    if(windows.has(date))windows.get(date).push([start,Math.min(1440,stop)]);
    if(stop>1440){const tomorrow=dateAt(date,1);if(windows.has(tomorrow))windows.get(tomorrow).push([0,Math.min(1440,stop-1440)]);}
   }
   if(typeof task.id!=='string')continue;
   for(const move of Array.isArray(task.reschedulingHistory)?task.reschedulingHistory:[]){
    const movedOn=typeof move?.changedAt==='string'?localDay(move.changedAt,zone):null;
    if(movedOn===null||movedOn<week||movedOn>=end)continue;
    // Count recorded accepted changes once, even if a record appears in multiple derived views.
    const id=task.id+'::'+move.changedAt+'::'+String(move.fromWeek||'')+'::'+String(move.fromStart??'')+'::'+String(move.toStart??'');
    uniqueMoves.add(id);movedTasks.add(task.id);
   }
  }
  const days=dates.map(date=>{
   const intervals=root.WeekwisePlanning.merge(windows.get(date));
   return {date,minutes:intervals.reduce((sum,[a,b])=>sum+b-a,0),blocks:intervals.length};
  });
  const totalMinutes=days.reduce((sum,day)=>sum+day.minutes,0);
  const actualByTask=new Map(),sessions=sessionsInWeek(focusSessions,week,zone);let ambiguousFocus=0;
  for(const {session,minutes:amount} of sessions){
   const candidates=tasksById.get(session.taskId)||[],ref=typeof session.taskWeek==='string'?session.taskWeek+'::'+session.taskId:candidates.length===1?candidates[0]:null;
   if(!ref||!recordedTasks.has(ref)){if(candidates.length>1)ambiguousFocus++;continue;}
   actualByTask.set(ref,(actualByTask.get(ref)||0)+amount);
  }
  let estimateMinutes=0,linkedFocusMinutes=0,comparedTasks=0;
  for(const [id,actual]of actualByTask){
   const task=recordedTasks.get(id);
   const estimate=task.estimatedDurationMinutes??task.focusEstimateMinutes;
   if(!Number.isFinite(Number(estimate))||Number(estimate)<=0||Number(estimate)>10080)continue;
   estimateMinutes+=Number(estimate);linkedFocusMinutes+=actual;comparedTasks++;
  }
  return {week,days,totalMinutes,completion:{total:committedTotal,completed:committedDone},unplannedDue:dueOnly,recordedMoves:uniqueMoves.size,movedTasks:movedTasks.size,comparedTasks,linkedFocusMinutes,estimateMinutes,enteredEstimates,focusMinutes:sessions.reduce((sum,row)=>sum+row.minutes,0),focusCount:sessions.length,hasEvidence:recordedTasks.size>0||sessions.length>0||dueOnly>0,ambiguousFocus};
 }
 root.WeekwiseInsights=Object.freeze({weekly,localDay,sessionsInWeek});
})(typeof window!=='undefined'?window:globalThis);
