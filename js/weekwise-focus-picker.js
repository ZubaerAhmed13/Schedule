/* Read-only task selection: search all records, render one bounded page. */
(function(root){
 'use strict';
 const SIZE=100;
 const ref=record=>record.week+'::'+record.task.id;
 function page(records,{query='',index=0,selectedRef='',sessionTask=null}={}){
  const search=String(query).trim().toLowerCase();
  const matches=records.filter(record=>!record.task.done&&(!search||[
   record.task.title,record.task.note,record.task.folderName,record.task.sectionName,
   ...(Array.isArray(record.task.tags)?record.task.tags:[])
  ].join(' ').toLowerCase().includes(search)));
  const last=Math.max(0,Math.ceil(matches.length/SIZE)-1);
  const current=Math.min(last,Math.max(0,Number.isInteger(index)?index:0));
  const start=current*SIZE,items=matches.slice(start,start+SIZE);
  let selected=records.find(record=>ref(record)===selectedRef)||null;
  // A saved session's identity survives removal/completion of its task.
  if(!selected&&sessionTask&&sessionTask.week+'::'+sessionTask.id===selectedRef){
   selected={week:sessionTask.week,task:{id:sessionTask.id,title:sessionTask.title||'Saved session task'},date:null,unavailable:true};
  }
  const pinned=selected&&!items.some(record=>ref(record)===selectedRef)?selected:null;
  return {items,pinned,index:current,total:matches.length,start:matches.length?start+1:0,end:start+items.length,hasPrevious:current>0,hasNext:current<last};
 }
 root.WeekwiseFocusPicker=Object.freeze({page,ref,SIZE});
})(typeof window!=='undefined'?window:globalThis);
