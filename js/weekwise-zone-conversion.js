/* Reviewed planner-zone conversion. Original snapshots, IDs and history stay recoverable. */
(function(root){
 'use strict';const clone=value=>JSON.parse(JSON.stringify(value)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const range=()=>root.WeekwiseCalendarRange;
 function validZone(zone){if(typeof zone!=='string'||!zone||zone.length>128)throw new Error('Choose a supported IANA zone.');try{new Intl.DateTimeFormat('en-GB',{timeZone:zone});}catch(_){throw new Error('Unsupported IANA zone: '+zone);}return zone;}
 function canonical(date){const day=new Date(date+'T00:00:00Z').getUTCDay();return {week:range().key(range().ordinal(date)-day),day};}
 function reminderInstant(value,zone){
  if(typeof value!=='string'||value.length>40)throw new Error('Invalid reminder timestamp.');
  const explicit=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.exec(value);
  if(explicit){root.WeekwiseTimeZones.checkedComponents(...explicit.slice(1,7).map(part=>Number(part||0)));const at=Date.parse(value);if(!Number.isFinite(at))throw new Error('Invalid reminder instant.');return at;}
  const match=/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d)(?::(\d\d))?$/.exec(value);
  if(!match||!root.WeekwiseData.validDate(match[1])||Number(match[2])>23||Number(match[3])>59||Number(match[4]||0)>59)throw new Error('Invalid local reminder time.');
  return range().wall(match[1],Number(match[2])*60+Number(match[3])+Number(match[4]||0)/60,zone);
 }
 function preview(store,request){
  root.WeekwiseData.validateStore(store);
  const {toZone,mode='instants',sourceZone=store.settings.timeZone,at=new Date().toISOString()}=request||{};
  const fromZone=validZone(sourceZone);validZone(toZone);
  if(store.settings.timeZone&&store.settings.timeZone!==fromZone)throw new Error('The saved source zone changed. Rebuild the review.');
  if(!['instants','wall'].includes(mode)||(fromZone===toZone&&store.settings.timeZone)||!Number.isFinite(Date.parse(at)))throw new Error('Choose a different zone and a conversion policy.');
  const next=clone(store),changes=[],blocked=[],counts={timed:0,completed:0,archived:0,allDay:0,unscheduled:0,reminders:0,rules:0,clockChanges:0};
  const convert=(task,week,label)=>{
   const moved=clone(task);let location={week,day:task.day};
   try{
    if(task.allDay)counts.allDay++;else if(task.start==null||task.unscheduled)counts.unscheduled++;
    else{
     const original=range().instant({week,task},fromZone),date=range().key(range().ordinal(week)+task.day);
     const span=mode==='instants'?original:{start:range().wall(date,task.start,toZone),end:range().wall(date,task.start+(task.duration||0),toZone)};
     if(span.end<=span.start)throw new Error('The reviewed interval must have a positive duration.');
     const begin=range().parts(span.start,toZone),end=range().parts(span.end,toZone),wallMinutes=(range().ordinal(end.date)-range().ordinal(begin.date))*1440+end.minute-begin.minute;
     location=canonical(begin.date);moved.day=location.day;moved.start=begin.minute;moved.duration=wallMinutes>0?wallMinutes:(span.end-span.start)/60000;
     moved.scheduleInstant={...clone(task.scheduleInstant||{}),...span,anchor:{...clone(task.scheduleInstant?.anchor||{}),week:location.week,day:moved.day,start:moved.start,duration:moved.duration,zone:toZone}};
     if(wallMinutes!==(span.end-span.start)/60000)counts.clockChanges++;
     counts.timed++;if(task.done||task.status==='done')counts.completed++;
    }
    const anchors={...clone(task.reminderInstants||{})};
    for(const value of [...(task.reminderTimes||[]),...(task.reminderNotifiedTimes||[]),task.reminderAt,task.reminderNotifiedAt].filter(Boolean)){
     const prior=task.reminderInstants?.[value];anchors[value]=mode==='instants'&&Number.isFinite(prior)?prior:reminderInstant(value,mode==='instants'?(task.reminderTimeZone||fromZone):toZone);counts.reminders++;
    }
    if(Object.keys(anchors).length)moved.reminderInstants=anchors;

    changes.push({id:task.id,title:task.title,kind:label,fromWeek:week,fromDay:task.day,fromStart:task.start,toWeek:location.week,toDay:moved.day,toStart:moved.start});
   }catch(error){blocked.push({id:task.id,title:task.title,week,reason:error.message});}
   return {task:moved,week:location.week};
  };
  for(const value of Object.values(next.weeks))value.tasks=[];
  for(const [week,value]of Object.entries(store.weeks))for(const task of value.tasks){const converted=convert(task,week,'task');if(!next.weeks[converted.week])next.weeks[converted.week]={tasks:[]};const rows=next.weeks[converted.week].tasks;if(rows.some(other=>other.id===task.id))blocked.push({id:task.id,title:task.title,week,reason:'This ID would collide in its destination week. IDs will not be renamed.'});rows.push(converted.task);}
  const rule=value=>{const result=clone(value);result.timeZone=mode==='instants'?(value.timeZone||fromZone):toZone;validZone(result.timeZone);counts.rules++;return result;};
  try{next.recurringTemplates=(store.recurringTemplates||[]).map(rule);
   for(const entry of next.taskHistory||[]){for(const item of entry.items){const converted=convert(item.task,item.week,'archived');item.task=converted.task;item.week=converted.week;counts.archived++;}for(const saved of entry.rules){saved.before=rule(saved.before);saved.after=rule(saved.after);}}
  }catch(error){blocked.push({reason:error.message});}
  next.settings.timeZone=toZone;
  next.settings.zoneConversionHistory=[...(next.settings.zoneConversionHistory||[]),{fromZone,toZone,mode,at,counts:clone(counts)}];
  if(!blocked.length)root.WeekwiseData.validateStore(next);
  return {request:{toZone,mode,sourceZone:fromZone,at},fromZone,toZone,mode,counts,changes,blocked,before:JSON.stringify(store),after:JSON.stringify(next)};
 }
 function apply(store,plan){const checked=preview(store,plan?.request);if(!same(checked,plan))throw new Error('The planner or conversion preview changed. Rebuild before saving.');if(plan.blocked.length)throw new Error('Resolve every blocked clock time before converting.');return root.WeekwiseData.validateStore(JSON.parse(plan.after));}
 async function checksum(raw){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');}
 function taskReminderInstant(task,value,zone){const saved=task.reminderInstants?.[value];return Number.isFinite(saved)&&Math.abs(saved)<=8640000000000000?saved:reminderInstant(value,task.reminderTimeZone||zone);}
 function reminderField(task,value,zone){if(!value)return '';const p=range().parts(taskReminderInstant(task,value,zone),zone);return p.date+'T'+String(Math.floor(p.minute/60)).padStart(2,'0')+':'+String(Math.floor(p.minute%60)).padStart(2,'0');}
 function readReminderFields(task,inputs,zone){const originals=Array.isArray(task?.reminderTimes)?task.reminderTimes:(task?.reminderAt?[task.reminderAt]:[]),values=[],instants={};inputs.forEach((input,index)=>{if(!input)return;const old=originals[index],unchanged=old&&reminderField(task,old,zone)===input,value=unchanged?old:input;if(!values.includes(value))values.push(value);instants[value]=unchanged?taskReminderInstant(task,old,zone):reminderInstant(value,zone);});return {values,instants};}
 function reviewKey(owner){return 'weekwise-zone-review-v1:'+encodeURIComponent(owner);}
 function accepted(storage,owner,plannerZone,deviceZone){try{return same(JSON.parse(storage.getItem(reviewKey(owner))),{plannerZone,deviceZone});}catch(_){return false;}}
 function acknowledge(storage,owner,plannerZone,deviceZone){validZone(plannerZone);validZone(deviceZone);root.WeekwiseData.commitStorage(storage,[[reviewKey(owner),JSON.stringify({plannerZone,deviceZone})]]);}
 root.WeekwiseZoneConversion=Object.freeze({validZone,preview,apply,checksum,reminderInstant,taskReminderInstant,reminderField,readReminderFields,accepted,acknowledge,reviewKey});
})(typeof window!=='undefined'?window:globalThis);
