/* transfers controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function unescapeICSText(value){
 return String(value||'').replace(/\\[nN]/g,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\');
}

function parseICSDateProperty(prop){return WeekwiseTimeZones.parseDateProperty(prop);}

function parseICSProperties(text){
 const sourceLines=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n'),lines=[];
 sourceLines.forEach(line=>{if(/^[ \t]/.test(line)&&lines.length)lines[lines.length-1]+=line.slice(1);else lines.push(line);});
 const events=[];let current=null;
 lines.forEach(line=>{
  if(line==='BEGIN:VEVENT'){current={};return;}
  if(line==='END:VEVENT'){if(current)events.push(current);current=null;return;}
  if(!current)return;
  const colon=line.indexOf(':');if(colon<1)return;
  const head=line.slice(0,colon).split(';'),name=head.shift().toUpperCase(),params={};
  head.forEach(piece=>{const equal=piece.indexOf('=');if(equal>0)params[piece.slice(0,equal).toUpperCase()]=piece.slice(equal+1).replace(/^"|"$/g,'');});
  if(!current[name])current[name]={value:line.slice(colon+1),params};
 });
 return events;
}

async function importCalendarICS(file){
 if(!weekwiseRuntime.dataCanWrite())return;
 const readingOwner=weekwiseRuntime.currentDataOwner,readingEpoch=weekwiseRuntime.cloudSessionEpoch,readingDisk=localStorage.getItem(weekwiseRuntime.STORE_KEY);
 const unchanged=()=>readingOwner===weekwiseRuntime.currentDataOwner&&readingEpoch===weekwiseRuntime.cloudSessionEpoch&&readingDisk===localStorage.getItem(weekwiseRuntime.STORE_KEY);
 if(!file||file.size>WeekwiseData.MAX_BACKUP_BYTES)throw new Error('Calendar file must be smaller than 10 MB.');
 const text=await file.text();if(!unchanged())throw new Error('Planner changed while reading the calendar file. Choose it again.');
 const events=weekwiseRuntime.parseICSProperties(text);
 if(events.length>10000)throw new Error('Import up to 10,000 calendar events at a time.');
 if(!events.length){weekwiseRuntime.showToast('No calendar events were found in that .ics file.');return;}
 // Stage the entire import. Never change the live store during parsing or user review.
 const next=JSON.parse(JSON.stringify(weekwiseRuntime.store));
 next.weeks[weekwiseRuntime.currentWeek]={...(next.weeks[weekwiseRuntime.currentWeek]||{}),tasks:JSON.parse(JSON.stringify(weekwiseRuntime.tasks))};
 const known=new Set();
 Object.values(next.weeks).forEach(week=>(week.tasks||[]).forEach(t=>{
  if(t.externalUid)known.add(String(t.externalUid));
  known.add(String(t.id)+'@weekwise.local');
 }));
 let added=0,skipped=0,invalid=0,firstProblem='';
 for(const event of events){
  try{
   if(!event.DTSTART)throw new Error('Missing DTSTART.');
   if(event.RRULE||event['RECURRENCE-ID'])throw new Error('Recurring iCalendar items require manual review; no partial series imported.');
   const start=weekwiseRuntime.parseICSDateProperty(event.DTSTART),end=event.DTEND?weekwiseRuntime.parseICSDateProperty(event.DTEND):null;
   if(end&&start.allDay!==end.allDay)throw new Error('Event date types differ.');
   const title=(weekwiseRuntime.unescapeICSText(event.SUMMARY?.value)||'Imported calendar event').trim().slice(0,300);
   const externalUid=(weekwiseRuntime.unescapeICSText(event.UID?.value)||('weekwise-import:'+title+'|'+event.DTSTART.value)).slice(0,500);
   if(known.has(externalUid)){skipped++;continue;}
   const date=weekwiseRuntime.dateOnly(start.date),weekKey=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(date)),day=date.getDay(),isAllDay=start.allDay;
   let startMinutes=null,duration=0;
   if(isAllDay){
    if(end&&end.date.getTime()<=start.date.getTime())throw new Error('All-day event end must be after start.');
    if(end&&Math.round((Date.UTC(end.date.getFullYear(),end.date.getMonth(),end.date.getDate())-Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()))/86400000)!==1)
     throw new Error('Multi-day all-day imports need manual splitting.');
   }else{
    if(start.date.getSeconds()!==0||end&&end.date.getSeconds()!==0)throw new Error('Seconds-resolution event cannot be represented precisely.');
    startMinutes=start.date.getHours()*60+start.date.getMinutes();
    const durationMs=end?end.date.getTime()-start.date.getTime():30*60000;
    if(durationMs<60000||durationMs>1440*60000||durationMs%60000!==0)throw new Error('Event duration is outside 1–1440 whole minutes.');
    duration=durationMs/60000;
   }
   const task={id:weekwiseRuntime.uid(),externalUid,calendarImportSource:'ics',day,title,type:'other',duration,start:startMinutes,done:false,status:'todo',custom:true,fixed:false,note:weekwiseRuntime.unescapeICSText(event.DESCRIPTION?.value).slice(0,5000),unscheduled:false,allDay:isAllDay,allDayDate:isAllDay?weekwiseRuntime.dateKey(date):null,listId:'other',folderName:weekwiseRuntime.defaultFolderName('other'),sectionName:'',priority:'none',importance:'unclassified',urgency:'unclassified',dueDate:null,reminderAt:null,reminderNotifiedAt:null,tags:[],subtasks:[],recurrence:'none'};
   if(!next.weeks[weekKey])next.weeks[weekKey]={tasks:[]};
   next.weeks[weekKey].tasks.push(task);known.add(externalUid);added++;
  }catch(error){invalid++;if(!firstProblem)firstProblem=String(error.message||'Unsupported event').slice(0,180);}
 }
 if(!added){weekwiseRuntime.showToast('No events imported: '+skipped+' duplicates, '+invalid+' unsupported. '+firstProblem);return;}
 WeekwiseData.validateStore(next);
 const details=invalid?' '+invalid+' unsupported events will be skipped'+(firstProblem?' (first: '+firstProblem+').':'.'):'';
 if(!confirm('Import '+added+' new calendar '+(added===1?'event':'events')+'?'+(skipped?' '+skipped+' already exist.':'')+details+' Timed events will use your device time zone ('+Intl.DateTimeFormat().resolvedOptions().timeZone+'). Existing records stay unchanged.'))return;
 if(!unchanged())throw new Error('Planner changed during calendar review. Import the file again.');
 if(!weekwiseRuntime.dataCanWrite())return;
 // saveStore uses checked local transactions and restores the prior in-memory copy on failure.
 weekwiseRuntime.store=next;
 weekwiseRuntime.tasks=JSON.parse(JSON.stringify(next.weeks[weekwiseRuntime.currentWeek]?.tasks||[]));
 if(!weekwiseRuntime.saveStore())throw new Error('Import not saved. Previous planner records were preserved.');
 weekwiseRuntime.renderAll();weekwiseRuntime.renderWorkspaceView();
 weekwiseRuntime.showToast('Imported '+added+' events'+(skipped?' · '+skipped+' duplicates skipped':'')+(invalid?' · '+invalid+' unsupported skipped':'')+'.');
}

function toggleVoiceCapture(){
 const button=weekwiseRuntime.$('voiceCaptureBtn'),input=weekwiseRuntime.$('workspaceCaptureInput');
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){weekwiseRuntime.showToast('Voice capture is not supported by this browser. You can still type or use the keyboard shortcut.');return;}
 if(weekwiseRuntime.activeVoiceRecognition){try{weekwiseRuntime.activeVoiceRecognition.stop();}catch(_){}return;}
 try{
  const recognition=new Recognition();
  recognition.lang=navigator.language||'en-US';
  recognition.interimResults=false;
  recognition.maxAlternatives=1;
  weekwiseRuntime.activeVoiceRecognition=recognition;
  button.setAttribute('aria-pressed','true');button.title='Stop voice capture';button.textContent='■';
  recognition.onresult=event=>{
   const transcript=String(event.results?.[0]?.[0]?.transcript||'').trim();
   if(transcript){const existing=String(input.value||'').trim();input.value=[existing,transcript].filter(Boolean).join(' ');input.focus();try{input.setSelectionRange(input.value.length,input.value.length);}catch(_){}}
  };
  recognition.onerror=event=>{if(event.error!=='no-speech'&&event.error!=='aborted')weekwiseRuntime.showToast('Voice capture stopped. Type your task if the browser cannot recognize speech.');};
  recognition.onend=()=>{weekwiseRuntime.activeVoiceRecognition=null;button.setAttribute('aria-pressed','false');button.title='Capture by voice where supported';button.textContent='🎙';};
  recognition.start();weekwiseRuntime.showToast('Listening. Say the task and any date or time, then review before adding.');
 }catch(error){
  weekwiseRuntime.activeVoiceRecognition=null;button.setAttribute('aria-pressed','false');button.title='Capture by voice where supported';button.textContent='🎙';
  weekwiseRuntime.showToast('Could not start voice capture in this browser.');
 }
}

function exportCurrentTaskList(){
 if(!root.WeekwiseJsonFiles.allowed(weekwiseRuntime.currentDataOwner))return;
 const settingsTransfer=weekwiseRuntime.workspaceView==='settings';
 const records=settingsTransfer?weekwiseRuntime.workspaceRecords():weekwiseRuntime.recordsForListTransfer();
 if(!records.length){weekwiseRuntime.showToast(weekwiseRuntime.workspaceView==='filters'?'Choose a saved filter before exporting it.':'There are no tasks in this view to export.');return;}
 const seriesIds=new Set(records.map(r=>r.task.seriesId).filter(Boolean));
 const templates=(weekwiseRuntime.store.recurringTemplates||[]).filter(template=>seriesIds.has(template.id)).map(template=>({...template,reminderRules:[],reminderOffsetDays:null,reminderTime:null}));
 const listIds=new Set(records.map(r=>r.listId));
 const customLists=(weekwiseRuntime.store.customLists||[]).filter(list=>listIds.has(list.id));
 const data={
  app:'Weekwise',
  kind:'shared-task-list',
  schemaVersion:1,
  title:settingsTransfer?'All tasks':weekwiseRuntime.shareViewTitle(),
  sourceView:settingsTransfer?'all':weekwiseRuntime.workspaceView,
  exportedAt:new Date().toISOString(),
  note:'This is a portable list file. Import it into another Weekwise workspace to copy these tasks; it does not create live collaboration.',
  customLists,
  recurringTemplates:templates,
  tasks:records.map(record=>{
   const t=record.task;
   return {
    sourceDate:weekwiseRuntime.dateKey(record.date),title:String(t.title||''),type:t.type||'other',listId:record.listId,
    folderName:t.folderName||weekwiseRuntime.defaultFolderName(record.listId),sectionName:t.sectionName||'',
    note:t.note||'',start:t.start??null,duration:Number(t.duration)||30,allDay:!!t.allDay,allDayDate:t.allDayDate||null,
    unscheduled:!!t.unscheduled,done:!!t.done,status:weekwiseRuntime.taskBoardStatus(t),
    priority:t.priority||'none',importance:t.importance||'unclassified',urgency:t.urgency||'unclassified',
    dueDate:t.dueDate||null,focusEstimateMinutes:t.focusEstimateMinutes||null,
    tags:Array.isArray(t.tags)?t.tags:[],subtasks:Array.isArray(t.subtasks)?t.subtasks:[],
    attachments:Array.isArray(t.attachments)?t.attachments:[],recurrence:t.recurrence||'none',
    seriesId:t.seriesId||null,occurrenceDate:t.occurrenceDate||null
   };
  })
 };
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 const slug=String(data.title||'tasks').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,45)||'tasks';
 a.href=url;a.download='weekwise-'+slug+'-'+weekwiseRuntime.dateKey(weekwiseRuntime.now)+'.json';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 weekwiseRuntime.showToast('Exported '+records.length+' task'+(records.length===1?'':'s')+'. Review the file before sharing it.');
}

function validTransferDate(value,fallback){
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){
  const d=weekwiseRuntime.parseKey(value);if(Number.isFinite(d.getTime())&&weekwiseRuntime.dateKey(d)===value)return d;
 }
 return weekwiseRuntime.dateOnly(fallback||weekwiseRuntime.now);
}

function transferDestinationList(){
 if(weekwiseRuntime.workspaceView.startsWith('list-')||weekwiseRuntime.workspaceView.startsWith('folder:')||weekwiseRuntime.workspaceView.startsWith('tag:'))return weekwiseRuntime.defaultCaptureList();
 return null;
}

async function importSharedTaskList(file){if(!root.WeekwiseJsonFiles.allowed(weekwiseRuntime.currentDataOwner))return;if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 if(!file)return;
 try{
  if(file.size>12*1024*1024){weekwiseRuntime.showToast('This list file is larger than 12 MB. Ask for a smaller export.');return;}
  const readingOwner=weekwiseRuntime.currentDataOwner,readingEpoch=weekwiseRuntime.cloudSessionEpoch;
  const data=JSON.parse(await file.text());
  if(!root.WeekwiseJsonFiles.allowed(weekwiseRuntime.currentDataOwner)||readingOwner!==weekwiseRuntime.currentDataOwner||readingEpoch!==weekwiseRuntime.cloudSessionEpoch)return;
  if(data?.app!=='Weekwise'||data?.kind!=='shared-task-list'||data?.schemaVersion!==1||!Array.isArray(data.tasks)){
   weekwiseRuntime.showToast('That file is not a supported Weekwise list export.');return;
  }
  if(data.tasks.length>1000){weekwiseRuntime.showToast('This list contains more than 1,000 tasks. Export a smaller list first.');return;}
  const destination=weekwiseRuntime.transferDestinationList();
  const destinationName=destination?(weekwiseRuntime.WORKSPACE_LISTS.find(list=>list.id===destination)?.label||destination):'the original lists';
  const taskCount=data.tasks.length;
  if(!taskCount){weekwiseRuntime.showToast('This list export contains no tasks.');return;}
  if(!confirm('Import '+taskCount+' task'+(taskCount===1?'':'s')+' from "'+String(data.title||'Shared list').slice(0,90)+'" into '+destinationName+'? This copies the tasks; it does not enable live shared editing.'))return;

  if(!Array.isArray(weekwiseRuntime.store.customLists))weekwiseRuntime.store.customLists=[];
  const incomingLists=Array.isArray(data.customLists)?data.customLists:[];
  const listIdMap=new Map();
  for(const sourceList of incomingLists){
   if(!sourceList||typeof sourceList.name!=='string'||!sourceList.name.trim())continue;
   const existing=weekwiseRuntime.store.customLists.find(list=>String(list.name||'').trim().toLowerCase()===sourceList.name.trim().toLowerCase());
   if(existing)listIdMap.set(sourceList.id,existing.id);
   else{
    let newId='custom_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    while(weekwiseRuntime.WORKSPACE_LISTS.some(list=>list.id===newId)||listIdMap.has(newId))newId='custom_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    const copy={id:newId,name:sourceList.name.trim().slice(0,60),createdAt:new Date().toISOString()};
    weekwiseRuntime.store.customLists.push(copy);listIdMap.set(sourceList.id,newId);
   }
  }
  weekwiseRuntime.syncWorkspaceLists();
  const sourceSeriesIds=new Set((Array.isArray(data.recurringTemplates)?data.recurringTemplates:[]).map(template=>template?.id).filter(Boolean));
  const seriesIdMap=new Map([...sourceSeriesIds].map(id=>[id,weekwiseRuntime.uid()]));
  if(!Array.isArray(weekwiseRuntime.store.recurringTemplates))weekwiseRuntime.store.recurringTemplates=[];
  (Array.isArray(data.recurringTemplates)?data.recurringTemplates:[]).forEach(template=>{
   if(!template||!sourceSeriesIds.has(template.id))return;
   const copy={...template,id:seriesIdMap.get(template.id),
    listId:destination||listIdMap.get(template.listId)||template.listId||'inbox',
    tags:Array.isArray(template.tags)?[...template.tags]:[],
    subtasks:Array.isArray(template.subtasks)?template.subtasks.map(sub=>({...sub})):[],
    attachments:Array.isArray(template.attachments)?template.attachments.map(item=>({...item})):[],
    excludedDates:Array.isArray(template.excludedDates)?[...template.excludedDates]:[],
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
   weekwiseRuntime.store.recurringTemplates.push(copy);
  });
  let imported=0,failed=0,shifted=0;
  const seriesWithTemplate=new Set(sourceSeriesIds);
  for(const source of data.tasks){
   if(!source||typeof source.title!=='string'||!source.title.trim()){failed++;continue;}
   const date=weekwiseRuntime.validTransferDate(source.sourceDate,weekwiseRuntime.now),weekKey=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(date)),day=date.getDay();
   let rows;
   if(weekKey===weekwiseRuntime.currentWeek)rows=weekwiseRuntime.tasks;
   else{
    if(!weekwiseRuntime.store.weeks[weekKey]||!Array.isArray(weekwiseRuntime.store.weeks[weekKey].tasks))weekwiseRuntime.store.weeks[weekKey]={...(weekwiseRuntime.store.weeks[weekKey]||{}),tasks:[]};
    rows=weekwiseRuntime.store.weeks[weekKey].tasks;
   }
   const duration=Math.max(5,Math.min(1440,Number(source.duration)||30));
   let start=null,unscheduled=source.unscheduled!==false;
   if(source.allDay){unscheduled=false;}
   else if(!unscheduled&&source.start!==null&&source.start!==undefined&&Number.isFinite(Number(source.start))){
    const preferred=Math.max(0,Math.min(1439,Math.round(Number(source.start))));
    const blockers=rows.filter(item=>item&&item.custom===true&&Number(item.day)===day&&item.start!==null&&item.start!==undefined&&!item.unscheduled&&Number(item.duration)>0);
    start=weekwiseRuntime.findSlot(day,duration,preferred,0,1440,blockers);
    unscheduled=start===null;if(unscheduled||start!==preferred)shifted++;
   }
   const sourceListId=String(source.listId||'inbox');
   const listId=destination||listIdMap.get(sourceListId)||(weekwiseRuntime.WORKSPACE_LISTS.some(list=>list.id===sourceListId)?sourceListId:'inbox');
   const seriesId=source.seriesId&&seriesIdMap.has(source.seriesId)?seriesIdMap.get(source.seriesId):null;
   const recurrence=seriesId?(source.recurrence||'none'):'none';
   const task={
    id:weekwiseRuntime.uid(),day,title:source.title.trim().slice(0,180),type:source.type||'other',duration,
    start:source.allDay?null:start,allDay:!!source.allDay,allDayDate:source.allDay?(source.allDayDate||weekwiseRuntime.dateKey(date)):null,
    done:!!source.done||source.status==='done',status:(source.done||source.status==='done')?'done':(['todo','in-progress'].includes(source.status)?source.status:'todo'),
    custom:true,fixed:false,note:String(source.note||'').slice(0,4000),unscheduled:source.allDay?false:unscheduled,
    listId,folderName:destination?(weekwiseRuntime.workspaceView.startsWith('folder:')?weekwiseRuntime.workspaceView.slice(7):weekwiseRuntime.defaultFolderName(destination)):(String(source.folderName||'').slice(0,100)||weekwiseRuntime.defaultFolderName(listId)),
    sectionName:String(source.sectionName||'').slice(0,100),priority:['none','low','medium','high'].includes(source.priority)?source.priority:'none',
    importance:['unclassified','important','not-important'].includes(source.importance)?source.importance:'unclassified',
    urgency:['unclassified','urgent','not-urgent'].includes(source.urgency)?source.urgency:'unclassified',
    dueDate:typeof source.dueDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(source.dueDate)&&weekwiseRuntime.dateKey(weekwiseRuntime.parseKey(source.dueDate))===source.dueDate?source.dueDate:null,
    focusEstimateMinutes:Math.max(0,Math.min(1440,Number(source.focusEstimateMinutes)||0))||null,
    tags:Array.isArray(source.tags)?source.tags.map(tag=>String(tag).slice(0,80)).filter(Boolean).slice(0,30):[],
    subtasks:Array.isArray(source.subtasks)?source.subtasks.slice(0,100).map(sub=>typeof sub==='string'?{id:weekwiseRuntime.uid(),title:sub.slice(0,500),done:false}:{id:weekwiseRuntime.uid(),title:String(sub?.title||'').slice(0,500),done:!!sub?.done}):[],
    attachments:Array.isArray(source.attachments)?source.attachments.slice(0,30).map(item=>typeof item==='string'?item.slice(0,1000):({...item})):[],
    recurrence,seriesId,occurrenceDate:seriesId?(source.occurrenceDate||weekwiseRuntime.dateKey(date)):null,
    reminderAt:null,reminderTimes:[],reminderNotifiedAt:null,reminderNotifiedTimes:[],
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
   };
   rows.push(task);imported++;
  }
  weekwiseRuntime.saveCurrent();weekwiseRuntime.saveStore();
  weekwiseRuntime.materializeRecurringRange(weekwiseRuntime.parseKey(weekwiseRuntime.currentWeek),weekwiseRuntime.parseKey(weekwiseRuntime.addDaysToKey(weekwiseRuntime.currentWeek,89)));
  weekwiseRuntime.renderAll();weekwiseRuntime.renderWorkspaceView();
  const notes=(shifted?', '+shifted+' scheduled task'+(shifted===1?' was':'s were')+' moved to the nearest available time':'')+(failed?', '+failed+' invalid entr'+(failed===1?'y was':'ies were')+' skipped':'');
  weekwiseRuntime.showToast('Imported '+imported+' task'+(imported===1?'':'s')+notes+'.');
 }catch(error){
  console.error('Weekwise list import failed',error);
  weekwiseRuntime.showToast('Could not import that list file. Check that it is a valid Weekwise export.');
 }
}

async function copyTaskPlanningPrompt(){
 const title=String(weekwiseRuntime.$('modalTitleInput').value||'').trim();
 if(!title){weekwiseRuntime.showToast('Enter a task title first, then copy the planning prompt.');weekwiseRuntime.$('modalTitleInput').focus();return;}
 const note=String(weekwiseRuntime.$('modalNote').value||'').trim();
 const listId=weekwiseRuntime.$('modalListId').value,listName=weekwiseRuntime.WORKSPACE_LISTS.find(list=>list.id===listId)?.label||listId;
 const category=weekwiseRuntime.$('modalCategory').selectedOptions[0]?.textContent||weekwiseRuntime.$('modalCategory').value;
 const priority=weekwiseRuntime.$('modalPriority').value,focusEstimate=weekwiseRuntime.$('modalFocusEstimate').value.trim();
 const dueDate=weekwiseRuntime.$('modalDueDate').value,recurrence=weekwiseRuntime.$('modalRecurrence').value;
 const existing=String(weekwiseRuntime.$('modalSubtasks').value||'').trim();
 const links=String(weekwiseRuntime.$('modalAttachments').value||'').trim();
 const prompt=[
  'Help me turn the following task into a realistic, actionable checklist.',
  '',
  'Task: '+title,
  'Category: '+category,
  'List: '+listName,
  'Priority: '+priority,
  dueDate?'Due date: '+dueDate:null,
  recurrence&&recurrence!=='none'?'Repeat: '+recurrence:null,
  focusEstimate?'Estimated focused effort: '+focusEstimate+' minutes':null,
  note?'Context / notes: '+note:null,
  links?'Reference links:\n'+links:null,
  existing?'Existing subtasks to improve or keep:\n'+existing:null,
  '',
  'Requirements:',
  '- Suggest 3–7 small, specific steps in a sensible order.',
  '- Use plain language and start each step with a concrete action verb.',
  '- Respect the due date and effort estimate; do not invent facts or mark anything complete.',
  '- Return only the checklist, one step per line, without numbering or introductory text, so I can paste it into the Subtasks field.'
 ].filter(line=>line!==null).join('\n');
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(prompt);
  else throw new Error('Clipboard API unavailable');
  weekwiseRuntime.showToast('Planning prompt copied. Paste it into your chosen AI tool; no task data was sent.');
 }catch(_){
  const area=document.createElement('textarea');area.value=prompt;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();
  let copied=false;try{copied=document.execCommand('copy');}catch(__){}
  area.remove();
  if(copied)weekwiseRuntime.showToast('Planning prompt copied. Paste it into your chosen AI tool; no task data was sent.');
  else window.prompt('Copy this planning prompt into your chosen AI tool:',prompt);
 }
}
return Object.freeze({unescapeICSText,parseICSDateProperty,parseICSProperties,importCalendarICS,toggleVoiceCapture,exportCurrentTaskList,validTransferDate,transferDestinationList,importSharedTaskList,copyTaskPlanningPrompt});
}
root.WeekwiseAppTransfers=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
