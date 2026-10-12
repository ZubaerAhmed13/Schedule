/* Pure calendar-grid layout. Canonical Weekwise task weeks remain Sunday-based. */
(function(root){'use strict';
 const DAY_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 const DAY_LETTER=['S','M','T','W','T','F','S'];
 function firstDay(value){return Number(value)===1?1:0;}
 function weekdays(value){const start=firstDay(value);return Array.from({length:7},(_,i)=>(i+start)%7);}
 function month(year,monthIndex,value){
  if(!Number.isInteger(year)||year<1||year>9999||!Number.isInteger(monthIndex)||monthIndex<0||monthIndex>11)throw new Error('Choose a valid calendar month.');
  const first=new Date(0);first.setFullYear(year,monthIndex,1);first.setHours(12,0,0,0);
  const offset=(first.getDay()-firstDay(value)+7)%7;
  const start=new Date(first);start.setDate(start.getDate()-offset);
  const last=new Date(0);last.setFullYear(year,monthIndex+1,0);last.setHours(12,0,0,0);
  const count=Math.ceil((offset+last.getDate())/7)*7;
  return {start,count,offset,weekdays:weekdays(value)};
 }
 root.WeekwiseCalendarLayout=Object.freeze({firstDay,weekdays,month,DAY_SHORT,DAY_LETTER});
})(typeof window!=='undefined'?window:globalThis);
