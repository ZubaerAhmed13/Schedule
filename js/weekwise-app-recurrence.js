/* recurrence controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function recurrenceDateMatches(template,date){
 const anchor=weekwiseRuntime.parseKey(template.startDate),key=weekwiseRuntime.dateKey(date);
 if(key<template.startDate||(template.endDate&&key>template.endDate))return false;
 if(template.frequency==='daily')return true;
 if(template.frequency==='weekly')return date.getDay()===anchor.getDay();
 if(template.frequency==='monthly'){const last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();return date.getDate()===Math.min(anchor.getDate(),last);}
 if(template.frequency==='yearly'){const last=new Date(date.getFullYear(),anchor.getMonth()+1,0).getDate();return date.getMonth()===anchor.getMonth()&&date.getDate()===Math.min(anchor.getDate(),last);}
 return false;
}

function stopRecurringSeries(task,fromDate,scope='future'){
 const seriesId=task?.seriesId;if(!seriesId)return;
 const rule=weekwiseRuntime.store.recurringTemplates.find(t=>t.id===seriesId);if(rule){rule.endDate=scope==='series'?weekwiseRuntime.addDaysToKey(rule.startDate,-1):weekwiseRuntime.addDaysToKey(fromDate,-1);rule.updatedAt=new Date().toISOString();}
 task.recurrence='none';task.recurrenceOverride=true;
 // Keep every materialized occurrence, including completed and edited history.
}

function upsertRecurringTemplate(id,occurrenceDate,fields){
 if(!Array.isArray(weekwiseRuntime.store.recurringTemplates))weekwiseRuntime.store.recurringTemplates=[];
 const dueOffsetDays=fields.dueDate?Math.round((weekwiseRuntime.parseKey(fields.dueDate)-weekwiseRuntime.parseKey(occurrenceDate))/86400000):null;
 const reminderValues=Array.isArray(fields.reminderTimes)&&fields.reminderTimes.length?fields.reminderTimes:(fields.reminderAt?[fields.reminderAt]:[]);
 const reminderRules=reminderValues.map(value=>({offsetDays:Math.round((weekwiseRuntime.parseKey(value.slice(0,10))-weekwiseRuntime.parseKey(occurrenceDate))/86400000),time:value.slice(11,16)})).filter(rule=>/^\d{2}:\d{2}$/.test(rule.time));
 const reminderOffsetDays=reminderRules[0]?.offsetDays??null,reminderTime=reminderRules[0]?.time??null;
 let template=weekwiseRuntime.store.recurringTemplates.find(item=>item.id===id);
 const value={id,endDate:template?.endDate||null,timeZone:weekwiseRuntime.store.settings.timeZone,startDate:occurrenceDate,frequency:fields.recurrence,schedulingMode:fields.schedulingMode||'flexible',estimatedDurationMinutes:fields.estimatedDurationMinutes??null,requiresCompletion:fields.requiresCompletion!==false,title:fields.title,type:fields.type,duration:fields.duration,start:fields.start,taskColor:WeekwiseTaskOptions.colour(fields.taskColor),allDay:!!fields.allDay,note:fields.note,listId:fields.listId,folderName:fields.folderName,sectionName:fields.sectionName,priority:fields.priority,status:'todo',focusEstimateMinutes:fields.focusEstimateMinutes??null,importance:fields.importance,urgency:fields.urgency,dueOffsetDays,reminderOffsetDays,reminderTime,reminderRules,tags:[...(fields.tags||[])],attachments:[...(fields.attachments||[])],subtasks:(fields.subtasks||[]).map(s=>({...s,done:false})),excludedDates:template?.excludedDates||[],createdAt:template?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(template)Object.assign(template,value);else{template=value;weekwiseRuntime.store.recurringTemplates.push(template);}
 return template;
}

function materializeRecurringRange(rangeStart,rangeEnd){
 const templates=Array.isArray(weekwiseRuntime.store.recurringTemplates)?weekwiseRuntime.store.recurringTemplates.slice():[];
 if(!templates.length||!rangeStart||!rangeEnd)return;
 const start=new Date(rangeStart),end=new Date(rangeEnd);if(templates.some(template=>template.timeZone&&template.timeZone!==weekwiseRuntime.store.settings.timeZone)){start.setDate(start.getDate()-2);end.setDate(end.getDate()+2);}
 const occurrences=new Map();for(const record of weekwiseRuntime.workspaceRecords()){const t=record.task;if(t.seriesId&&t.occurrenceDate)occurrences.set(t.seriesId+'::'+t.occurrenceDate,t);}
 const placements=WeekwiseRecurringPlacement.create(weekwiseRuntime.plannerSnapshot().store);let pendingBlock=0;
 // Reserve upcoming all-day rules before timed generation, including the day
 // after this range for overnight endings. Retained/moved exceptions win.
 const protectedEnd=new Date(end);protectedEnd.setDate(protectedEnd.getDate()+1);
 for(let date=new Date(start);date<=protectedEnd;date.setDate(date.getDate()+1)){
  const key=weekwiseRuntime.dateKey(date);for(const template of templates){if(!template?.allDay||!weekwiseRuntime.recurrenceDateMatches(template,date)||(template.excludedDates||[]).includes(key)||occurrences.has(template.id+'::'+key))continue;
   placements.add({week:weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(date)),task:{id:'pending-all-day-'+pendingBlock++,title:'Upcoming all-day commitment',day:date.getDay(),start:null,allDay:true,allDayDate:key,duration:Math.max(10,Number(template.duration)||30)}});
  }
 }

 for(let date=new Date(start);date<=end;date.setDate(date.getDate()+1)){
  const occurrenceDate=weekwiseRuntime.dateKey(date),day=date.getDay(),weekKey=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(date));
  for(const template of templates){
   if(!template||!template.id||!weekwiseRuntime.recurrenceDateMatches(template,date)||(template.excludedDates||[]).includes(occurrenceDate))continue;
   const existing=occurrences.get(template.id+'::'+occurrenceDate);if(existing)continue;
   const placement=placements.placeRule(template,occurrenceDate),destinationWeek=placement.week,destinationDay=placement.day,duration=placement.duration,startTime=placement.start;
   let rows;if(destinationWeek===weekwiseRuntime.currentWeek)rows=weekwiseRuntime.tasks;else{if(!weekwiseRuntime.store.weeks[destinationWeek]||!Array.isArray(weekwiseRuntime.store.weeks[destinationWeek].tasks))weekwiseRuntime.store.weeks[destinationWeek]={...(weekwiseRuntime.store.weeks[destinationWeek]||{}),tasks:[]};rows=weekwiseRuntime.store.weeks[destinationWeek].tasks;}
   const dueDate=template.dueOffsetDays===null||template.dueOffsetDays===undefined?null:weekwiseRuntime.addDaysToKey(occurrenceDate,Number(template.dueOffsetDays)||0);
   const reminderRules=Array.isArray(template.reminderRules)?template.reminderRules:(template.reminderTime?[{offsetDays:template.reminderOffsetDays||0,time:template.reminderTime}]:[]);
   const reminderTimes=reminderRules.map(rule=>weekwiseRuntime.addDaysToKey(occurrenceDate,Number(rule.offsetDays)||0)+'T'+rule.time).filter(Boolean);
   const reminderAt=reminderTimes[0]||null;
   const priorNotified=[...(Array.isArray(existing?.reminderNotifiedTimes)?existing.reminderNotifiedTimes:[])];if(existing?.reminderNotifiedAt)priorNotified.push(existing.reminderNotifiedAt);
   const reminderNotifiedTimes=[...new Set(priorNotified.filter(value=>reminderTimes.includes(value)))];
   const values={day:destinationDay,title:template.title,taskColor:WeekwiseTaskOptions.colour(template.taskColor),type:template.type||'other',duration,start:startTime,scheduleInstant:placement.scheduleInstant,recurrenceScheduleReview:placement.review,allDay:!!template.allDay,allDayDate:template.allDay?occurrenceDate:null,folderName:template.folderName||weekwiseRuntime.defaultFolderName(template.listId||'other'),sectionName:template.sectionName||'',done:!!existing?.done,status:existing?.done?'done':(existing?.status==='in-progress'?'in-progress':'todo'),focusEstimateMinutes:template.focusEstimateMinutes??null,estimatedDurationMinutes:template.estimatedDurationMinutes??null,requiresCompletion:template.requiresCompletion!==false,custom:true,fixed:false,schedulingMode:template.schedulingMode||'flexible',note:template.note||'',unscheduled:!template.allDay&&startTime===null,seriesId:template.id,occurrenceDate,recurrence:template.frequency,listId:template.listId||'other',priority:template.priority||'none',importance:template.importance||'unclassified',urgency:template.urgency||'unclassified',dueDate,reminderAt,reminderTimes,reminderTimeZone:template.timeZone||weekwiseRuntime.store.settings.timeZone,reminderNotifiedTimes,reminderNotifiedAt:reminderNotifiedTimes.includes(reminderAt)?reminderAt:null,tags:[...(template.tags||[])],attachments:[...(template.attachments||[])],subtasks:(template.subtasks||[]).map(s=>({...s,done:!!(existing?.subtasks||[]).find(old=>old.id===s.id)?.done}))};
   if(existing)Object.assign(existing,values);
   else {const created={id:'rec_'+template.id+'_'+occurrenceDate.replace(/-/g,''),...values};rows.push(created);placements.add({week:destinationWeek,task:created});occurrences.set(template.id+'::'+occurrenceDate,created);}
  }
 }
}

function materializeCurrentAndUpcoming(){
 if(weekwiseRuntime.zoneNeedsReview())return;
 weekwiseRuntime.materializeRecurringRange(weekwiseRuntime.parseKey(weekwiseRuntime.currentWeek),weekwiseRuntime.parseKey(weekwiseRuntime.addDaysToKey(weekwiseRuntime.currentWeek,89)));
 weekwiseRuntime.saveCurrent();
}

function updateCalendarPeriodLabel(){
 const label=weekwiseRuntime.$('weekLabel');if(!label)return;const rangeLabel=WeekwiseCalendarRangeUI.label();if(rangeLabel){label.textContent=rangeLabel;return;}
 if(weekwiseRuntime.calendarView==='year')label.textContent=String(weekwiseRuntime.calendarYear);
 else if(weekwiseRuntime.calendarView==='agenda'){const end=new Date(weekwiseRuntime.agendaAnchor);end.setDate(end.getDate()+29);label.textContent='Agenda · '+weekwiseRuntime.fmtDate(weekwiseRuntime.agendaAnchor,{day:'numeric',month:'short'})+' – '+weekwiseRuntime.fmtDate(end,{day:'numeric',month:'short'});}
 else if(weekwiseRuntime.calendarView==='month')label.textContent=weekwiseRuntime.monthAnchor.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
 else if(weekwiseRuntime.calendarView==='day')label.textContent=weekwiseRuntime.DAY_NAMES[weekwiseRuntime.mobileDay]+', '+weekwiseRuntime.fmtDate(weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,weekwiseRuntime.mobileDay),{day:'numeric',month:'short',year:'numeric'});
 else label.textContent=weekwiseRuntime.fmtDate(weekwiseRuntime.parseKey(weekwiseRuntime.currentWeek),{day:'numeric',month:'short'})+' – '+weekwiseRuntime.fmtDate(weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,6),{day:'numeric',month:'short',year:'numeric'});
}
return Object.freeze({recurrenceDateMatches,stopRecurringSeries,upsertRecurringTemplate,materializeRecurringRange,materializeCurrentAndUpcoming,updateCalendarPeriodLabel});
}
root.WeekwiseAppRecurrence=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
