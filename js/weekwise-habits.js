/* Scheduled-day semantics: rest, pause and skip never count as a miss. */
(function(root){'use strict';const date=key=>new Date(key+'T12:00:00'),key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function due(h,day){return !h.paused&&(h.scheduledDays||[0,1,2,3,4,5,6]).includes(date(day).getDay())&&!(h.skippedDates||[]).includes(day);}
function streak(h,today){if(h.paused)return 0;const checks=new Set(h.checkIns||[]);let d=date(today),count=0,first=true;for(let i=0;i<366;i++){const k=key(d);if(due(h,k)){if(checks.has(k))count++;else if(!(first&&k===today))break;first=false;}d.setDate(d.getDate()-1);}return count;}
function consistency(h,start,end){let expected=0,done=0;for(let d=date(start);key(d)<=end;d.setDate(d.getDate()+1)){const k=key(d);if(due(h,k)){expected++;if((h.checkIns||[]).includes(k))done++;}}return {expected,done};}
root.WeekwiseHabits=Object.freeze({due,streak,consistency});})(typeof window!=='undefined'?window:globalThis);
