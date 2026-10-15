/* Task visual accents, recovery buffers, and safe recurring end rules.
   Pure helpers: no storage writes, no live UI dependencies. */
(function(root){
'use strict';
const COLORS=Object.freeze({
 auto:null,blue:'#3778be',teal:'#188c86',green:'#43845d',
 purple:'#8967bd',rose:'#c35d83',orange:'#c2763c',slate:'#69778a'
});
const MINUTES=Object.freeze([0,5,10,15,20,30,45,60]);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const ordinal=date=>Date.parse(date+'T00:00:00Z')/86400000;
const key=n=>new Date(n*86400000).toISOString().slice(0,10);
function color(value){return Object.prototype.hasOwnProperty.call(COLORS,value)?value:'auto';}
function accent(value){return COLORS[color(value)]||null;}
function colorStyle(task){const hex=accent(task?.taskColor);return hex?' style="--ww-task-accent:'+hex+'" data-task-color="'+color(task.taskColor)+'"':'';}
function breakAfter(value){return MINUTES.includes(Number(value))?Number(value):0;}
function endForCount(anchor,frequency,count){
 if(!validDate(anchor)||!['daily','weekly','monthly','yearly'].includes(frequency)||!Number.isInteger(count)||count<1||count>500)throw new Error('Choose 1 to 500 repeating occurrences.');
 const start=new Date(anchor+'T00:00:00Z'),n=count-1;
 if(frequency==='daily')return key(ordinal(anchor)+n);
 if(frequency==='weekly')return key(ordinal(anchor)+7*n);
 const y=start.getUTCFullYear(),m=start.getUTCMonth(),day=start.getUTCDate();
 const target=frequency==='monthly'?new Date(Date.UTC(y,m+n,1)):new Date(Date.UTC(y+n,m,1));
 const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
 return key(Date.UTC(target.getUTCFullYear(),target.getUTCMonth(),Math.min(last,day))/86400000);
}
function ending(anchor,frequency,mode,date,count){
 if(mode==='never')return null;
 if(mode==='date'){if(!validDate(date)||date<anchor)throw new Error('Repeat end must be on or after the first occurrence.');return date;}
 if(mode==='count')return endForCount(anchor,frequency,count);
 throw new Error('Choose how the repeating task should end.');
}
function isAutomatic(task,seriesId){
 return !!task&&task.id==='rec_'+seriesId+'_'+String(task.occurrenceDate||'').replace(/-/g,'')&&
 !task.done&&(!task.status||task.status==='todo')&&!task.recurrenceOverride&&!task.fixed&&!task.parentTaskId&&
 !(task.reschedulingHistory||[]).length&&!(task.subtasks||[]).some(s=>s.done)&&
 !(task.reminderNotifiedTimes||[]).length&&!task.reminderNotifiedAt&&!task.recurrenceScheduleReview;
}
function cutoffPreview(store,seriesId,endDate,today,exceptId){
 if(!validDate(endDate)||!validDate(today))throw new Error('Invalid repeating end date.');
 const remove=[],preserve=[];
 for(const [week,value] of Object.entries(store.weeks||{})){
  for(const task of value.tasks||[]){
   if(task.seriesId!==seriesId||!task.occurrenceDate||task.occurrenceDate<=endDate||task.occurrenceDate<today||task.id===exceptId)continue;
   (isAutomatic(task,seriesId)?remove:preserve).push({week,id:task.id});
  }
 }
 return {remove,preserve};
}
function applyCutoff(store,preview){
 const keys=new Set(preview.remove.map(x=>x.week+'::'+x.id));
 for(const [week,value]of Object.entries(store.weeks||{})){
  if(!Array.isArray(value.tasks))continue;
  value.tasks=value.tasks.filter(t=>!keys.has(week+'::'+t.id));
  for(const t of value.tasks)if(preview.preserve.some(x=>x.week===week&&x.id===t.id)){
   t.seriesId=null;t.recurrence='none';t.recurrenceOverride=true;
  }
 }
}
root.WeekwiseTaskOptions=Object.freeze({COLORS,MINUTES,color,accent,colorStyle,breakAfter,validDate,ending,endForCount,cutoffPreview,applyCutoff,isAutomatic});
})(typeof window!=='undefined'?window:globalThis);
