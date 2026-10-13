/* Date-based ranges over unchanged Sunday-canonical storage, with exact zones. */
(function(root){
 'use strict';const copy=value=>JSON.parse(JSON.stringify(value));
 const ordinal=date=>Date.parse(date+'T00:00:00Z')/86400000,key=n=>new Date(n*86400000).toISOString().slice(0,10);
 function range(anchor,first=0){if(!root.WeekwiseData.validDate(anchor)||![0,1].includes(first))throw new Error('Invalid calendar range.');const weekday=new Date(anchor+'T00:00:00Z').getUTCDay(),start=ordinal(anchor)-(weekday-first+7)%7;return Array.from({length:7},(_,offset)=>key(start+offset));}
 function wall(date,minutes,zone){const d=new Date((ordinal(date)+Math.floor(minutes/1440))*86400000),m=((minutes%1440)+1440)%1440;return root.WeekwiseTimeZones.wallTimeInZone({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:Math.floor(m/60),minute:Math.floor(m%60),second:Math.round((m%1)*60)},zone).getTime();}
 function parts(epoch,zone){const p=root.WeekwiseTimeZones.zonedParts(epoch,zone);return {date:String(p[0]).padStart(4,'0')+'-'+String(p[1]).padStart(2,'0')+'-'+String(p[2]).padStart(2,'0'),minute:p[3]*60+p[4]+p[5]/60};}
 function instant(record,sourceZone){const task=record.task,date=key(ordinal(record.week)+task.day),saved=task.scheduleInstant;
  if(saved&&Number.isFinite(saved.start)&&Number.isFinite(saved.end)&&saved.end>saved.start&&JSON.stringify(saved.anchor)===JSON.stringify({week:record.week,day:task.day,start:task.start,duration:task.duration,zone:sourceZone}))return {start:saved.start,end:saved.end};
  return {start:wall(date,task.start,sourceZone),end:wall(date,task.start+(task.duration||0),sourceZone)};
 }
 function project(store,zone){root.WeekwiseData.validateStore(store);new Intl.DateTimeFormat('en-GB',{timeZone:zone});const sourceZone=store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
  return Object.entries(store.weeks).flatMap(([week,value])=>value.tasks.map(task=>{
   const record={week,task},sourceDate=key(ordinal(week)+task.day);
   if(task.allDay||task.start==null||task.unscheduled)return {...record,date:task.allDayDate||sourceDate,start:null,duration:task.duration||0,allDay:!!task.allDay};
   try{const span=instant(record,sourceZone),begin=parts(span.start,zone),end=parts(span.end,zone),wallDuration=(ordinal(end.date)-ordinal(begin.date))*1440+end.minute-begin.minute;
    return {...record,date:begin.date,start:begin.minute,duration:wallDuration>0?wallDuration:(span.end-span.start)/60000,endDate:end.date,endMinute:end.minute,instant:span,clockChange:wallDuration!==(span.end-span.start)/60000,allDay:false};
   }catch(error){return {...record,date:sourceDate,start:null,duration:task.duration||0,zoneError:error.message,allDay:false};}
  }));
 }
 function slot(date,start,duration,viewZone,sourceZone){if(!root.WeekwiseData.validDate(date)||!Number.isFinite(start)||start<0||start>=1440||!Number.isFinite(duration)||duration<1||duration>1440)throw new Error('Choose a valid calendar placement.');
  const begin=wall(date,start,viewZone),end=wall(date,start+duration,viewZone);if((end-begin)/60000!==duration)throw new Error('This placement crosses a clock change. Choose another start.');
  const a=parts(begin,sourceZone),b=parts(end,sourceZone),day=new Date(a.date+'T00:00:00Z').getUTCDay(),week=key(ordinal(a.date)-day),wallDuration=(ordinal(b.date)-ordinal(a.date))*1440+b.minute-a.minute;
  const canonical={week,day,start:a.minute,duration:wallDuration>0?wallDuration:duration};canonical.scheduleInstant={start:begin,end,anchor:{week,day,start:canonical.start,duration:canonical.duration,zone:sourceZone}};return canonical;
 }
 function move(store,{week,id},date,start,zone){root.WeekwiseData.validateStore(store);const original=store.weeks[week]?.tasks.find(task=>task.id===id);if(!original||original.fixed||original.done||original.status==='done')throw new Error('Fixed and completed records remain protected.');
  const sourceZone=store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone,record=project(store,zone).find(record=>record.week===week&&record.task.id===id),duration=record.instant?(record.instant.end-record.instant.start)/60000:original.duration||30,destination=slot(date,start,duration,zone,sourceZone);
  const conflicts=project(store,zone).some(other=>!(other.week===week&&other.task.id===id)&&((other.instant&&destination.scheduleInstant.start<other.instant.end&&other.instant.start<destination.scheduleInstant.end)||(other.allDay&&other.date>=date&&other.date<=parts(destination.scheduleInstant.end-1,zone).date)));
  if(conflicts)throw new Error('The destination overlaps another activity. Nothing was moved.');
  const next=copy(store);if(destination.week!==week&&next.weeks[destination.week]?.tasks.some(task=>task.id===id))throw new Error('This identity already exists in the destination week.');
  next.weeks[week].tasks=next.weeks[week].tasks.filter(task=>task.id!==id);if(!next.weeks[destination.week])next.weeks[destination.week]={tasks:[]};
  const task={...copy(original),day:destination.day,start:destination.start,duration:destination.duration,scheduleInstant:destination.scheduleInstant,unscheduled:false,allDay:false};if(task.seriesId)task.recurrenceOverride=true;
  task.reschedulingHistory=[...(task.reschedulingHistory||[]),{fromWeek:week,fromDay:original.day,fromStart:original.start,fromDuration:original.duration,toWeek:destination.week,toDay:destination.day,toStart:destination.start,changedAt:new Date().toISOString(),reason:'User-approved calendar move'}];next.weeks[destination.week].tasks.push(task);return root.WeekwiseData.validateStore(next);
 }
 root.WeekwiseCalendarRange=Object.freeze({range,wall,parts,project,slot,move,ordinal,key});
})(typeof window!=='undefined'?window:globalThis);
