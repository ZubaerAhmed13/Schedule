/* capture controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function defaultCaptureList(){
 if(weekwiseRuntime.workspaceView.startsWith('list-'))return weekwiseRuntime.workspaceView.slice(5);
 if(weekwiseRuntime.workspaceView.startsWith('folder:')){
  const folder=weekwiseRuntime.workspaceView.slice(7),existing=weekwiseRuntime.workspaceRecords().find(r=>(r.task.folderName||weekwiseRuntime.defaultFolderName(r.listId))===folder);
  return existing?.listId||'other';
 }
 if(weekwiseRuntime.workspaceView.startsWith('tag:')){
  const tag=weekwiseRuntime.workspaceView.slice(4).toLowerCase(),existing=weekwiseRuntime.workspaceRecords().find(r=>(Array.isArray(r.task.tags)?r.task.tags:[]).some(value=>String(value).replace(/^#/,'').toLowerCase()===tag));
  return existing?.listId||'other';
 }
 return 'inbox';
}

function addCapturedTaskForDate(title,targetDate,startMinutes,dueDate,listId,folderNameOverride=null,recurrence='none',tagsOverride=[]){
 const day=targetDate.getDay(),weekKey=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(targetDate)),duration=30,occurrenceDate=weekwiseRuntime.dateKey(targetDate);
 let rows,actualStart=null;
 if(weekKey===weekwiseRuntime.currentWeek)rows=weekwiseRuntime.tasks;
 else{
  if(!weekwiseRuntime.store.weeks[weekKey]||!Array.isArray(weekwiseRuntime.store.weeks[weekKey].tasks))weekwiseRuntime.store.weeks[weekKey]={...(weekwiseRuntime.store.weeks[weekKey]||{}),tasks:[]};
  rows=weekwiseRuntime.store.weeks[weekKey].tasks;
 }
 if(startMinutes!==null&&startMinutes!==undefined){
  const blockers=rows.filter(t=>t&&t.custom===true&&Number(t.day)===day&&t.start!==null&&t.start!==undefined&&!t.unscheduled&&Number(t.duration)>0);
  actualStart=weekwiseRuntime.findSlot(day,duration,startMinutes,0,1440,blockers);
 }
 const type=({career:'job',study:'study',work:'job',personal:'life',language:'language',hobbies:'hobby',other:'other',inbox:'other'})[listId]||'other';
 const task={id:weekwiseRuntime.uid(),day,title,type,duration,start:actualStart,done:false,status:'todo',custom:true,fixed:false,note:'',unscheduled:actualStart===null,listId,folderName:folderNameOverride||weekwiseRuntime.defaultFolderName(listId),sectionName:'',priority:'none',importance:'unclassified',urgency:'unclassified',dueDate:dueDate||null,reminderAt:null,reminderNotifiedAt:null,tags:Array.isArray(tagsOverride)?tagsOverride:[],subtasks:[],recurrence:recurrence||'none'};
 rows.push(task);
 if(recurrence&&recurrence!=='none'){
  task.seriesId=weekwiseRuntime.uid();task.occurrenceDate=occurrenceDate;
  const fields={title,type,duration,start:startMinutes,allDay:false,note:'',recurrence,listId,folderName:task.folderName,sectionName:'',priority:'none',status:'todo',importance:'unclassified',urgency:'unclassified',dueDate:dueDate||null,reminderAt:null,tags:Array.isArray(tagsOverride)?tagsOverride:[],subtasks:[]};
  weekwiseRuntime.upsertRecurringTemplate(task.seriesId,occurrenceDate,fields);
  weekwiseRuntime.materializeRecurringRange(weekwiseRuntime.parseKey(weekKey),weekwiseRuntime.parseKey(weekwiseRuntime.addDaysToKey(weekKey,89)));
 }
 if(weekKey===weekwiseRuntime.currentWeek)weekwiseRuntime.saveCurrent();else weekwiseRuntime.saveStore();
 weekwiseRuntime.renderAll();weekwiseRuntime.renderWorkspaceView();
 return {task,weekKey,actualStart};
}

function quickCaptureWorkspaceTask(keepRaw=false,approved=false){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const input=weekwiseRuntime.$('workspaceCaptureInput'),raw=String(input?.value||'').trim();if(!raw)return;
 const parsed=keepRaw?{title:raw}:weekwiseRuntime.parseWeekwiseNaturalCapture(raw,weekwiseRuntime.now),title=parsed.title;
 if(!keepRaw&&!approved&&(parsed.date||parsed.timeMatched||(parsed.recurrence&&parsed.recurrence!=='none'))){weekwiseRuntime.$('captureInterpretation').textContent=title+' · '+(parsed.date?'Date '+weekwiseRuntime.dateKey(parsed.date)+' · ':'')+(parsed.timeMatched?'Start '+weekwiseRuntime.minsTime(parsed.timeMinutes)+' · ':'')+(parsed.recurrence&&parsed.recurrence!=='none'?'Repeats '+parsed.recurrence:'');weekwiseRuntime.$('captureOriginal').textContent='Original: '+raw;weekwiseRuntime.$('captureConfirmDialog').showModal();return;}
 if(!title){weekwiseRuntime.showToast('Add a task name before the date or time.');return;}
 const date=parsed.date||weekwiseRuntime.dateOnly(weekwiseRuntime.now),dueDate=parsed.date?weekwiseRuntime.dateKey(parsed.date):null;
 const listId=weekwiseRuntime.defaultCaptureList();
 const start=parsed.timeMatched?parsed.timeMinutes:null;
 const selectedFolder=weekwiseRuntime.workspaceView.startsWith('folder:')?weekwiseRuntime.workspaceView.slice(7):null;
 const selectedTags=weekwiseRuntime.workspaceView.startsWith('tag:')?[weekwiseRuntime.workspaceView.slice(4)]:[];
 const result=weekwiseRuntime.addCapturedTaskForDate(title,date,start,dueDate,listId,selectedFolder,parsed.recurrence||'none',selectedTags);
 input.value='';
 if(parsed.recurrence&&parsed.recurrence!=='none')weekwiseRuntime.showToast('Added repeating task · '+parsed.recurrence+'.');
 else if(parsed.timeMatched&&result.actualStart===null)weekwiseRuntime.showToast('Task captured, but there was no free slot at that time. It needs scheduling.');
 else if(parsed.timeMatched&&result.actualStart!==start)weekwiseRuntime.showToast('Task scheduled at '+weekwiseRuntime.minsTime(result.actualStart)+' instead because that time was busy.');
 else if(parsed.timeMatched)weekwiseRuntime.showToast('Task scheduled · '+weekwiseRuntime.fmtDate(date,{weekday:'short',day:'numeric',month:'short'})+' at '+weekwiseRuntime.minsTime(result.actualStart)+'.');
 else if(dueDate)weekwiseRuntime.showToast('Task added · due '+weekwiseRuntime.fmtDate(date,{day:'numeric',month:'short'})+'.');
 else weekwiseRuntime.showToast(listId==='inbox'?'Added to Inbox':'Task added to '+listId+'.');
}

function escapeICSText(value){
 return String(value??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}

function icsUtcDateTime(date){
 return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}

function exportCalendarICS(){
 const records=weekwiseRuntime.workspaceRecords().filter(r=>{
  const t=r.task;return !!(t&&(t.allDay||(t.start!==null&&t.start!==undefined&&!t.unscheduled&&Number(t.duration)>0)||t.dueDate));
 });
 if(!records.length){weekwiseRuntime.showToast('Nothing scheduled or due to export yet.');return;}
 const stamp=weekwiseRuntime.icsUtcDateTime(new Date()),lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Weekwise//Personal Planner//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Weekwise'];
 records.forEach(record=>{
  const t=record.task,allDay=!!t.allDay||((t.start===null||t.start===undefined||t.unscheduled)&&!!t.dueDate);
  let startLine='',endLine='';
  if(allDay){
   const allDayKey=t.allDayDate||t.dueDate;
   startLine='DTSTART;VALUE=DATE:'+allDayKey.replace(/-/g,'');
   const next=new Date(weekwiseRuntime.parseKey(allDayKey));next.setDate(next.getDate()+1);
   endLine='DTEND;VALUE=DATE:'+weekwiseRuntime.dateKey(next).replace(/-/g,'');
  }else{
   const start=new Date(record.date.getFullYear(),record.date.getMonth(),record.date.getDate(),Math.floor(Number(t.start)/60),Number(t.start)%60,0);
   const end=new Date(record.date.getFullYear(),record.date.getMonth(),record.date.getDate(),Math.floor((Number(t.start)+Number(t.duration))/60),(Number(t.start)+Number(t.duration))%60,0);
   startLine='DTSTART:'+weekwiseRuntime.icsUtcDateTime(start);endLine='DTEND:'+weekwiseRuntime.icsUtcDateTime(end);
  }
  const listLabel=weekwiseRuntime.WORKSPACE_LISTS.find(x=>x.id===record.listId)?.label||'Inbox';
  const descriptions=[t.note||'', 'List: '+listLabel, 'Status: '+(t.done?'Completed':weekwiseRuntime.taskBoardStatus(t)), t.dueDate?'Deadline: '+t.dueDate:'', Array.isArray(t.tags)&&t.tags.length?'Tags: '+t.tags.join(', '):'',Array.isArray(t.attachments)&&t.attachments.length?'Links: '+t.attachments.join(', '):''].filter(Boolean).join('\n');
  lines.push('BEGIN:VEVENT','UID:'+weekwiseRuntime.escapeICSText(t.id+'@weekwise.local'),'DTSTAMP:'+stamp,startLine,endLine,'SUMMARY:'+weekwiseRuntime.escapeICSText(t.title),'DESCRIPTION:'+weekwiseRuntime.escapeICSText(descriptions),'X-WEEKWISE-STATUS:'+(t.done?'DONE':'OPEN'),'END:VEVENT');
 });
 lines.push('END:VCALENDAR');
 const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='weekwise-calendar-'+weekwiseRuntime.dateKey(weekwiseRuntime.now)+'.ics';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 weekwiseRuntime.showToast('Exported '+records.length+' events to .ics. Import the file into your calendar; it will not sync changes automatically.');
}

function createCustomList(){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const raw=prompt('Name your new list:');if(raw===null)return;
 const name=raw.trim().slice(0,60);if(!name){weekwiseRuntime.showToast('Enter a list name first.');return;}
 if(weekwiseRuntime.WORKSPACE_LISTS.some(list=>list.label.toLowerCase()===name.toLowerCase())){weekwiseRuntime.showToast('A list with that name already exists.');return;}
 const list={id:'custom_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,createdAt:new Date().toISOString()};
 weekwiseRuntime.store.customLists.push(list);weekwiseRuntime.syncWorkspaceLists();weekwiseRuntime.saveStore();weekwiseRuntime.renderAll();weekwiseRuntime.renderWorkspaceView();weekwiseRuntime.setWorkspaceView('list-'+list.id);weekwiseRuntime.showToast('List created.');
}

function renameCustomList(id){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const list=(weekwiseRuntime.store.customLists||[]).find(item=>item.id===id);if(!list)return;
 const raw=prompt('Rename list:',list.name);if(raw===null)return;
 const name=raw.trim().slice(0,60);if(!name){weekwiseRuntime.showToast('List name cannot be empty.');return;}
 if(weekwiseRuntime.WORKSPACE_LISTS.some(item=>item.id!==id&&item.label.toLowerCase()===name.toLowerCase())){weekwiseRuntime.showToast('A list with that name already exists.');return;}
 const oldName=list.name;list.name=name;
 weekwiseRuntime.workspaceRecords().forEach(record=>{if(record.task.listId===id&&record.task.folderName===oldName)record.task.folderName=name;});
 (weekwiseRuntime.store.recurringTemplates||[]).forEach(template=>{if(template.listId===id&&template.folderName===oldName)template.folderName=name;});
 weekwiseRuntime.syncWorkspaceLists();weekwiseRuntime.saveCurrent();weekwiseRuntime.saveStore();weekwiseRuntime.renderAll();weekwiseRuntime.renderWorkspaceView();weekwiseRuntime.showToast('List renamed.');
}
return Object.freeze({defaultCaptureList,addCapturedTaskForDate,quickCaptureWorkspaceTask,escapeICSText,icsUtcDateTime,exportCalendarICS,createCustomList,renameCustomList});
}
root.WeekwiseAppCapture=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
