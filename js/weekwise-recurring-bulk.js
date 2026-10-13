/* Explicit, guarded updates to previously saved recurring occurrences.
   Only descriptive metadata is propagated; dates, times, reminders, statuses,
   completion and scheduling history must never be overwritten. */
(function(root){'use strict';
 const FIELDS=Object.freeze(['title','note','type','listId','folderName','sectionName','priority','importance','urgency','estimatedDurationMinutes','focusEstimateMinutes','requiresCompletion','tags','attachments']);
 const COPY=x=>JSON.parse(JSON.stringify(x));
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function normalize(field,value){
  if(['tags','attachments'].includes(field)){
   if(!Array.isArray(value)||value.length>100||value.some(x=>typeof x!=='string'||x.length>2000))throw new Error('Invalid recurring metadata list.');
   return COPY(value);
  }
  if(['estimatedDurationMinutes','focusEstimateMinutes'].includes(field)){
   if(value!==null&&(!Number.isInteger(value)||value<0||value>1440))throw new Error('Invalid recurring duration estimate.');
   return value;
  }
  if(field==='requiresCompletion'){
   if(typeof value!=='boolean')throw new Error('Invalid recurring completion requirement.');
   return value;
  }
  if(typeof value!=='string'||value.length>12000)throw new Error('Invalid recurring text metadata.');
  return value;
 }
 function preview(store,{seriesId,fromDate,fields,excludeId=null}){
  root.WeekwiseData.validateStore(store);
  if(typeof seriesId!=='string'||!seriesId||!root.WeekwiseData.validDate(fromDate))throw new Error('Invalid recurring series selection.');
  const rule=(store.recurringTemplates||[]).find(t=>t.id===seriesId);
  if(!rule)throw new Error('Recurring rule no longer exists.');
  if(!fields||typeof fields!=='object'||Array.isArray(fields))throw new Error('Invalid recurring changes.');
  const edits={};for(const [key,value]of Object.entries(fields)){
   if(!FIELDS.includes(key))throw new Error('This recurring field requires a separate scheduling review: '+key);
   edits[key]=normalize(key,value);
  }
  if(!Object.keys(edits).length)throw new Error('Select at least one metadata field.');
  const changes=[],skipped={completed:0,customized:0,other:0};let unrelated=0;
  for(const [week,group]of Object.entries(store.weeks)){
   for(const task of group.tasks){
    if(task.seriesId!==seriesId||!task.occurrenceDate||task.occurrenceDate<fromDate||task.id===excludeId){unrelated++;continue;}
    if(task.done||task.status==='done'||task.status==='in-progress'){skipped.completed++;continue;}
    if(task.recurrenceOverride||task.reschedulingHistory?.length||task.fixed||task.parentTaskId||task.planningChildren?.length){skipped.customized++;continue;}
    const differsFromRule=Object.keys(edits).some(key=>{
     const old=rule[key]??(['tags','attachments'].includes(key)?[]:null);
     const actual=task[key]??(['tags','attachments'].includes(key)?[]:null);
     return !same(old,actual);
    });
    if(differsFromRule){skipped.customized++;continue;}
    const changed=Object.entries(edits).some(([key,value])=>!same(task[key],value));
    if(changed)changes.push({week,id:task.id,occurrenceDate:task.occurrenceDate,before:JSON.stringify(task)});
   }
  }
  return {seriesId,fromDate,fields:COPY(edits),changes,skipped,unrelated};
 }
 function apply(store,plan){
  root.WeekwiseData.validateStore(store);
  if(!plan||!Array.isArray(plan.changes)||plan.changes.length>20000)throw new Error('Invalid recurring preview.');
  const next=COPY(store);
  const ids=new Set();
  for(const change of plan.changes){
   const ref=change.week+'::'+change.id;
   if(ids.has(ref))throw new Error('Duplicate recurring update refused.');
   ids.add(ref);
   const task=next.weeks[change.week]?.tasks.find(t=>t.id===change.id);
   if(!task||task.seriesId!==plan.seriesId||task.occurrenceDate!==change.occurrenceDate||JSON.stringify(task)!==change.before)
    throw new Error('A recurring occurrence changed. Reopen the editor and review a fresh preview.');
   for(const [key,value]of Object.entries(plan.fields)){
    if(!FIELDS.includes(key))throw new Error('Unsupported recurring metadata change.');
    task[key]=normalize(key,value);
   }
  }
  return root.WeekwiseData.validateStore(next);
 }
 root.WeekwiseRecurringBulk=Object.freeze({FIELDS,preview,apply});
})(typeof window!=='undefined'?window:globalThis);
