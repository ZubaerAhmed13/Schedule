/* notifications controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
let reminderCheckBusy=false;const memoryReceipts=new Map();


function reminderTodayKey(){return weekwiseRuntime.dateKey(new Date());}

function reminderState(note){if(note.done)return {label:'Completed',kind:'done'};if(!note.date)return {label:'No date',kind:'none'};const today=weekwiseRuntime.reminderTodayKey();if(note.date<today)return {label:'Overdue',kind:'overdue'};if(note.date===today)return {label:'Due today',kind:'today'};return {label:weekwiseRuntime.fmtDate(weekwiseRuntime.parseKey(note.date),{day:'numeric',month:'short'}),kind:'upcoming'};}

function reminderDueOpen(){return weekwiseRuntime.reminders.filter(n=>!n.done&&n.date&&n.date<=weekwiseRuntime.reminderTodayKey());}

function updateReminderBadge(){const badge=weekwiseRuntime.$('reminderBadge');if(!badge)return;const count=weekwiseRuntime.reminderDueOpen().length;badge.textContent=String(count);badge.hidden=count===0;const menu=weekwiseRuntime.$('remindersMenuBtn');if(menu)menu.setAttribute('aria-label',count?'Reminders and sticky notes, '+count+' due':'Reminders and sticky notes');}

function reminderFormReset(){weekwiseRuntime.$('reminderId').value='';weekwiseRuntime.$('reminderTitle').value='';weekwiseRuntime.$('reminderBody').value='';weekwiseRuntime.$('reminderDate').value='';weekwiseRuntime.$('reminderColour').value='yellow';weekwiseRuntime.$('reminderPinned').checked=false;weekwiseRuntime.$('saveReminderBtn').textContent='＋ Save reminder';weekwiseRuntime.$('cancelReminderEdit').hidden=true;}

function reminderEdit(id){const note=weekwiseRuntime.reminders.find(n=>n.id===id);if(!note)return;weekwiseRuntime.$('reminderId').value=note.id;weekwiseRuntime.$('reminderTitle').value=note.title||'';weekwiseRuntime.$('reminderBody').value=note.body||'';weekwiseRuntime.$('reminderDate').value=note.date||'';weekwiseRuntime.$('reminderColour').value=note.colour||'yellow';weekwiseRuntime.$('reminderPinned').checked=!!note.pinned;weekwiseRuntime.$('saveReminderBtn').textContent='Save changes';weekwiseRuntime.$('cancelReminderEdit').hidden=false;weekwiseRuntime.$('reminderTitle').focus();}

function reminderSave(e){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}e.preventDefault();const title=weekwiseRuntime.$('reminderTitle').value.trim();if(!title){weekwiseRuntime.$('reminderTitle').focus();return;}const id=weekwiseRuntime.$('reminderId').value,fields={title,body:weekwiseRuntime.$('reminderBody').value.trim(),date:weekwiseRuntime.$('reminderDate').value||'',colour:weekwiseRuntime.$('reminderColour').value||'yellow',pinned:weekwiseRuntime.$('reminderPinned').checked,updatedAt:new Date().toISOString()};if(id){const note=weekwiseRuntime.reminders.find(n=>n.id===id);if(note)Object.assign(note,fields);}else weekwiseRuntime.reminders.push({id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),...fields,done:false,createdAt:new Date().toISOString()});weekwiseRuntime.saveReminders();weekwiseRuntime.reminderFormReset();weekwiseRuntime.renderReminders();weekwiseRuntime.showToast(id?'Reminder updated':'Reminder saved');}

function reminderToggleDone(id){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}const note=weekwiseRuntime.reminders.find(n=>n.id===id);if(!note)return;note.done=!note.done;note.updatedAt=new Date().toISOString();weekwiseRuntime.saveReminders();weekwiseRuntime.renderReminders();weekwiseRuntime.showToast(note.done?'Reminder completed':'Reminder reopened');}

function reminderTogglePin(id){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}const note=weekwiseRuntime.reminders.find(n=>n.id===id);if(!note)return;note.pinned=!note.pinned;weekwiseRuntime.saveReminders();weekwiseRuntime.renderReminders();}

function reminderDelete(id){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}const note=weekwiseRuntime.reminders.find(n=>n.id===id);if(!note)return;if(!confirm('Delete this reminder?'))return;weekwiseRuntime.reminders=weekwiseRuntime.reminders.filter(n=>n.id!==id);weekwiseRuntime.saveReminders();weekwiseRuntime.renderReminders();weekwiseRuntime.showToast('Reminder deleted');}

function renderReminders(){
 const list=weekwiseRuntime.$('reminderList');if(!list)return;weekwiseRuntime.updateReminderBadge();const filter=weekwiseRuntime.$('reminderFilter')?.value||'open';let items=weekwiseRuntime.reminders.slice();if(filter==='open')items=items.filter(n=>!n.done);if(filter==='done')items=items.filter(n=>n.done);if(filter==='due')items=items.filter(n=>!n.done&&n.date&&n.date<=weekwiseRuntime.reminderTodayKey());
 items.sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||Number(!!a.done)-Number(!!b.done)||((a.date||'9999-12-31').localeCompare(b.date||'9999-12-31'))||(b.createdAt||'').localeCompare(a.createdAt||''));
 const due=weekwiseRuntime.reminderDueOpen().length,open=weekwiseRuntime.reminders.filter(n=>!n.done).length;const summary=weekwiseRuntime.$('reminderSummary');if(summary)summary.textContent=open+' open · '+due+' due today or overdue · '+weekwiseRuntime.reminders.length+' total';
 if(!items.length){list.innerHTML='<div class="reminder-empty">'+(weekwiseRuntime.reminders.length?'No notes match this filter.':'Your sticky-note space is empty. Add a reminder above — with or without a date.')+'</div>';return;}
 list.innerHTML=items.map(n=>{const st=weekwiseRuntime.reminderState(n),colour=['yellow','purple','blue','green','pink'].includes(n.colour)?n.colour:'yellow';return '<article class="sticky-note note-'+colour+(n.done?' note-done':'')+(n.pinned?' is-pinned':'')+'" data-reminder-id="'+weekwiseRuntime.escapeHtml(n.id)+'"><div class="sticky-note-top"><div class="sticky-note-markers">'+(n.pinned?'<span class="sticky-tag">Pinned</span>':'')+'<span class="sticky-tag">'+weekwiseRuntime.escapeHtml(st.label)+'</span></div><button class="sticky-pin" type="button" data-reminder-pin="'+weekwiseRuntime.escapeHtml(n.id)+'" aria-label="'+(n.pinned?'Unpin':'Pin')+' reminder" title="'+(n.pinned?'Unpin':'Pin')+'">'+(n.pinned?'📌':'＋')+'</button></div><h4 class="'+(n.done?'is-done':'')+'">'+weekwiseRuntime.escapeHtml(n.title)+'</h4>'+(n.body?'<p>'+weekwiseRuntime.escapeHtml(n.body)+'</p>':'')+'<div class="sticky-note-foot"><span class="sticky-note-date">'+(n.date?'◷ '+weekwiseRuntime.escapeHtml(st.label):'✦ Flexible reminder')+'</span><div class="sticky-note-actions"><button type="button" data-reminder-done="'+weekwiseRuntime.escapeHtml(n.id)+'">'+(n.done?'Reopen':'Done')+'</button><button type="button" data-reminder-edit="'+weekwiseRuntime.escapeHtml(n.id)+'">Edit</button><button type="button" data-reminder-delete="'+weekwiseRuntime.escapeHtml(n.id)+'">×</button></div></div></article>';}).join('');
 list.querySelectorAll('[data-reminder-done]').forEach(b=>b.addEventListener('click',()=>weekwiseRuntime.reminderToggleDone(b.dataset.reminderDone)));
 list.querySelectorAll('[data-reminder-pin]').forEach(b=>b.addEventListener('click',()=>weekwiseRuntime.reminderTogglePin(b.dataset.reminderPin)));
 list.querySelectorAll('[data-reminder-edit]').forEach(b=>b.addEventListener('click',()=>weekwiseRuntime.reminderEdit(b.dataset.reminderEdit)));
 list.querySelectorAll('[data-reminder-delete]').forEach(b=>b.addEventListener('click',()=>weekwiseRuntime.reminderDelete(b.dataset.reminderDelete)));
}

function openReminders(){weekwiseRuntime.renderReminders();weekwiseRuntime.openUtilityPanel('remindersPanel','Reminders & sticky notes');}

function nudgeDueReminders(){const due=weekwiseRuntime.reminderDueOpen();if(!due.length)return;const today=weekwiseRuntime.reminderTodayKey();let seen='';try{seen=localStorage.getItem('weekwise-reminder-nudge-v1')||'';}catch(_){}if(seen===today)return;try{localStorage.setItem('weekwise-reminder-nudge-v1',today);}catch(_){}weekwiseRuntime.showToast(due.length===1?'You have 1 reminder due. Open More → Reminders & sticky notes.':'You have '+due.length+' reminders due. Open More → Reminders & sticky notes.');}

function cloudFingerprint(payload){return root.WeekwiseCloudMerge?.fingerprint(payload)||JSON.stringify(payload);}

async function enableTaskNotifications(){
 if(!('Notification' in window)){weekwiseRuntime.showToast('This browser does not support notifications.');weekwiseRuntime.renderTaskNotificationSettings();return;}
 try{const permission=await Notification.requestPermission();weekwiseRuntime.renderTaskNotificationSettings();if(permission==='granted'){weekwiseRuntime.showToast('Browser alerts enabled.');weekwiseRuntime.checkTaskReminders();}else weekwiseRuntime.showToast(permission==='denied'?'Browser alerts are blocked; in-app alerts still work.':'Browser alert permission was not granted.');}
 catch(_){weekwiseRuntime.showToast('Could not request notification permission.');}
}

function openReminderTask(record){
 if(weekwiseRuntime.$('taskModal')?.classList.contains('show')){weekwiseRuntime.showToast('Finish your open edit first. Your reminder remains in the schedule.');return;}
 try{window.focus();}catch(_){}
 weekwiseRuntime.setWorkspaceView('calendar');
 weekwiseRuntime.saveCurrent();
 weekwiseRuntime.mobileDay=record.date.getDay();
 weekwiseRuntime.currentWeek=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(record.date));
 weekwiseRuntime.monthAnchor=new Date(record.date.getFullYear(),record.date.getMonth(),1);
 weekwiseRuntime.calendarView='day';try{localStorage.setItem('weekwise-calendar-view-v1','day');}catch(_){}
 weekwiseRuntime.loadWeek(weekwiseRuntime.currentWeek);
 const t=weekwiseRuntime.tasks.find(x=>x.id===record.task.id);if(t)weekwiseRuntime.openTaskModal(t.id,t.day,t.start);
}

async function checkTaskReminders(){
 if(reminderCheckBusy||weekwiseRuntime.zoneNeedsReview())return;
 const owner=weekwiseRuntime.currentDataOwner;
 const allowed=()=>owner===weekwiseRuntime.currentDataOwner&&(owner==='local'||weekwiseRuntime.cloudUser?.id===owner)&&!weekwiseRuntime.plannerStorageBlocked&&!weekwiseRuntime.cloudConflict;
 if(!allowed())return;
 reminderCheckBusy=true;
 const deliver=async()=>{
  if(!allowed())return;
  const now=Date.now(),receiptKey='weekwise-alert-receipts-v1:'+owner;
  let receipts={};try{receipts=JSON.parse(localStorage.getItem(receiptKey)||'{}');if(!receipts||typeof receipts!=='object'||Array.isArray(receipts))receipts={};}catch(_){}
  const entries=Object.entries(receipts).filter(([,time])=>typeof time==='number'&&time>now-86400000&&time<=now).slice(-512);receipts=Object.fromEntries(entries);
  for(const record of weekwiseRuntime.workspaceRecords()){
   for(const reminder of root.WeekwiseReminderPolicy.due(record,weekwiseRuntime.store.settings,now)){
    if(!allowed())return;
    const identity=JSON.stringify([record.week,record.task.id,reminder.at]);
    if(receipts[identity]||memoryReceipts.get(owner+'::'+identity)>now-86400000)continue;
    const body=reminder.automatic?'Your activity starts at '+new Intl.DateTimeFormat('en-GB',{timeZone:weekwiseRuntime.store.settings.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(reminder.start))+'.':'Your task reminder is due now.';
    const options={body,tag:'weekwise-task-'+record.task.id+'-'+reminder.value};let sent=false;
    if('Notification' in window&&Notification.permission==='granted'){
     try{const notification=new Notification('Weekwise · '+record.task.title,options);notification.onclick=()=>{try{notification.close();}catch(_){}if(allowed())weekwiseRuntime.openReminderTask(record);};sent=true;}
     catch(_){
      try{const registration=await navigator.serviceWorker?.getRegistration('./');if(!allowed())return;if(registration?.showNotification){await registration.showNotification('Weekwise · '+record.task.title,options);sent=true;}}catch(_){}
     }
    }
    if(!allowed())return;
    if(!sent&&document.hidden)continue;
    if(!sent)weekwiseRuntime.showToast(record.task.title+' · '+body);
    // Receipts acknowledge an accepted system alert OR a visible in-app fallback,
    // never a task edit. Failed storage cannot cause a repeated alert in this tab.
    receipts[identity]=now;memoryReceipts.set(owner+'::'+identity,now);
    if(memoryReceipts.size>512)memoryReceipts.delete(memoryReceipts.keys().next().value);
    receipts=Object.fromEntries(Object.entries(receipts).slice(-512));
    try{localStorage.setItem(receiptKey,JSON.stringify(receipts));}catch(_){}
   }
  }
 };
 try{
  if(navigator.locks?.request)await navigator.locks.request('weekwise-task-alerts:'+owner,deliver);
  else await deliver();
 }catch(_){/* A denied lock is retried on the next reminder tick. */}
 finally{reminderCheckBusy=false;}
}

function parseWeekwiseNaturalCapture(raw,baseDate=new Date()){
 let text=String(raw||'').trim(),targetDate=null,timeMinutes=null,dateMatched=false,recurrence='none';
 const base=weekwiseRuntime.dateOnly(baseDate);
 function shiftBase(days){const d=new Date(base);d.setDate(d.getDate()+days);return d;}
 const weekdayNames='sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?';
 const everyWeekday=new RegExp('\\bevery\\s+('+weekdayNames+')\\b','i').exec(text);
 if(everyWeekday){recurrence='weekly';text=text.replace(everyWeekday[0],'on '+everyWeekday[1]+' ');}
 else{
  const repeatRules=[
   {pattern:/\bevery\s+day\b/i,frequency:'daily'},
   {pattern:/\bdaily\b/i,frequency:'daily'},
   {pattern:/\bevery\s+week\b|\beach\s+week\b|\bweekly\b/i,frequency:'weekly'},
   {pattern:/\bevery\s+month\b|\bmonthly\b/i,frequency:'monthly'},
   {pattern:/\bevery\s+year\b|\beach\s+year\b|\byearly\b|\bannually\b/i,frequency:'yearly'}
  ];
  for(const rule of repeatRules){const match=rule.pattern.exec(text);if(match){recurrence=rule.frequency;text=text.replace(match[0],' ');break;}}
 }
 function takeDate(regex,build){
  if(dateMatched)return;
  const match=text.match(regex);if(!match)return;
  const candidate=build(match);
  if(!(candidate instanceof Date)||!Number.isFinite(candidate.getTime()))return;
  targetDate=weekwiseRuntime.dateOnly(candidate);dateMatched=true;text=text.replace(match[0],' ');
 }
 takeDate(/\bday after tomorrow\b/i,()=>shiftBase(2));
 takeDate(/\btomorrow\b/i,()=>shiftBase(1));
 takeDate(/\btoday\b/i,()=>shiftBase(0));
 takeDate(/\bnext week\b/i,()=>shiftBase(7));
 takeDate(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/i,m=>new Date(Number(m[1]),Number(m[2])-1,Number(m[3])));
 takeDate(/\b([0-3]?\d)[./]([01]?\d)[./](20\d{2})\b/i,m=>new Date(Number(m[3]),Number(m[2])-1,Number(m[1])));
 takeDate(/\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i,m=>{
  const dayNumber=Number(m[1]);if(dayNumber<1||dayNumber>31)return null;
  let year=base.getFullYear(),month=base.getMonth();
  const candidateFor=(y,mo)=>new Date(y,mo,Math.min(dayNumber,new Date(y,mo+1,0).getDate()));
  let candidate=candidateFor(year,month);
  if(candidate<base){month+=1;candidate=candidateFor(year,month);}
  return candidate;
 });
 if(!dateMatched){
  const weekday=/\b(?:(on|next|this)\s+)(sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)\b/i.exec(text)||/\b(sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)\s*$/i.exec(text);
  if(weekday){
   const dayToken=(weekday[2]||weekday[1]||'').slice(0,3).toLowerCase();
   const dayMap={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6},targetDay=dayMap[dayToken];
   if(targetDay!==undefined){
    const modifier=(weekday[2]?weekday[1]:'').toLowerCase();
    let delta=(targetDay-base.getDay()+7)%7;
    if(modifier==='next'&&delta===0)delta=7;
    if(modifier==='this'){
     delta=targetDay-base.getDay();
    }
    const candidate=new Date(base);candidate.setDate(candidate.getDate()+delta);
    targetDate=weekwiseRuntime.dateOnly(candidate);dateMatched=true;text=text.replace(weekday[0],' ');
   }
  }
 }
 let timeMatch=/\bat\s+(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?\b/i.exec(text);
 if(!timeMatch)timeMatch=/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i.exec(text);
 if(!timeMatch)timeMatch=/\b(\d{1,2}):([0-5]\d)\b/i.exec(text);
 if(timeMatch){
  const tokenHour=Number(timeMatch[1]),minute=Number(timeMatch[2]||0),ampm=String(timeMatch[3]||'').toLowerCase();
  let hour=tokenHour,valid=true;
  if(ampm){if(hour<1||hour>12)valid=false;else{hour=hour%12;if(ampm==='pm')hour+=12;}}
  else if(hour<0||hour>23)valid=false;
  if(valid&&minute<=59){timeMinutes=hour*60+minute;text=text.replace(timeMatch[0],' ');}
 }
 text=text.replace(/\s+/g,' ').replace(/^[,;·–—-]+|[,;·–—-]+$/g,'').trim();
 if(!targetDate&&timeMinutes!==null)targetDate=weekwiseRuntime.dateOnly(baseDate);
 return {title:text,date:targetDate,timeMinutes,dateMatched,timeMatched:timeMinutes!==null,recurrence};
}
return Object.freeze({reminderTodayKey,reminderState,reminderDueOpen,updateReminderBadge,reminderFormReset,reminderEdit,reminderSave,reminderToggleDone,reminderTogglePin,reminderDelete,renderReminders,openReminders,nudgeDueReminders,cloudFingerprint,enableTaskNotifications,openReminderTask,checkTaskReminders,parseWeekwiseNaturalCapture});
}
root.WeekwiseAppNotifications=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
