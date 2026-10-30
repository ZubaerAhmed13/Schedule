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
 // Keep advanced category defaults optional; custom task reminders always win.
 function preferredLead(settings,task){
  const category=String(task?.type||'other').toLowerCase();
  const overrides=settings?.reminderCategoryLeadMinutes;
  const value=overrides&&typeof overrides==='object'&&!Array.isArray(overrides)?overrides[category]:undefined;
  return [0,5,15,60].includes(value)?value:leadMinutes(settings?.reminderLeadMinutes);
 }
 // Hours are measured in the planner's saved time zone, never the computer's clock.
 function duringQuietHours(settings,instant){
  const quiet=settings?.reminderQuietHours;
  if(!quiet||quiet.enabled!==true||!Number.isFinite(instant))return false;
  const clock=/^([01]\d|2[0-3]):([0-5]\d)$/;
  const a=typeof quiet.start==='string'?clock.exec(quiet.start):null;
  const b=typeof quiet.end==='string'?clock.exec(quiet.end):null;
  if(!a||!b||!settings.timeZone)return false;
  const start=Number(a[1])*60+Number(a[2]),end=Number(b[1])*60+Number(b[2]);
  if(start===end)return false;
  try{
   const parts=new Intl.DateTimeFormat('en-GB',{timeZone:settings.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant));
   const hour=Number(parts.find(p=>p.type==='hour')?.value),minute=Number(parts.find(p=>p.type==='minute')?.value);
   if(!Number.isFinite(hour)||!Number.isFinite(minute))return false;
   const now=hour*60+minute;return start<end?now>=start&&now<end:now>=start||now<end;
  }catch(_){return false;}
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
  const lead=preferredLead(settings,task);
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
 function due(record,settings,now){if(duringQuietHours(settings,now))return [];return reminders(record,settings).filter(r=>r.at<=now&&now-r.at<MAX_AGE&&!duringQuietHours(settings,r.at)&&(!r.automatic||r.start>now));}
 root.WeekwiseReminderPolicy=Object.freeze({leadMinutes,preferredLead,duringQuietHours,manualInstant,reminders,due});
})(typeof window!=='undefined'?window:globalThis);
