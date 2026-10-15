/* Reversible task lifecycle. Original records and linked children remain intact. */
(function(root){
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const all=store=>Object.entries(store.weeks).flatMap(([week,value])=>value.tasks.map(task=>({week,task})));
 const ordinal=date=>Date.parse(date+'T00:00:00Z')/86400000;
 function move(store,{week,id,kind='trash',historyId,at=new Date().toISOString()}){
  root.WeekwiseData.validateStore(store);
  if(!['archive','trash'].includes(kind)||typeof historyId!=='string'||!historyId||!Number.isFinite(Date.parse(at)))throw new Error('Invalid task history request.');
  if((store.taskHistory||[]).some(entry=>entry.id===historyId))throw new Error('History identity already exists.');
  const records=all(store),source=records.find(record=>record.week===week&&record.task.id===id);
  if(!source)throw new Error('This task changed or moved. Refresh before removing it.');
  const items=[source];for(const childId of source.task.planningChildren||[]){const matches=records.filter(record=>record.task.id===childId);if(matches.length>1)throw new Error('A linked task identity is ambiguous. Nothing was removed.');if(matches.length===1&&!items.includes(matches[0]))items.push(matches[0]);}
  if(items.some(record=>record.task.fixed||record.task.workday||record.task.cityday))throw new Error('Fixed settings blocks cannot be removed here.');
  const next=clone(store),entry={id:historyId,kind,createdAt:at,items:clone(items),rules:[]};
  for(const item of items){
   next.weeks[item.week].tasks=next.weeks[item.week].tasks.filter(task=>task.id!==item.task.id);
   if(item.task.seriesId){
    const rule=next.recurringTemplates?.find(rule=>rule.id===item.task.seriesId);
    if(rule){
     const date=item.task.occurrenceDate||new Date((ordinal(item.week)+item.task.day)*86400000).toISOString().slice(0,10);
     const before=clone(rule);rule.excludedDates=[...new Set([...(rule.excludedDates||[]),date])];
     const saved=entry.rules.find(saved=>saved.id===rule.id);if(saved)saved.after=clone(rule);else entry.rules.push({id:rule.id,before,after:clone(rule)});
    }
   }
  }
  next.taskHistory=[...(next.taskHistory||[]),entry];root.WeekwiseData.validateStore(next);return next;
 }

 // Review is side-effect-free; completed future history is intentionally protected.
 function seriesPreview(store,{week,id,scope='future'}){
  root.WeekwiseData.validateStore(store);
  if(!['single','future','all'].includes(scope))throw new Error('Choose which recurring tasks to remove.');
  const source=store.weeks?.[week]?.tasks.find(task=>task.id===id);
  if(!source?.seriesId||!source.occurrenceDate)throw new Error('This task no longer belongs to a recurring series.');
  const rule=store.recurringTemplates?.find(item=>item.id===source.seriesId);
  if(!rule)throw new Error('The recurring rule is no longer available.');
  const matching=all(store).filter(({task})=>task.seriesId===source.seriesId&&task.occurrenceDate);
  const intended=scope==='single'?matching.filter(item=>item.week===week&&item.task.id===id):scope==='all'?matching:matching.filter(({task})=>task.occurrenceDate>=source.occurrenceDate);
  const retained=scope==='future'?intended.filter(({task})=>task.done||task.status==='done'||task.status==='in-progress'||task.subtasks?.some(part=>part.done)):[];
  const retainedIds=new Set(retained.map(item=>item.week+'::'+item.task.id));
  const removable=intended.filter(item=>!retainedIds.has(item.week+'::'+item.task.id));
  if(removable.some(({task})=>task.fixed||task.workday||task.cityday))throw new Error('Fixed commitments are protected.');
  return {scope,seriesId:source.seriesId,title:source.title,anchor:source.occurrenceDate,items:removable.map(item=>({week:item.week,id:item.task.id})),retained:retained.map(item=>({week:item.week,id:item.task.id})),total:matching.length};
 }
 function moveSeries(store,{week,id,scope='future',historyId,at=new Date().toISOString()}){
  root.WeekwiseData.validateStore(store);
  if(typeof historyId!=='string'||!historyId||!Number.isFinite(Date.parse(at))||(store.taskHistory||[]).some(entry=>entry.id===historyId))throw new Error('Invalid repeating removal request.');
  const preview=seriesPreview(store,{week,id,scope});
  if(scope==='single')return move(store,{week,id,kind:'trash',historyId,at});
  const next=clone(store),rule=next.recurringTemplates.find(item=>item.id===preview.seriesId);
  const entry={id:historyId,kind:'trash',createdAt:at,items:[],rules:[]};
  const beforeRule=clone(rule),boundary=scope==='all'?root.WeekwiseCalendarRange.key(ordinal(rule.startDate)-1):root.WeekwiseCalendarRange.key(ordinal(preview.anchor)-1);
  rule.endDate=rule.endDate&&rule.endDate<boundary?rule.endDate:boundary;
  rule.updatedAt=at;
  entry.rules.push({id:rule.id,before:beforeRule,after:clone(rule)});
  for(const ref of preview.items){
   const task=next.weeks[ref.week]?.tasks.find(item=>item.id===ref.id);
   if(!task)throw new Error('Recurring tasks changed before removal. Nothing changed.');
   entry.items.push({week:ref.week,task:clone(task)});
   next.weeks[ref.week].tasks=next.weeks[ref.week].tasks.filter(item=>item.id!==ref.id);
  }
  // Retained completed records remain in the calendar and keep their identity,
  // even though the rule can no longer generate further occurrences.
  next.taskHistory=[...(next.taskHistory||[]),entry];
  return root.WeekwiseData.validateStore(next);
 }
 function restore(store,historyId,{unscheduled=false}={}){
  root.WeekwiseData.validateStore(store);const entry=store.taskHistory?.find(entry=>entry.id===historyId);
  if(!entry)throw new Error('This history entry is no longer available.');
  const records=all(store),ids=new Set(records.map(record=>record.task.id));
  if(entry.items.some(item=>ids.has(item.task.id)))throw new Error('A task with this identity already exists. Nothing was overwritten.');
  if(!unscheduled){
   const span=record=>{const task=record.task,start=(ordinal(record.week)+task.day)*1440;return task.allDay?[start,start+1440]:task.start!=null&&!task.unscheduled?[start+task.start,start+task.start+(task.duration||0)]:null;};
   if(entry.items.some(item=>{const target=span(item);return target&&records.some(record=>{const busy=span(record);return busy&&target[0]<busy[1]&&busy[0]<target[1];});}))throw new Error('The original schedule now overlaps another activity. Choose Restore without schedule.');
  }
  const next=clone(store);
  for(const item of entry.items){
   const task=clone(item.task);
   if(unscheduled){task.restoredSchedule={week:item.week,day:task.day,start:task.start,duration:task.duration,allDay:!!task.allDay};task.start=null;task.unscheduled=true;task.allDay=false;task.allDayDate=null;if(task.seriesId)task.recurrenceOverride=true;}
   if(!next.weeks[item.week])next.weeks[item.week]={tasks:[]};next.weeks[item.week].tasks.push(task);
  }
  for(const saved of entry.rules){const index=next.recurringTemplates?.findIndex(rule=>rule.id===saved.id);if(index>=0&&JSON.stringify(next.recurringTemplates[index])===JSON.stringify(saved.after))next.recurringTemplates[index]=clone(saved.before);}
  next.taskHistory=next.taskHistory.filter(item=>item.id!==historyId);root.WeekwiseData.validateStore(next);return next;
 }
 root.WeekwiseTaskHistory=Object.freeze({move,seriesPreview,moveSeries,restore});
})(typeof window!=='undefined'?window:globalThis);
