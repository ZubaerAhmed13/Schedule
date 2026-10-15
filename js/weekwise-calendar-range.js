/* Date-based ranges over unchanged Sunday-canonical storage, with exact zones. */
(function(root){
 'use strict';const copy=value=>JSON.parse(JSON.stringify(value));
 const ordinal=date=>Date.parse(date+'T00:00:00Z')/86400000,key=n=>new Date(n*86400000).toISOString().slice(0,10);
 function range(anchor,first=0){if(!root.WeekwiseData.validDate(anchor)||![0,1].includes(first))throw new Error('Invalid calendar range.');const weekday=new Date(anchor+'T00:00:00Z').getUTCDay(),start=ordinal(anchor)-(weekday-first+7)%7;return Array.from({length:7},(_,offset)=>key(start+offset));}
 function wall(date,minutes,zone){const d=new Date((ordinal(date)+Math.floor(minutes/1440))*86400000),m=((minutes%1440)+1440)%1440;return root.WeekwiseTimeZones.wallTimeInZone({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:Math.floor(m/60),minute:Math.floor(m%60),second:Math.round((m%1)*60)},zone).getTime();}
 function parts(epoch,zone){const p=root.WeekwiseTimeZones.zonedParts(epoch,zone);return {date:String(p[0]).padStart(4,'0')+'-'+String(p[1]).padStart(2,'0')+'-'+String(p[2]).padStart(2,'0'),minute:p[3]*60+p[4]+p[5]/60};}
 function instant(record,sourceZone){const task=record.task,date=key(ordinal(record.week)+task.day),saved=task.scheduleInstant;
  if(saved&&Number.isFinite(saved.start)&&Number.isFinite(saved.end)&&saved.end>saved.start&&saved.anchor&&saved.anchor.week===record.week&&saved.anchor.day===task.day&&saved.anchor.start===task.start&&saved.anchor.duration===task.duration&&saved.anchor.zone===sourceZone)return {start:saved.start,end:saved.end};
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
 function moveRecords(store,moves,zone,reason){
  root.WeekwiseData.validateStore(store);const projected=project(store,zone),sourceZone=store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone,identity=ref=>JSON.stringify([ref.week,ref.id]),selected=new Set();
  const changes=moves.map(({ref,date,start})=>{
   const record=projected.find(r=>r.week===ref.week&&r.task.id===ref.id);
   if(!record||record.task.fixed||record.task.done||record.task.status==='done')throw new Error('Fixed and completed records remain protected.');
   if(selected.has(identity(ref)))throw new Error('Choose two different activities.');selected.add(identity(ref));
   if(record.zoneError)throw new Error('Review the original clock time before moving this activity.');
   const duration=record.instant?(record.instant.end-record.instant.start)/60000:record.task.duration||30;
   return {ref,record,destination:slot(date,start,duration,zone,sourceZone)};
  });
  const overlaps=(a,b,afterA=0,afterB=0)=>a.start<b.end+afterB*60000&&b.start<a.end+afterA*60000;
  for(let i=0;i<changes.length;i++){
   const span=changes[i].destination.scheduleInstant,begin=parts(span.start,zone).date,end=parts(span.end-1,zone).date;
   for(const other of projected){
    if(selected.has(identity({week:other.week,id:other.task.id})))continue;
    const allDayEnd=ordinal(other.date)+Math.max(1,Math.ceil((other.duration||0)/1440));
    if((other.instant&&overlaps(span,other.instant,(root.WeekwiseTaskOptions?.breakAfter||(()=>0))(changes[i].record.task.breakAfter),(root.WeekwiseTaskOptions?.breakAfter||(()=>0))(other.task.breakAfter)))||(other.allDay&&ordinal(other.date)<=ordinal(end)&&allDayEnd>ordinal(begin))||(other.zoneError&&ordinal(other.date)>=ordinal(begin)-1&&ordinal(other.date)<=ordinal(end)+1))throw new Error('The destination overlaps another activity or a clock time needing review. Nothing was moved.');
   }
   for(let j=0;j<i;j++)if(overlaps(span,changes[j].destination.scheduleInstant,(root.WeekwiseTaskOptions?.breakAfter||(()=>0))(changes[i].record.task.breakAfter),(root.WeekwiseTaskOptions?.breakAfter||(()=>0))(changes[j].record.task.breakAfter)))throw new Error('The swapped activities would overlap. Nothing was moved.');
  }
  const next=copy(store);
  for(const {ref}of changes)next.weeks[ref.week].tasks=next.weeks[ref.week].tasks.filter(task=>task.id!==ref.id);
  for(const {ref,record,destination}of changes){
   if(next.weeks[destination.week]?.tasks.some(task=>task.id===ref.id))throw new Error('This identity already exists in the destination week.');
   if(!next.weeks[destination.week])next.weeks[destination.week]={tasks:[]};
   const original=record.task,task={...copy(original),day:destination.day,start:destination.start,duration:destination.duration,scheduleInstant:destination.scheduleInstant,unscheduled:false,allDay:false};if(task.seriesId)task.recurrenceOverride=true;
   task.reschedulingHistory=[...(task.reschedulingHistory||[]),{fromWeek:ref.week,fromDay:original.day,fromStart:original.start,fromDuration:original.duration,toWeek:destination.week,toDay:destination.day,toStart:destination.start,changedAt:new Date().toISOString(),reason}];next.weeks[destination.week].tasks.push(task);
  }
  return root.WeekwiseData.validateStore(next);
 }
 function move(store,ref,date,start,zone){return moveRecords(store,[{ref,date,start}],zone,'User-approved calendar move');}
 function swap(store,first,second,zone){
  const records=project(store,zone),find=ref=>records.find(r=>r.week===ref.week&&r.task.id===ref.id),a=find(first),b=find(second);
  if(!a?.instant||!b?.instant||a.allDay||b.allDay)throw new Error('Choose two timed activities with reviewed clock times.');
  return moveRecords(store,[{ref:first,date:b.date,start:b.start},{ref:second,date:a.date,start:a.start}],zone,'User-approved calendar swap');
 }
 root.WeekwiseCalendarRange=Object.freeze({range,wall,parts,instant,project,slot,move,swap,ordinal,key});
})(typeof window!=='undefined'?window:globalThis);
