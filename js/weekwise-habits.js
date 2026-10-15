/* Planned weekdays (legacy) and flexible weekly targets keep history intact.
   Rest, deliberate skip and pause do not count as missed work. */
(function(root){'use strict';
 const date=key=>new Date(key+'T12:00:00');
 const key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 // Count the same Monday–Sunday week shown by Calendar, Plan and Insights.
 // Check-in dates and historical records are never rewritten.
 const weekStart=day=>{const d=date(day);d.setDate(d.getDate()-(d.getDay()+6)%7);return key(d);};
 const target=h=>Math.max(1,Math.min(7,Number(h.targetPerWeek)||5));
 const flexible=h=>h.frequencyMode==='weekly-flexible';
 function weekCount(h,day){
  const start=weekStart(day),end=date(start);end.setDate(end.getDate()+7);const finish=key(end);
  return new Set((h.checkIns||[]).filter(k=>typeof k==='string'&&k>=start&&k<finish)).size;
 }
 function due(h,day){
  if(h.paused||(h.skippedDates||[]).includes(day))return false;
  return flexible(h)?weekCount(h,day)<target(h):(h.scheduledDays||[0,1,2,3,4,5,6]).includes(date(day).getDay());
 }
 function streak(h,today){
  if(h.paused)return 0;
  if(flexible(h)){
   let start=weekStart(today),count=0;
   if(weekCount(h,start)<target(h)){const d=date(start);d.setDate(d.getDate()-7);start=key(d);}
   for(let i=0;i<105;i++){
    if(weekCount(h,start)<target(h))break;
    count++;const d=date(start);d.setDate(d.getDate()-7);start=key(d);
   }
   return count;
  }
  const checks=new Set(h.checkIns||[]);let d=date(today),count=0,first=true;
  for(let i=0;i<366;i++){const k=key(d);if(due(h,k)){if(checks.has(k))count++;else if(!(first&&k===today))break;first=false;}d.setDate(d.getDate()-1);}
  return count;
 }
 function consistency(h,start,end){
  if(flexible(h)){
   let expected=0,done=0,week=weekStart(start);
   for(let i=0;i<105&&week<=end;i++){
    const count=weekCount(h,week);expected+=target(h);done+=Math.min(target(h),count);
    const d=date(week);d.setDate(d.getDate()+7);week=key(d);
   }
   return {expected,done};
  }
  let expected=0,done=0;for(let d=date(start);key(d)<=end;d.setDate(d.getDate()+1)){const k=key(d);if(due(h,k)){expected++;if((h.checkIns||[]).includes(k))done++;}}
  return {expected,done};
 }
 root.WeekwiseHabits=Object.freeze({due,streak,consistency,weekCount,target,flexible});
})(typeof window!=='undefined'?window:globalThis);
