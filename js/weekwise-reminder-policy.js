/* Shared foreground/background policy. Derives alerts without editing planner records. */
(function(root){
 'use strict';
 const MAX_AGE=86400000;
 function leadMinutes(value){return [5,15,60].includes(value)?value:0;}
 function manualInstant(task,value,zone){
  if(typeof value!=='string'||value.length>40)return null;
  const anchor=task?.reminderInstants?.[value];
  if(typeof anchor==='number'&&Number.isFinite(anchor)&&Math.abs(anchor)<=8640000000000000)return anchor;
  const text=value.trim(),match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.exec(text);
  if(!match)return null;
  try{
   const [year,month,day,hour,minute,second]=match.slice(1,7).map(n=>Number(n||0));
   root.WeekwiseTimeZones.checkedComponents(year,month,day,hour,minute,second);
   if(match[7]){const at=Date.parse(text);return Number.isFinite(at)?at:null;}
   return root.WeekwiseTimeZones.wallTimeInZone({year,month,day,hour,minute,second},task?.reminderTimeZone||zone).getTime();
  }catch(_){return null;}
 }
 function reminders(record,settings={}){
  const task=record?.task;if(!task||!task.id||task.done||task.status==='done'||task.archived)return [];
  const raw=Array.isArray(task.reminderTimes)?task.reminderTimes.slice(0,5):(task.reminderAt?[task.reminderAt]:[]);
  const explicit=[],instants=new Set(),notified=new Set(Array.isArray(task.reminderNotifiedTimes)?task.reminderNotifiedTimes:[]);
  if(task.reminderAt&&task.reminderNotifiedAt===task.reminderAt)notified.add(task.reminderAt);
  for(const value of raw){
   const at=manualInstant(task,value,settings.timeZone);
   if(at===null||instants.has(at))continue;
   instants.add(at);explicit.push({value,at,automatic:false,start:null});
  }
  // An already acknowledged custom reminder still overrides the global default.
  if(explicit.length)return explicit.filter(r=>!notified.has(r.value));
  const lead=leadMinutes(settings.reminderLeadMinutes);
  if(!lead||task.allDay||task.unscheduled||!Number.isFinite(task.start)||task.start<0||task.start>=1440||!Number.isInteger(task.day)||task.day<0||task.day>6||!Number.isFinite(task.duration)||task.duration<=0)return [];
  try{
   if(typeof settings.timeZone!=='string'||!settings.timeZone)return [];
   new Intl.DateTimeFormat('en-GB',{timeZone:settings.timeZone});
   if(!/^\d{4}-\d{2}-\d{2}$/.test(record.week)||!root.WeekwiseData.validDate(record.week))return [];
   const start=root.WeekwiseCalendarRange.instant(record,settings.timeZone).start;
   if(!Number.isFinite(start))return [];
   const at=start-lead*60000;return [{value:new Date(at).toISOString(),at,start,automatic:true}];
  }catch(_){return [];}
 }
 function due(record,settings,now){return reminders(record,settings).filter(r=>r.at<=now&&now-r.at<MAX_AGE&&(!r.automatic||r.start>now));}
 root.WeekwiseReminderPolicy=Object.freeze({leadMinutes,manualInstant,reminders,due});
})(typeof window!=='undefined'?window:globalThis);
