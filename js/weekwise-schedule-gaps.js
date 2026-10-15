/* View-only gaps between actual scheduled activities.
   No schedule changes, storage migration, break reservations or new task fields. */
(function(root){'use strict';
 const clamp=n=>Math.max(0,Math.min(1440,n));
 function between(intervals,minMinutes=15){
  const busy=(Array.isArray(intervals)?intervals:[]).filter(x=>x&&Number.isFinite(x.start)&&Number.isFinite(x.end))
    .map(x=>({start:clamp(x.start),end:clamp(x.end)})).filter(x=>x.end>x.start)
    .sort((a,b)=>a.start-b.start||b.end-a.end);
  const gaps=[];let covered=null;
  for(const slot of busy){
   if(covered!==null&&slot.start-covered>=minMinutes)gaps.push({start:covered,end:slot.start,minutes:slot.start-covered});
   covered=covered===null?slot.end:Math.max(covered,slot.end);
  }
  return gaps;
 }
 function fromRecords(records,date,minMinutes=15){
  const intervals=[];
  for(const r of records||[]){
   if(!r||r.allDay||r.zoneError||r.start===null||r.start===undefined||r.task?.unscheduled||r.date>date||r.endDate&&r.endDate<date)continue;
   const start=r.date<date?0:Number(r.start);
   // A task spilling into tomorrow occupies the rest of today's column.
   // Last-day endMinute is already projected into the selected calendar zone.
   const end=r.endDate&&r.endDate>date?1440:Number(r.endMinute??(start+Number(r.duration||0)));
   if(Number.isFinite(start)&&Number.isFinite(end)&&end>start)intervals.push({start,end});
  }
  return between(intervals,minMinutes);
 }
 function label(minutes){if(!Number.isInteger(minutes)||minutes<1)return '';const h=Math.floor(minutes/60),m=minutes%60;return (h?h+'h':'')+(h&&m?' ':'')+(m?m+'m':'')+' gap';}
 function clock(minutes){if(minutes===1440)return '24:00';return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}
 root.WeekwiseScheduleGaps=Object.freeze({between,fromRecords,label,clock});
})(typeof window!=='undefined'?window:globalThis);
