/* Atomic list actions over existing canonical records; never mutate the input. */
(function(root){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value)),own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const fields=['priority','dueDate','estimatedDurationMinutes','listId','addTags','done','todayPriority','schedule'];
 function fixed(task){return !!(task.fixed||task.workday||task.type==='fixed'||task.schedulingMode==='fixed');}
 function eligible(task){return !!task&&!fixed(task);}
 function locate(store,ref){return store.weeks[ref.week]?.tasks.find(task=>task.id===ref.id);}
 function refs(store,items){
  if(!Array.isArray(items)||!items.length||items.length>500)throw new Error('Select between 1 and 500 tasks.');
  const seen=new Set();
  for(const ref of items){
   if(!ref||!root.WeekwiseData.validDate(ref.week)||typeof ref.id!=='string'||!ref.id)throw new Error('Invalid task selection.');
   const key=ref.week+'::'+ref.id;if(seen.has(key))throw new Error('Duplicate task selection.');seen.add(key);
   const task=locate(store,ref);if(!task)throw new Error('A selected task is no longer available. Select it again.');
   if(!eligible(task))throw new Error('Fixed commitments use their existing settings editor.');
  }
 }
 function validatePatch(store,patch){
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length||Object.keys(patch).some(key=>!fields.includes(key)))throw new Error('Choose a supported task change.');
  root.WeekwiseData.assertSafeObject?.(patch);
  if(own(patch,'priority')&&!['none','low','medium','high'].includes(patch.priority))throw new Error('Choose a valid priority.');
  if(own(patch,'dueDate')&&patch.dueDate!==null&&!root.WeekwiseData.validDate(patch.dueDate))throw new Error('Choose a valid due date.');
  if(own(patch,'estimatedDurationMinutes')&&patch.estimatedDurationMinutes!==null&&(!Number.isInteger(patch.estimatedDurationMinutes)||patch.estimatedDurationMinutes<5||patch.estimatedDurationMinutes>1440))throw new Error('Choose a planning estimate from 5 to 1440 minutes.');
  if(own(patch,'listId')&&!['inbox','career','study','work','personal','language','hobbies','other',...(store.customLists||[]).map(list=>list.id)].includes(patch.listId))throw new Error('That list is no longer available.');
  if(own(patch,'addTags')&&(!Array.isArray(patch.addTags)||!patch.addTags.length||patch.addTags.length>20||patch.addTags.some(tag=>typeof tag!=='string'||!tag.trim()||tag.length>60)))throw new Error('Add up to 20 tags, each at most 60 characters.');
  for(const key of ['done','todayPriority'])if(own(patch,key)&&typeof patch[key]!=='boolean')throw new Error('Invalid task state.');
  if(own(patch,'schedule')){
   const s=patch.schedule;if(!s||typeof s.unscheduled!=='boolean'||!root.WeekwiseData.validDate(s.date))throw new Error('Choose a valid scheduled date.');
   if(!s.unscheduled&&!s.allDay&&(!Number.isInteger(s.start)||s.start<0||s.start>=1440||!Number.isInteger(s.duration)||s.duration<1||s.duration>1440))throw new Error('Choose 24-hour timing of at most 24 hours.');
  }
 }
 function reconcile(store,changed){
  const all=Object.values(store.weeks).flatMap(week=>week.tasks);
  const find=id=>{const rows=all.filter(task=>task.id===id);if(rows.length!==1)throw new Error('Linked task IDs need review in the full editor.');return rows[0];};
  for(const parent of all){
   if(!parent.planningChildren?.length||!parent.planningChildren.some(id=>changed.has(id)))continue;
   const children=parent.planningChildren.map(find);
   for(const sub of parent.subtasks||[])if(sub.taskId){const child=find(sub.taskId);sub.title=child.title;sub.done=!!child.done;}
   parent.done=children.every(task=>task.done)&&(!(parent.subtasks||[]).length||parent.subtasks.every(sub=>sub.done));parent.status=parent.done?'done':'todo';
  }
 }
 function retime(store,ref,task,schedule){
  const oldDate=root.WeekwisePlanning.dateAt(ref.week,task.day),oldUnscheduled=!!(task.unscheduled||task.start==null)&&!task.allDay;
  if(!!schedule.allDay!==!!task.allDay||task.allDay&&schedule.unscheduled)throw new Error('Change the event type in the full task editor.');
  const changed=schedule.unscheduled!==oldUnscheduled||schedule.date!==oldDate||(!task.allDay&&!schedule.unscheduled&&(schedule.start!==task.start||schedule.duration!==task.duration));
  if(!changed)return;
  if(task.seriesId||task.recurrence&&task.recurrence!=='none')throw new Error('Recurring timing changes need the existing recurring schedule review.');
  if(task.planningChildren?.length)throw new Error('Schedule linked parts individually.');
  const ordinal=root.WeekwisePlanning.ordinal(schedule.date),day=((ordinal+4)%7+7)%7,week=root.WeekwisePlanning.dateAt(schedule.date,-day);
  if(week!==ref.week&&store.weeks[week]?.tasks.some(row=>row.id===task.id))throw new Error('A task with this ID already exists in the destination week.');
  let slot=null;
  if(!schedule.unscheduled&&!task.allDay){
   if(!store.settings.timeZone)throw new Error('Review the planner time zone before changing timing.');
   const check=copy(store);check.weeks[ref.week].tasks=check.weeks[ref.week].tasks.filter(row=>row.id!==task.id);
   slot=root.WeekwiseTaskSchedule.placement(check,{week,day,start:schedule.start,duration:schedule.duration,breakAfter:task.breakAfter||0});
   if(slot.start!==schedule.start)throw new Error('That time overlaps another activity. Choose a free time or use the calendar; nothing was changed.');
  }
  store.weeks[ref.week].tasks=store.weeks[ref.week].tasks.filter(row=>row.id!==task.id);
  if(!store.weeks[week])store.weeks[week]={tasks:[]};store.weeks[week].tasks.push(task);
  task.day=day;task.unscheduled=schedule.unscheduled;task.start=slot?.start??null;
  if(task.allDay){task.allDayDate=schedule.date;task.unscheduled=false;}
  else if(!schedule.unscheduled)task.duration=schedule.duration;
  if(slot){task.scheduleInstant=slot.scheduleInstant;delete task.recurrenceScheduleReview;}else delete task.scheduleInstant;
 }
 function apply(store,items,patch){
  root.WeekwiseData.validateStore(store);refs(store,items);validatePatch(store,patch);
  if(own(patch,'schedule')&&items.length!==1)throw new Error('Review timing one task at a time.');
  const next=copy(store);
  for(const ref of items){
   const task=locate(next,ref);
   if(own(patch,'done')&&task.planningChildren?.length)throw new Error('Complete or reopen linked parts first. Their parent follows their progress.');
   if(patch.todayPriority&&(task.done||task.status==='done'||task.requiresCompletion===false))throw new Error('Choose an unfinished task as a Today highlight.');
   for(const key of ['priority','dueDate','estimatedDurationMinutes','listId','todayPriority'])if(own(patch,key))task[key]=patch[key];
   if(own(patch,'addTags')){if(task.tags!==undefined&&(!Array.isArray(task.tags)||task.tags.some(tag=>typeof tag!=='string')))throw new Error('Existing tags need review in the full editor.');const tags=[...new Set([...(task.tags||[]),...patch.addTags.map(tag=>tag.trim().replace(/^#/,''))])];if(tags.length>20)throw new Error('This task would exceed 20 tags. Existing tags were preserved.');task.tags=tags;}
   if(own(patch,'done')){task.done=patch.done;task.status=patch.done?'done':'todo';}
   if(task.seriesId&&Object.keys(patch).some(key=>key!=='done'&&key!=='schedule'))task.recurrenceOverride=true;
   if(own(patch,'schedule'))retime(next,ref,task,patch.schedule);
  }
  if(patch.todayPriority){const count=Object.values(next.weeks).flatMap(week=>week.tasks).filter(task=>task.todayPriority&&!task.done&&task.status!=='done'&&task.requiresCompletion!==false).length;if(count>3)throw new Error('Three highlights are already chosen. Remove one before adding another.');}
  if(own(patch,'done'))reconcile(next,new Set(items.map(ref=>ref.id)));
  return root.WeekwiseData.validateStore(next);
 }
 root.WeekwiseTaskActions=Object.freeze({apply,eligible,fixed});
})(typeof window!=='undefined'?window:globalThis);
