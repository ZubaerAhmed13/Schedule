(()=>{
'use strict';
const DAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TYPE_LABELS={job:'Career',study:'Coursework',language:'Language',life:'Home / personal',hobby:'Hobby',fixed:'Fixed',other:'Other'};
const STORE_KEY='weekwise-planner-v2';
const REMINDERS_KEY='weekwise-reminders-v1';
const CLOUD_META_KEY='weekwise-cloud-sync-meta-v1';


const $=id=>document.getElementById(id);
let cloudSessionEpoch=0,currentDataOwner="local";
let cloudClient=null,cloudUser=null,cloudRevision=0,cloudReady=false,cloudApplyingRemote=false,cloudBusy=false,cloudSyncTimer=null,cloudConflict=null,cloudInitializationUser=null,cloudInitPromise=null;
try{if(window.supabase&&typeof window.supabase.createClient==='function')cloudClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}catch(e){console.error('Weekwise cloud client could not start',e);}
window.weekwiseCloudClient=cloudClient;
let now=new Date();
function nextQuarterHour(){const minutes=now.getHours()*60+now.getMinutes();return Math.min(23*60+45,Math.ceil(minutes/15)*15);}
function dateOnly(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function sundayOf(d){const x=dateOnly(d);x.setDate(x.getDate()-x.getDay());return x;}
function mondayOf(d){const x=dateOnly(d);const mon=(x.getDay()+6)%7;x.setDate(x.getDate()-mon);return x;}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function parseKey(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);}
function fmtDate(d,opts={day:'numeric',month:'short'}){return d.toLocaleDateString('en-GB',opts);}
function dayDate(week,idx){const d=parseKey(week);d.setDate(d.getDate()+idx);return d;}
function normalizeTimeField(el){
  if(!el)return true;
  let value=String(el.value||'').trim();
  if(!value){el.setCustomValidity(el.required?'Enter a time in 24-hour format, such as 17:30.':'');return !el.required;}
  let match=value.match(/^(\d{1,2}):([0-5]\d)$/);
  if(match){const hour=Number(match[1]);if(hour>=0&&hour<=23)value=`${String(hour).padStart(2,'0')}:${match[2]}`;}
  else if(/^\d{3,4}$/.test(value)){const digits=value;const hour=Number(digits.slice(0,-2)),minute=Number(digits.slice(-2));if(hour>=0&&hour<=23&&minute>=0&&minute<=59)value=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;}
  const valid=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  if(valid)el.value=value;
  el.setCustomValidity(valid?'':'Use 24-hour HH:MM, e.g. 09:30. You can also type 0930.');
  return valid;
}
function validateTimeFields(ids){
  for(const id of ids){const el=$(id);if(!normalizeTimeField(el)){el.reportValidity?.();el.focus();return false;}}
  return true;
}
function wireTime24Fields(){
  document.querySelectorAll('[data-time24]').forEach(el=>{
    if(el.dataset.time24Wired==='true')return;el.dataset.time24Wired='true';
    el.addEventListener('input',()=>el.setCustomValidity(''));
    el.addEventListener('blur',()=>{if(String(el.value||'').trim())normalizeTimeField(el);});
  });
}
function timeMins(s){if(!s)return 600;const [h,m]=s.split(':').map(Number);return h*60+m;}
function minsTime(n){n=((Math.trunc(Number(n)||0)%1440)+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function durationLabel(n){if(n<60)return n+' min';const h=Math.floor(n/60),m=n%60;return m?h+'h '+m+'m':h+'h'}
function normalizeEndTimeField(el){
  if(!el)return false;
  let value=String(el.value||'').trim();
  if(value==='2400'||value==='24:00'){el.value='24:00';el.setCustomValidity('');return true;}
  let match=value.match(/^(\d{1,2}):([0-5]\d)$/);
  if(match){const hour=Number(match[1]);if(hour>=0&&hour<=23)value=String(hour).padStart(2,'0')+':'+match[2];}
  else if(/^\d{3,4}$/.test(value)){const hour=Number(value.slice(0,-2)),minute=Number(value.slice(-2));if(hour>=0&&hour<=23&&minute>=0&&minute<=59)value=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');}
  const valid=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  if(valid)el.value=value;
  el.setCustomValidity(valid?'':'Enter a 24-hour end time, e.g. 14:30 or 24:00.');
  return valid;
}
function updateEndTimeFromDuration(){
  const startEl=$('modalTime'),endEl=$('modalEndTime'),durationEl=$('modalDuration');
  if(!startEl||!endEl||!durationEl)return;
  if(!normalizeTimeField(startEl)){endEl.value='';endEl.setCustomValidity('Enter a valid start time first.');return;}
  const end=timeMins(startEl.value)+Number(durationEl.value||30);
  if(end>1440){endEl.value='';endEl.setCustomValidity('End time cannot go past midnight. Shorten the duration or choose an earlier start.');return;}
  endEl.value=end===1440?'24:00':minsTime(end);endEl.setCustomValidity('');
}
function updateDurationFromEnd(){
  const startEl=$('modalTime'),endEl=$('modalEndTime'),durationEl=$('modalDuration');
  if(!normalizeTimeField(startEl)||!normalizeEndTimeField(endEl))return false;
  const start=timeMins(startEl.value),end=timeMins(endEl.value);
  if(end<=start){endEl.setCustomValidity('End time must be later than start time on the same day. Use 24:00 for midnight.');return false;}
  const duration=end-start;let option=Array.from(durationEl.options).find(o=>Number(o.value)===duration);
  if(!option){option=document.createElement('option');option.value=String(duration);option.textContent=durationLabel(duration);durationEl.add(option);}
  durationEl.value=String(duration);endEl.setCustomValidity('');return true;
}
function uid(){return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function escapeHtml(str){return String(str??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function defaultClassTemplate(){return {title:'Master’s coursework self-study',days:[1,3,5,0],duration:75,start:'13:00'};}
function defaultSettings(){return {timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,calendarGridStartDay:0,travelDay:6,travelStart:'09:00',destination:'',cookStartDay:1,showBreaks:true,theme:'system',shifts:DAY_NAMES.map(()=>({enabled:false,start:'09:00',end:'17:00'})),classTemplate:defaultClassTemplate()};}
let plannerStorageBlocked=false,plannerStorageError="";
function loadStore(){
  try{
    const current=localStorage.getItem(STORE_KEY);
    if(current)return WeekwiseData.parseStore(current);
    const legacy=localStorage.getItem('weekwise-planner-v1');
    if(legacy){
      const old=WeekwiseData.parseStore(legacy);if(old&&old.settings&&old.weeks){
        const migrated={...old,settings:{...old.settings},weeks:{}};
        migrated.settings.travelDay=(Number(old.settings.travelDay||0)+1)%7;
        migrated.settings.cookStartDay=(Number(old.settings.cookStartDay||0)+1)%7;
        const oldShifts=old.settings.shifts||[];migrated.settings.shifts=[oldShifts[6]||{enabled:false,start:'09:00',end:'17:00'},...oldShifts.slice(0,6)];
        Object.entries(old.weeks).forEach(([mondayKey,week])=>{
          const sunday=parseKey(mondayKey);sunday.setDate(sunday.getDate()-1);const newKey=dateKey(sunday);
          const oldTasks=Array.isArray(week.tasks)?week.tasks:[];
          migrated.weeks[newKey]={...week,tasks:oldTasks.map(t=>({...t,day:(Number(t.day||0)+1)%7}))};
        });
        localStorage.setItem(STORE_KEY,JSON.stringify(migrated));return migrated;
      }
    }
    return {settings:defaultSettings(),weeks:{}};
  }catch(e){plannerStorageBlocked=true;plannerStorageError=e.message||'Stored planner data could not be read.';return {settings:defaultSettings(),weeks:{}}}
}
function loadReminders(){return WeekwiseData.readCollection(localStorage,REMINDERS_KEY);}
let reminders=loadReminders();
function saveReminders(){checkedCollectionSave(REMINDERS_KEY,reminders,value=>reminders=value);}
let store=loadStore();
currentDataOwner=readCloudMeta()?.userId||'local';
if(!store.settings)store.settings=defaultSettings();if(!store.weeks)store.weeks={};if(!Array.isArray(store.recurringTemplates))store.recurringTemplates=[];if(!Array.isArray(store.customLists))store.customLists=[];if(!store.settings.shifts)store.settings.shifts=defaultSettings().shifts;if(!store.settings.classTemplate)store.settings.classTemplate=defaultClassTemplate();
let currentWeek=dateKey(sundayOf(now));
let mobileDay=now.getDay();
let monthAnchor=new Date(now.getFullYear(),now.getMonth(),1);
let agendaAnchor=dateOnly(now);
let calendarYear=now.getFullYear();
let dashboardWeekKey=currentWeek;
let calendarView='week';
try{const savedView=localStorage.getItem('weekwise-calendar-view-v1');calendarView=(savedView==='day'||savedView==='week'||savedView==='month'||savedView==='agenda'||savedView==='year')?savedView:(window.matchMedia('(max-width: 650px)').matches?'day':'week');}catch(_){calendarView=window.matchMedia('(max-width: 650px)').matches?'day':'week';}
let lastRenderedCalendarView=null;
let tasks=[];
let workspaceView='today';
try{const savedWorkspace=localStorage.getItem('weekwise-workspace-view-v1');if(['today','tomorrow','inbox','upcoming','board','filters','plan','insights','settings','calendar','matrix','list-career','list-study','list-work','list-personal','list-language','list-hobbies','list-other'].includes(savedWorkspace)||(savedWorkspace&&(savedWorkspace.startsWith('folder:')||savedWorkspace.startsWith('tag:'))))workspaceView=savedWorkspace;}catch(_){}
try{const shortcutView=new URLSearchParams(window.location.search).get('view');if(['today','tomorrow','inbox','plan','calendar'].includes(shortcutView))workspaceView=shortcutView;}catch(_){}
let toastTimer;
let storageWarningShown=false;
let lastSavedStore=JSON.stringify(store),lastSavedDisk=localStorage.getItem(STORE_KEY);
function storageSaveError(message){const error=new Error(message);error.name='WeekwiseStorageError';showToast(message);return error;}
window.addEventListener('error',event=>{if(event.error?.name==='WeekwiseStorageError'){event.preventDefault();showToast(event.error.message);}});
function checkedCollectionSave(key,value,restore){try{WeekwiseData.writeCollection(localStorage,key,value);}catch(error){const raw=localStorage.getItem(key);if(raw!==null){try{restore(WeekwiseData.readCollection(localStorage,key));}catch(_){}}else restore([]);throw storageSaveError(error.message.startsWith('Another tab')?error.message:'Could not save this change. Previous records remain on this device.');}if(!cloudApplyingRemote)queueCloudSave();}
function saveStore(){
 if(plannerStorageBlocked||WeekwiseData.blockedKeys().length)return false;
 try{if(localStorage.getItem(STORE_KEY)!==lastSavedDisk){const fresh=WeekwiseData.parseStore(localStorage.getItem(STORE_KEY));lastSavedStore=JSON.stringify(fresh);lastSavedDisk=localStorage.getItem(STORE_KEY);throw new Error('Another tab changed your planner. Its records are preserved. Reload before continuing.');}if(!store.settings.timeZone)store.settings.timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;const raw=JSON.stringify(store);WeekwiseData.commitStorage(localStorage,[[STORE_KEY,raw]]);lastSavedStore=raw;lastSavedDisk=raw;}
 catch(error){store=JSON.parse(lastSavedStore);tasks=JSON.parse(JSON.stringify(store.weeks[currentWeek]?.tasks||[]));throw storageSaveError(error.message.startsWith('Another tab')?error.message:'Could not save this change. Your previous planner remains on this device.');}
 if(!cloudApplyingRemote)queueCloudSave();return true;
}
function reconcileSplitTasks(){const all=workspaceRecords().map(r=>r.task),byId=new Map(all.map(t=>[t.id,t]));for(const parent of all){if(!parent.planningChildren?.length)continue;for(const sub of parent.subtasks||[]){if(sub.taskId&&byId.has(sub.taskId)){const child=byId.get(sub.taskId);sub.title=child.title;sub.done=!!child.done;}}const children=parent.planningChildren.map(id=>byId.get(id)).filter(Boolean);if(children.length===parent.planningChildren.length){parent.done=children.every(t=>t.done)&&(!parent.subtasks?.length||parent.subtasks.every(s=>s.done));parent.status=parent.done?'done':'todo';}}}
function saveCurrent(){reconcileSplitTasks();store.weeks[currentWeek]={...store.weeks[currentWeek],tasks:JSON.parse(JSON.stringify(tasks))};return saveStore();}
function showToast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
function populateDaySelects(){['tripDay','cookDay','quickDay','modalDay'].forEach(id=>{const el=$(id);el.innerHTML=DAY_NAMES.map((n,i)=>`<option value="${i}">${n}</option>`).join('')});}
function renderShiftFields(){const grid=$('shiftGrid');grid.innerHTML=DAY_NAMES.map((d,i)=>{const s=store.settings.shifts[i]||{enabled:false,start:'09:00',end:'17:00'};return `<div class="shiftrow"><label class="daycheck"><input type="checkbox" data-shift-enabled="${i}" ${s.enabled?'checked':''}> <span>${d}</span></label><div><label class="sr-only" for="shiftstart${i}">Shift start ${d}</label><input class="time24" data-time24 type="text" inputmode="numeric" maxlength="5" placeholder="09:00" id="shiftstart${i}" data-shift-start="${i}" value="${escapeHtml(s.start||'09:00')}" title="24-hour HH:MM, e.g. 09:00 or type 0900" aria-label="${d} shift start"></div><div><label class="sr-only" for="shiftend${i}">Shift end ${d}</label><input class="time24" data-time24 type="text" inputmode="numeric" maxlength="5" placeholder="17:00" id="shiftend${i}" data-shift-end="${i}" value="${escapeHtml(s.end||'17:00')}" title="24-hour HH:MM, e.g. 17:00 or type 1700" aria-label="${d} shift end"></div></div>`}).join('');}

function applyThemePreference(mode){
 const selected=['system','light','dark'].includes(mode)?mode:'system';
 if(store&&store.settings)store.settings.theme=selected;
 let systemDark=false;try{systemDark=!!window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;}catch(_){}
 const dark=selected==='dark'||(selected==='system'&&systemDark);
 document.body.setAttribute('data-theme',dark?'dark':'light');
 document.documentElement.style.colorScheme=dark?'dark':'light';
}
function setupSystemThemeListener(){
 try{
  if(!window.matchMedia)return;
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const changed=()=>{if((store.settings?.theme||'system')==='system')applyThemePreference('system');};
  if(media.addEventListener)media.addEventListener('change',changed);else if(media.addListener)media.addListener(changed);
 }catch(_){}
}
function syncSettingsForm(){ $('weekStart').value=currentWeek;const calendarGridStartDay=$('calendarGridStartDay');if(calendarGridStartDay)calendarGridStartDay.value=String(WeekwiseCalendarLayout.firstDay(store.settings.calendarGridStartDay)); $('tripDay').value=store.settings.travelDay; $('tripStart').value=store.settings.travelStart||'09:00'; $('cookDay').value=store.settings.cookStartDay; $('tripDestination').value=store.settings.destination||'';const breakToggle=$('showBreaks');if(breakToggle)breakToggle.checked=store.settings.showBreaks!==false;const themeSelect=$('themeMode');if(themeSelect){themeSelect.value=store.settings.theme||'system';applyThemePreference(themeSelect.value);}renderShiftFields();}
function settingsFromForm(){const shifts=DAY_NAMES.map((_,i)=>({enabled:!!document.querySelector(`[data-shift-enabled="${i}"]`)?.checked,start:document.querySelector(`[data-shift-start="${i}"]`)?.value||'09:00',end:document.querySelector(`[data-shift-end="${i}"]`)?.value||'17:00'}));return {...store.settings,travelDay:Number($('tripDay').value),travelStart:$('tripStart').value||'09:00',destination:$('tripDestination').value.trim(),cookStartDay:Number($('cookDay').value),showBreaks:!!$('showBreaks')?.checked,calendarGridStartDay:WeekwiseCalendarLayout.firstDay($('calendarGridStartDay')?.value),theme:$('themeMode')?.value||store.settings.theme||'system',shifts,classTemplate:store.settings.classTemplate||defaultClassTemplate()};}
function overlap(a,b){return a.start < b.start+b.duration && b.start < a.start+a.duration;}
function canPlace(dayTasks,start,duration){const candidate={start,duration};return !dayTasks.some(t=>t.start!=null && overlap(candidate,t));}
function findSlot(dayIndex,duration,preferred=600,min=420,max=1320,dayTasks=null){const occupied=dayTasks||tasks.filter(t=>t.day===dayIndex);const candidates=[];for(let start=min;start+duration<=max;start+=15)candidates.push(start);candidates.sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred));return candidates.find(start=>canPlace(occupied,start,duration))??null;}
function createTask(day,title,type,duration,preferred,opts={}){let start=null;if(preferred!==null&&preferred!==undefined){start=findSlot(day,duration,preferred,opts.min??420,opts.max??1320,tasks.filter(t=>t.day===day));}const t={id:uid(),day,title,type,duration,start,done:false,custom:!!opts.custom,fixed:!!opts.fixed,note:opts.note||'',unscheduled:start===null};tasks.push(t);return t;}
function addFlexible(day,title,type,duration,preferred,opts={}){return createTask(day,title,type,duration,preferred,opts);}
function hasShift(i){return !!store.settings.shifts[i]?.enabled;}
function loadWeek(week){
  currentWeek=week;
  const saved=store.weeks[currentWeek];
  if(saved&&Array.isArray(saved.tasks)){
    // Loading is never permission to remove or rename a user's records.
    tasks=JSON.parse(JSON.stringify(saved.tasks));
  }else{tasks=[];saveCurrent();}
  materializeCurrentAndUpcoming();
  syncSettingsForm();renderAll();
}
function setWeekFromInput(){let chosen=$('weekStart').value;if(!chosen)return;chosen=dateKey(sundayOf(parseKey(chosen)));saveCurrent();loadWeek(chosen);}
function formatTime(t){if(t.start===null||t.start===undefined)return 'Needs a time';const start=Number(t.start),end=start+Number(t.duration||0);const endLabel=end===1440?'24:00':minsTime(end);return end<1440?`${minsTime(start)}–${endLabel}`:end===1440?`${minsTime(start)}–24:00`:`${minsTime(start)}–${minsTime(end)} (+${Math.floor(end/1440)} day${Math.floor(end/1440)===1?'':'s'})`;}
function categoryClass(type){return ['job','study','language','life','hobby','fixed','other'].includes(type)?`t-${type}`:'t-life';}
function sortedTasks(day){return tasks.filter(t=>t.day===day).sort((a,b)=>{if(a.start==null&&b.start==null)return 0;if(a.start==null)return 1;if(b.start==null)return -1;return a.start-b.start;});}
function taskHTML(t){
  const cls=categoryClass(t.type)+(t.done?' done':'');
  const type=t.workday?'Work day':(TYPE_LABELS[t.type]||'Other');
  const note=t.note?`<div class="task-note">${escapeHtml(t.note)}</div>`:'';
  const moveOptions=DAY_NAMES.map((d,i)=>`<option value="${i}" ${i===t.day?'selected':''}>${DAY_SHORT[i]}</option>`).join('');
  const dragHandle=!t.fixed?`<span class="drag-handle" draggable="true" data-drag-handle="${escapeHtml(t.id)}" title="Drag to move or swap" aria-label="Drag ${escapeHtml(t.title)} to another day or activity">⠿</span>`:'';
  return `<div class="task ${cls}" data-task-id="${escapeHtml(t.id)}">
    <div class="tasktop">${dragHandle}<input class="taskcheck" type="checkbox" aria-label="Mark ${escapeHtml(t.title)} complete" data-done="${escapeHtml(t.id)}" ${t.done?'checked':''}><div class="taskmain"><div class="task-title">${escapeHtml(t.title)}</div><div class="taskmeta">${escapeHtml(formatTime(t))} · ${escapeHtml(durationLabel(t.duration))}</div><span class="pill">${escapeHtml(type)}</span>${t.unscheduled||t.start==null?'<span class="pill" style="background:var(--gold-soft);color:#8b6527">Needs time</span>':''}${t.conflict?'<span class="pill" style="background:var(--red-soft);color:#a3453b">Shift conflict</span>':''}${note}</div></div>
    ${t.fixed?`<div class="tasktools"><span style="font-size:9px;color:var(--muted)">Fixed block · edit in Plan settings</span></div>`:`<div class="tasktools"><select aria-label="Move ${escapeHtml(t.title)} to another day" title="Move to another day" data-move="${escapeHtml(t.id)}">${moveOptions}</select><button class="iconbtn" aria-label="Edit ${escapeHtml(t.title)}" title="Edit activity and time (24-hour clock)" data-edit="${escapeHtml(t.id)}">✎</button><button class="iconbtn" aria-label="Delete ${escapeHtml(t.title)}" title="Delete activity" data-delete="${escapeHtml(t.id)}">×</button></div>`}
  </div>`;
}
function renderMobileDayPicker(){
  const picker=$('mobileDayPicker');if(!picker)return;
  picker.classList.toggle('is-visible',calendarView==='day');
  const help=$('mobileHelp');if(help)help.classList.toggle('is-visible',calendarView==='day');
  picker.innerHTML=DAY_NAMES.map((day,i)=>{
    const d=dayDate(currentWeek,i),count=tasks.filter(t=>t.day===i).length;
    return `<button type="button" class="day-tab ${i===mobileDay?'active':''}" data-mobile-day="${i}" aria-pressed="${i===mobileDay?'true':'false'}"><span>${DAY_SHORT[i]}</span><strong>${String(d.getDate()).padStart(2,'0')}</strong><small>${count} ${count===1?'event':'events'}</small></button>`;
  }).join('');
  picker.querySelectorAll('[data-mobile-day]').forEach(btn=>btn.addEventListener('click',()=>{mobileDay=Number(btn.dataset.mobileDay);renderDays();renderStats();}));
}
function openFixedSettings(id){
  const t=tasks.find(x=>x.id===id);
  openUtilityPanel('settingsPanel','Work day & weekly settings');
  setTimeout(()=>{if(t&&t.cityday)$('tripDestination').focus();else if(t)document.querySelector(`[data-shift-start="${t.day}"]`)?.focus();},60);
}
function renderDays(){
  const grid=$('daysGrid');
  const previousScrollTop=grid.scrollTop,previousScrollLeft=grid.scrollLeft;
  const alreadyRendered=grid.dataset.hasRendered==='true';
  const mobileMode=window.matchMedia('(max-width: 650px)').matches;
  const singleDay=calendarView==='day';
  const instruction=$('calendarInstruction');if(instruction){instruction.textContent='';instruction.hidden=true;}
  const hourHeight=56;
  grid.setAttribute('aria-label',singleDay?'Daily calendar':'Weekly calendar');
  updateViewControls();
  renderMobileDayPicker();
  const dayEvents=[];
  for(let day=0;day<7;day++){
    const arranged=tasks.filter(t=>t.day===day&&t.start!==null&&t.start!==undefined).map(t=>({...t})).sort((a,b)=>a.start-b.start||b.duration-a.duration);
    // Greedy interval lanes keep overlapping fixed blocks visible side-by-side.
    const clusters=[];let cluster=[],clusterEnd=-1;
    arranged.forEach(t=>{const st=Number(t.start),en=st+Math.max(1,Number(t.duration)||1);if(cluster.length&&st>=clusterEnd){clusters.push(cluster);cluster=[];clusterEnd=-1;}cluster.push(t);clusterEnd=Math.max(clusterEnd,en);});if(cluster.length)clusters.push(cluster);
    clusters.forEach(items=>{const laneEnds=[];items.forEach(t=>{const st=Number(t.start);let lane=laneEnds.findIndex(end=>end<=st);if(lane<0)lane=laneEnds.length;laneEnds[lane]=st+Math.max(1,Number(t.duration)||1);t._lane=lane;});const lanes=laneEnds.length;items.forEach(t=>{t._laneCount=lanes;dayEvents.push(t);});});
  }
  const allDayTasks=tasks.filter(t=>!!t.allDay&&(t.allDayDate||t.dueDate)&&(!singleDay||Number(t.day)===Number(mobileDay)));
  const backlog=tasks.filter(t=>(t.start===null||t.start===undefined||t.unscheduled)&&!t.allDay);
  const hours=Array.from({length:24},(_,h)=>`<span class="hour-label ${h===0?'first':''}" style="top:${h*hourHeight}px">${String(h).padStart(2,'0')}:00</span>`).join('')+`<span class="hour-label end" style="top:${24*hourHeight}px">24:00</span>`;
  const headers=DAY_NAMES.map((day,i)=>{const d=dayDate(currentWeek,i),isToday=dateKey(d)===dateKey(now),isTrip=i===Number(store.settings.travelDay),dayTasks=tasks.filter(t=>t.day===i),completed=dayTasks.filter(t=>t.done).length;return `<div class="calendar-day-header ${isToday?'is-today':''} ${isTrip?'is-trip':''} ${singleDay&&i===mobileDay?'mobile-selected':''}" data-header-day="${i}" style="grid-column:${i+2};grid-row:1"><span class="day-number">${String(d.getDate()).padStart(2,'0')}</span><span class="day-name">${day}</span><span class="day-count">${completed}/${dayTasks.length} done</span>${isTrip?'<span class="trip-mark">✦ CITY DAY · 9H</span>':''}</div>`;}).join('');
  const columns=DAY_NAMES.map((day,i)=>{
    const d=dayDate(currentWeek,i),isToday=dateKey(d)===dateKey(now);
    const evs=dayEvents.filter(t=>t.day===i).map(t=>{
      const start=Math.max(0,Math.min(1439,Number(t.start)||0)),duration=Math.max(1,Number(t.duration)||1),visibleDuration=Math.max(0,Math.min(duration,1440-start));
      const top=start/60*hourHeight,height=Math.max(18,visibleDuration/60*hourHeight);
      const lane=Number(t._lane)||0,laneCount=Math.max(1,Number(t._laneCount)||1),left=(lane/laneCount*100),width=(100/laneCount);
      const end=start+duration,endLabel=end===1440?'24:00':minsTime(end),spill=Math.floor(end/1440),timeLabel=`${minsTime(start)}–${endLabel}${spill>0&&end!==1440?` (+${spill} day${spill===1?'':'s'})`:''}`;
      const compact=duration<40||height<32,cls=`cal-event ${categoryClass(t.type)} ${t.done?'done':''} ${compact?'compact':''} ${t.conflict?'event-conflict':''}`;
      const grip=!t.fixed?`<span class="event-grip" data-drag-handle="${escapeHtml(t.id)}" title="Drag to another day and time" aria-label="Move ${escapeHtml(t.title)}">⠿</span>`:'<span class="event-grip fixed-grip" aria-hidden="true">•</span>';
      const doneControl=(!t.fixed||t.workday||t.cityday)?`<input class="event-check" type="checkbox" data-done="${escapeHtml(t.id)}" ${t.done?'checked':''} aria-label="Mark ${escapeHtml(t.title)} complete">`:'';
      const actionButtons=!t.fixed?`<div class="event-tools"><button class="event-tool" data-edit="${escapeHtml(t.id)}" title="Edit event" aria-label="Edit ${escapeHtml(t.title)}">✎</button><button class="event-tool" data-delete="${escapeHtml(t.id)}" title="Delete event" aria-label="Delete ${escapeHtml(t.title)}">×</button></div>`:`<div class="event-tools"><button class="event-tool" data-fixed-open="${escapeHtml(t.id)}" title="Edit work shift or city-day settings" aria-label="Edit ${escapeHtml(t.title)}">⚙</button></div>`;
      return `<article class="${cls}" data-task-id="${escapeHtml(t.id)}" data-day-index="${i}" style="top:${top}px;height:${height}px;left:calc(${left}% + 2px);width:calc(${width}% - 4px);z-index:${3+lane}" title="${escapeHtml(t.title+' · '+timeLabel)}"><div class="event-head">${grip}${doneControl}<button class="event-title" ${!t.fixed?`data-edit="${escapeHtml(t.id)}"`:`data-fixed-open="${escapeHtml(t.id)}"`} type="button">${escapeHtml(t.title)}</button></div><div class="event-time">${escapeHtml(timeLabel)}</div>${duration>=90&&t.note?`<div class="event-note">${escapeHtml(t.note)}</div>`:''}${actionButtons}</article>`;
    }).join('');
    const nowTop=(now.getHours()*60+now.getMinutes())/60*hourHeight;
    const nowLine=''; // The current-time line is drawn once across the calendar below.
    return `<div class="day-column ${isToday?'is-today':''} ${singleDay&&i===mobileDay?'mobile-selected':''}" data-day-index="${i}" style="grid-column:${i+2};grid-row:2"><div class="hour-lines"></div><div class="half-hour-lines"></div><div class="drop-surface" data-day-surface="${i}" data-day-index="${i}" aria-label="${day} calendar; click to add event"></div><div class="event-layer">${evs}${nowLine}</div></div>`;
  }).join('');
  const allDayHTML=allDayTasks.length?'<div class="backlog-strip all-day-strip"><span class="backlog-label">ALL DAY</span>'+allDayTasks.map(t=>'<button class="backlog-event all-day-event" data-edit="'+escapeHtml(t.id)+'" title="All-day event">'+escapeHtml(t.title)+' · '+DAY_NAMES[t.day]+'</button>').join('')+'</div>':'';
  const backlogHTML=backlog.length?'<div class="backlog-strip"><span class="backlog-label">NEEDS A TIME</span>'+backlog.map(t=>'<button class="backlog-event" data-edit="'+escapeHtml(t.id)+'"><span class="event-grip" data-drag-handle="'+escapeHtml(t.id)+'">⠿</span>'+escapeHtml(t.title)+' · '+DAY_NAMES[t.day]+'</button>').join('')+'<span class="drop-hint">Drag a grip to a day and time</span></div>':'';
  grid.innerHTML=`${allDayHTML}${backlogHTML}<div class="calendar-grid ${singleDay?'single-day-view':''} ${singleDay&&mobileMode?'mobile-single-day':''}" style="--hour-height:${hourHeight}px"><div class="calendar-corner" aria-hidden="true"></div>${headers}<div class="time-axis">${hours}</div>${columns}</div>`;
  // Draw one Outlook-like time indicator above the calendar grid. The dashed
  // part crosses earlier days; the solid part spans today's column, with a dot
  // exactly where the current day begins.
  const todayColumn=grid.querySelector('.day-column.is-today');
  const selectedDateIsToday=dateKey(dayDate(currentWeek,mobileDay))===dateKey(now);
  if(todayColumn&&(!singleDay||selectedDateIsToday)&&todayColumn.getClientRects().length){
    const renderedColumns=[...grid.querySelectorAll('.day-column')].filter(col=>col.getClientRects().length>0);
    const firstColumn=singleDay?todayColumn:renderedColumns[0];
    if(firstColumn){
      const gridRect=grid.getBoundingClientRect();
      const firstRect=firstColumn.getBoundingClientRect();
      const todayRect=todayColumn.getBoundingClientRect();
      // Rect-relative coordinates remain aligned even after horizontal/vertical scrolling.
      const firstLeft=firstRect.left-gridRect.left;
      const todayLeft=todayRect.left-gridRect.left;
      const todayWidth=todayRect.width;
      const y=todayRect.top-gridRect.top+grid.scrollTop+(now.getHours()*60+now.getMinutes())/60*hourHeight;
      const leadWidth=Math.max(0,todayLeft-firstLeft);
      const indicator=document.createElement('div');
      indicator.className='now-week-indicator';
      indicator.setAttribute('role','img');
      indicator.setAttribute('aria-label',`Current time ${minsTime(now.getHours()*60+now.getMinutes())}`);
      indicator.title=`Current time · ${minsTime(now.getHours()*60+now.getMinutes())}`;
      indicator.style.cssText=`top:${y}px;left:${firstLeft}px;width:${Math.max(0,todayLeft+todayWidth-firstLeft)}px;--now-lead-width:${leadWidth}px;`;
      indicator.innerHTML='<span class="now-dot" aria-hidden="true"></span>';
      grid.appendChild(indicator);
    }
  }
  if(!alreadyRendered||lastRenderedCalendarView!==calendarView){const firstHour=Math.max(6,Math.min(20,now.getHours()-2));grid.scrollTop=Math.max(0,firstHour*hourHeight-18);grid.scrollLeft=0;grid.dataset.hasRendered='true';lastRenderedCalendarView=calendarView;}
  else{grid.scrollTop=previousScrollTop;grid.scrollLeft=previousScrollLeft;}
  grid.querySelectorAll('[data-done]').forEach(el=>el.addEventListener('change',()=>{const t=tasks.find(t=>t.id===el.dataset.done);if(t){t.done=el.checked;t.status=t.done?'done':(t.status==='done'?'todo':(t.status||'todo'));saveCurrent();renderAll();}}));
  grid.querySelectorAll('[data-delete]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const t=tasks.find(t=>t.id===el.dataset.delete);if(t&&!t.fixed){if(t.seriesId&&t.occurrenceDate){const template=(store.recurringTemplates||[]).find(item=>item.id===t.seriesId);if(template){template.excludedDates=Array.isArray(template.excludedDates)?template.excludedDates:[];if(!template.excludedDates.includes(t.occurrenceDate))template.excludedDates.push(t.occurrenceDate);}}tasks=tasks.filter(x=>x.id!==t.id);saveCurrent();renderAll();showToast('Event deleted');}}));
  grid.querySelectorAll('[data-edit]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openTaskModal(el.dataset.edit);}));
  // Make the entire event card a tap target; the title-only click was too subtle on phones.
  grid.querySelectorAll('.cal-event').forEach(card=>card.addEventListener('click',e=>{
    if(e.target.closest('button,input,[data-drag-handle]'))return;
    const t=tasks.find(x=>x.id===card.dataset.taskId);if(!t)return;
    if(t.fixed){openFixedSettings(t.id);}else openTaskModal(t.id);
  }));
  grid.querySelectorAll('[data-fixed-open]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openFixedSettings(el.dataset.fixedOpen);}));
  grid.querySelectorAll('[data-day-surface]').forEach(surface=>surface.addEventListener('click',e=>{if(e.target.closest('.cal-event'))return;const rect=surface.getBoundingClientRect();const px=Math.max(0,Math.min(rect.height,e.clientY-rect.top));let preferred=Math.round((px/hourHeight*60)/15)*15;preferred=Math.max(0,Math.min(1440-15,preferred));openTaskModal(null,Number(surface.dataset.daySurface),preferred);}));
}
const utilityOrigins=new Map();
let activeUtilityPanel=null;
function openUtilityPanel(id,title){
  const panel=$(id);if(!panel)return;
  if(activeUtilityPanel)closeUtilityPanel(false);
  if(!utilityOrigins.has(panel))utilityOrigins.set(panel,{parent:panel.parentNode,next:panel.nextSibling});
  $('moreActions').open=false;
  if(panel instanceof HTMLDetailsElement)panel.open=true;
  $('utilityModalTitle').textContent=title;
  $('utilityModalContent').appendChild(panel);
  $('utilityModal').hidden=false;$('utilityModal').classList.add('show');
  activeUtilityPanel=panel;
  setTimeout(()=>{$('closeUtility').focus();},20);
}
function closeUtilityPanel(restoreFocus=true){
  const panel=activeUtilityPanel;
  if(panel){
    if(panel instanceof HTMLDetailsElement)panel.open=false;
    const origin=utilityOrigins.get(panel);
    if(origin&&origin.parent){if(origin.next&&origin.next.parentNode===origin.parent)origin.parent.insertBefore(panel,origin.next);else origin.parent.appendChild(panel);}
  }
  activeUtilityPanel=null;
  $('utilityModal').classList.remove('show');$('utilityModal').hidden=true;
  if(restoreFocus)$('moreActions').querySelector('summary')?.focus();
  if(!cloudUser&&window.signinGateInFlow){const gate=$('signinLanding');if(gate){gate.hidden=false;document.body.classList.add('signin-required');}window.signinGateInFlow=false;}
}
function openDashboard(){openUtilityPanel('dashboard','Weekly effort dashboard');}
function durationText(minutes){minutes=Math.max(0,Math.round(minutes||0));const h=Math.floor(minutes/60),m=minutes%60;if(h&&m)return `${h}h ${m}m`;if(h)return `${h}h`;return `${m}m`;}
function analyticsGroup(t){if(t.workday||/^Picnic work shift$/i.test(t.title||''))return 'workday';if(t.cityday||(t.fixed&&Number(t.duration)===540))return 'hobby';if(['job','study','language','life','hobby','other'].includes(t.type))return t.type;return 'other';}
function taskEndDate(t){const d=dayDate(currentWeek,Number(t.day)||0);return new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,Number(t.start)+Number(t.duration||0));}
function renderStats(){
  const scheduled=tasks.filter(t=>t.start!==null&&t.start!==undefined&&!t.unscheduled&&Number(t.duration)>0);
  const planned=scheduled.reduce((sum,t)=>sum+Number(t.duration||0),0);
  const logged=scheduled.filter(t=>t.done).reduce((sum,t)=>sum+Number(t.duration||0),0);
  const overdue=scheduled.filter(t=>!t.done&&t.requiresCompletion!==false&&taskEndDate(t)<=now).reduce((sum,t)=>sum+Number(t.duration||0),0);
  const upcoming=scheduled.filter(t=>!t.done&&taskEndDate(t)>now).reduce((sum,t)=>sum+Number(t.duration||0),0);
  const elapsed=scheduled.filter(t=>taskEndDate(t)<=now);
  const elapsedPlan=elapsed.reduce((sum,t)=>sum+Number(t.duration||0),0);
  const elapsedDone=elapsed.filter(t=>t.done).reduce((sum,t)=>sum+Number(t.duration||0),0);
  const completion=elapsedPlan?Math.round(elapsedDone/elapsedPlan*100):0;
  $('effortLogged').textContent=durationText(logged);
  $('plannedTotal').textContent=durationText(planned);
  $('overdueTotal').textContent=durationText(overdue);
  $('upcomingTotal').textContent=durationText(upcoming);
  $('completionRate').textContent=`${completion}%`;
  const d=parseKey(currentWeek);
  $('dashboardPeriod').textContent=`${fmtDate(d,{day:'numeric',month:'short'})} – ${fmtDate(dayDate(currentWeek,6),{day:'numeric',month:'short'})}`;
  const labels=[
    {key:'job',label:'Career',color:'#3159e8'},
    {key:'study',label:'Coursework & communication',color:'#7841d5'},
    {key:'language',label:'Languages',color:'#bd8200'},
    {key:'life',label:'Home & routines',color:'#16845d'},
    {key:'hobby',label:'Hobbies & city trips',color:'#dc6a2c'},
    {key:'workday',label:'Work day',color:'#566590'},
    {key:'other',label:'Other',color:'#2879ad'}
  ];
  const maxCategory=Math.max(1,...labels.map(g=>scheduled.filter(t=>analyticsGroup(t)===g.key).reduce((n,t)=>n+Number(t.duration||0),0)));
  $('categoryBreakdown').innerHTML=labels.map(g=>{
    const items=scheduled.filter(t=>analyticsGroup(t)===g.key),total=items.reduce((n,t)=>n+Number(t.duration||0),0),done=items.filter(t=>t.done).reduce((n,t)=>n+Number(t.duration||0),0);
    return `<div class="breakdown-row"><div class="breakdown-top"><span class="breakdown-label">${g.label}</span><span class="breakdown-hours">${durationText(done)} logged · ${durationText(total)} planned</span></div><div class="breakdown-track" aria-label="${g.label}: ${durationText(done)} completed out of ${durationText(total)} planned"><div class="breakdown-fill" style="width:${Math.min(100,total?done/total*100:0)}%;--bar-color:${g.color}"></div></div></div>`;
  }).join('');
  const daily=DAY_NAMES.map((label,day)=>{const items=scheduled.filter(t=>t.day===day),total=items.reduce((n,t)=>n+Number(t.duration||0),0),done=items.filter(t=>t.done).reduce((n,t)=>n+Number(t.duration||0),0);return {label:DAY_SHORT[day],total,done};});
  $('dailyBreakdown').innerHTML=daily.map(x=>`<div class="daily-row"><span class="daily-name">${x.label}</span><div class="daily-track" title="${durationText(x.done)} completed of ${durationText(x.total)} planned"><div class="daily-fill" style="width:${Math.min(100,x.total?x.done/x.total*100:0)}%"></div></div><span class="daily-hours">${durationText(x.done)} / ${durationText(x.total)}</span></div>`).join('');
  const unscheduled=tasks.filter(t=>!t.allDay&&(t.start===null||t.start===undefined||t.unscheduled)).length;
  $('dashboardNote').innerHTML=`Totals are estimates from scheduled durations and your completion checkmarks—not an automatic stopwatch. <strong>Past time unlogged</strong> may be wasted, missed, changed, or simply unchecked, so treat it as a review prompt rather than a verdict.${unscheduled?` ${unscheduled} activity${unscheduled===1?' needs':'ies need'} a time and is not included in the hour totals.`:''}`;
  const shiftDays=(store.settings.shifts||[]).filter(s=>s&&s.enabled).length;
  const workHabit=$('workHabitSummary');if(workHabit)workHabit.textContent=shiftDays?`${shiftDays} work day${shiftDays===1?'':'s'} / week · protected calendar block${shiftDays===1?'':'s'}`:'Set your work days in settings';
  const dest=$('tripDestination');if(dest)dest.value=store.settings.destination||'';
  $('weekLabel').textContent=calendarView==='day'?`${DAY_NAMES[mobileDay]}, ${fmtDate(dayDate(currentWeek,mobileDay),{day:'numeric',month:'short',year:'numeric'})}`:`${fmtDate(d,{day:'numeric',month:'short'})} – ${fmtDate(dayDate(currentWeek,6),{day:'numeric',month:'short',year:'numeric'})}`;
}

function renderUnscheduled(){const box=$('unscheduledBox');const pending=tasks.filter(t=>!t.fixed&&!t.allDay&&(t.start===null||t.unscheduled));const conflicts=tasks.filter(t=>t.conflict);if(!pending.length&&!conflicts.length){box.classList.remove('show');return;}box.classList.add('show');let msg=[];if(pending.length)msg.push(`${pending.length} activity${pending.length===1?' needs':'ies need'} a time: ${pending.slice(0,6).map(t=>`${t.title} (${DAY_SHORT[t.day]})`).join(', ')}${pending.length>6?'…':''}.`);if(conflicts.length)msg.push(`Work shift and city-trip overlap detected on ${[...new Set(conflicts.map(t=>DAY_NAMES[t.day]))].join(', ')}. Edit settings to resolve the conflict.`);$('unscheduledText').textContent=msg.join(' ');}
function renderHabitSummaries(){
  const shifts=store.settings.shifts||[];const active=shifts.filter(s=>s&&s.enabled).length;
  const work=$('workHabitSummary');if(work)work.textContent=active?`${active} work day${active===1?'':'s'}/week · protected calendar blocks`:'Tap to set your work days and hours';
  const t=store.settings.classTemplate||defaultClassTemplate();const cls=$('classHabitSummary');
  if(cls){const days=Array.isArray(t.days)?t.days.map(Number).filter((d,i,a)=>Number.isInteger(d)&&d>=0&&d<=6&&a.indexOf(d)===i&&d!==Number(store.settings.travelDay)).length:4;cls.textContent=`Class template · ${days} session${days===1?'':'s'}/week · ${durationLabel(Number(t.duration)||75)} · around ${t.start||'13:00'}`;}
}
function templateDayChecks(selected){return DAY_NAMES.map((day,i)=>`<label class="template-day"><input type="checkbox" data-template-day="${i}" ${selected.includes(i)?'checked':''}><span>${day}</span></label>`).join('');}
function openTemplateEditor(kind){
  const fields=$('templateFields');if(!fields)return;
  $('templateModalTitle').textContent=kind==='workday'?'Work day template':'Course / class template';
  $('templateModalDescription').textContent=kind==='workday'?'Choose the days you work and set each shift’s start and end time.':'Edit the reusable class template used to plan your weekly coursework sessions.';
  if(kind==='workday'){
    const shifts=store.settings.shifts||defaultSettings().shifts;
    fields.innerHTML=`<div class="template-shifts">${DAY_NAMES.map((day,i)=>{const s=shifts[i]||{enabled:false,start:'09:00',end:'17:00'};return `<div class="template-shift"><label class="template-shift-enable"><input type="checkbox" data-template-shift-enabled="${i}" ${s.enabled?'checked':''}><span>${day}</span></label><div class="field"><label for="templateShiftStart${i}">Start</label><input id="templateShiftStart${i}" class="time24" data-time24 data-template-shift-start="${i}" inputmode="numeric" maxlength="5" value="${escapeHtml(s.start||'09:00')}" aria-label="${day} work start" placeholder="09:00"></div><div class="field"><label for="templateShiftEnd${i}">End</label><input id="templateShiftEnd${i}" class="time24" data-time24 data-template-shift-end="${i}" inputmode="numeric" maxlength="5" value="${escapeHtml(s.end||'17:00')}" aria-label="${day} work end" placeholder="17:00"></div></div>`;}).join('')}</div><p class="template-help">Enable only your actual workdays. Times use the 24-hour clock. Save updates the reusable template. Add workdays individually from Add an activity when ready.</p>`;
  }else{
    const t=store.settings.classTemplate||defaultClassTemplate();
    const durations=[30,35,45,60,75,90,120,150,180,240];
    fields.innerHTML=`<div class="template-fields-grid"><div class="field"><label for="classTemplateTitle">Class / activity name</label><input id="classTemplateTitle" maxlength="100" required value="${escapeHtml(t.title||'Master’s coursework self-study')}" placeholder="e.g. Course self-study"></div><div class="field"><label for="classTemplateDuration">Session duration</label><select id="classTemplateDuration">${durations.map(d=>`<option value="${d}" ${Number(t.duration||75)===d?'selected':''}>${durationLabel(d)}</option>`).join('')}</select></div><div class="field"><label for="classTemplateStart">Preferred start time</label><input id="classTemplateStart" class="time24" data-time24 inputmode="numeric" maxlength="5" required value="${escapeHtml(t.start||'13:00')}" placeholder="13:00"></div></div><div class="field" style="margin-top:16px"><label>Repeat on these days</label><div class="template-days">${templateDayChecks((Array.isArray(t.days)?t.days:[1,3,5,0]).map(Number))}</div></div><p class="template-help">This saves a reusable template only. Add each class from Add an activity when you are ready.</p>`;
  }
  $('templateModal').hidden=false;$('templateModal').classList.add('show');wireTime24Fields();setTimeout(()=>{const first=fields.querySelector('input:not([type=checkbox])');(first||$('closeTemplate')).focus();},25);
}
function closeTemplateEditor(){ $('templateModal').classList.remove('show');$('templateModal').hidden=true; }
function saveTemplateEditor(e){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
  e.preventDefault();
  const currentKind=$('templateModalTitle').textContent.startsWith('Work day')?'workday':'class';
  if(currentKind==='workday'){
    const shifts=DAY_NAMES.map((_,i)=>({enabled:!!document.querySelector(`[data-template-shift-enabled="${i}"]`)?.checked,start:document.querySelector(`[data-template-shift-start="${i}"]`)?.value||'09:00',end:document.querySelector(`[data-template-shift-end="${i}"]`)?.value||'17:00'}));
    for(let i=0;i<7;i++){if(!shifts[i].enabled)continue;const start=document.querySelector(`[data-template-shift-start="${i}"]`),end=document.querySelector(`[data-template-shift-end="${i}"]`);if(!normalizeTimeField(start)||!normalizeTimeField(end)){(start.validity.valid?end:start).reportValidity?.();(start.validity.valid?end:start).focus();return;}shifts[i].start=start.value;shifts[i].end=end.value;if(timeMins(shifts[i].start)===timeMins(shifts[i].end)){showToast(`${DAY_NAMES[i]} work shift needs a non-zero duration.`);return;}}
    store.settings.shifts=shifts;
  }else{
    if(!validateTimeFields(['classTemplateStart']))return;
    const title=$('classTemplateTitle').value.trim();const days=Array.from(document.querySelectorAll('[data-template-day]:checked')).map(el=>Number(el.dataset.templateDay));
    if(!title){$('classTemplateTitle').focus();return;}if(!days.length){showToast('Choose at least one class day.');return;}
    store.settings.classTemplate={title,days,duration:Number($('classTemplateDuration').value)||75,start:$('classTemplateStart').value||'13:00'};
  }
  saveStore();saveCurrent();syncSettingsForm();renderAll();closeTemplateEditor();showToast(currentKind==='workday'?'Work day template saved. Add shifts when ready.':'Class template saved. Add classes when ready.');
}
function updateCalendarVisibility(){
 ['calendarToolbar','mobileDayPicker','mobileHelp','daysGrid','unscheduledBox'].forEach(id=>{const el=$(id);if(el)el.hidden=workspaceView!=='calendar'||(['mobileDayPicker','mobileHelp'].includes(id)&&!['day','week'].includes(calendarView));});
}
function renderAll(){if(workspaceView==='calendar')renderDays();renderStats();renderUnscheduled();renderHabitSummaries();renderWorkspaceTasks();updateWorkspaceCounts();if(workspaceView==='matrix')renderPriorityMatrix();if(activeUtilityPanel===$('routineDetails'))renderHabitTracker();if(workspaceView==='board')renderKanbanBoard();if(workspaceView==='filters')renderSavedFilters();updateCalendarPeriodLabel();updateCalendarVisibility();renderExperience();}
function moveTask(id,newDay,preferredTime=null){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
  const t=tasks.find(t=>t.id===id);if(!t||t.fixed)return;
  const preferred=preferredTime??t.start??10*60;
  const blockers=tasks.filter(x=>x.day===newDay&&x.id!==t.id);
  const slot=findSlot(newDay,t.duration,preferred,0,1440,blockers);
  t.day=newDay;t.start=slot;t.unscheduled=slot===null;t.conflict=false;
  saveCurrent();renderAll();
  if(slot===null)showToast('No free time that day. Event moved to Needs a time.');
  else if(slot!==preferred)showToast(`That time was busy; moved to ${DAY_SHORT[newDay]} ${minsTime(slot)} instead.`);
  else showToast(`Moved to ${DAY_SHORT[newDay]} · ${minsTime(slot)}`);
}
function swapTasks(idA,idB){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
  const a=tasks.find(t=>t.id===idA),b=tasks.find(t=>t.id===idB);
  if(!a||!b||a.id===b.id||a.fixed)return;
  if(b.fixed){moveTask(a.id,b.day,b.start??10*60);return;}
  const aOld={day:a.day,start:a.start??10*60},bOld={day:b.day,start:b.start??10*60};
  const remaining=tasks.filter(t=>t.id!==a.id&&t.id!==b.id);
  let aStart=null,bStart=null;
  if(aOld.day===bOld.day){
    const blockers=remaining.filter(t=>t.day===aOld.day);
    aStart=findSlot(aOld.day,a.duration,bOld.start,0,1440,blockers);
    if(aStart!==null)bStart=findSlot(bOld.day,b.duration,aOld.start,0,1440,[...blockers,{start:aStart,duration:a.duration}]);
  }else{
    aStart=findSlot(bOld.day,a.duration,bOld.start,0,1440,remaining.filter(t=>t.day===bOld.day));
    bStart=findSlot(aOld.day,b.duration,aOld.start,0,1440,remaining.filter(t=>t.day===aOld.day));
  }
  if(aStart===null||bStart===null){showToast('Could not swap: there is no available time near one of those slots.');return;}
  a.day=bOld.day;a.start=aStart;a.unscheduled=false;b.day=aOld.day;b.start=bStart;b.unscheduled=false;
  saveCurrent();renderAll();showToast('Events swapped');
}
function setupDragDrop(){
  const grid=$('daysGrid');
  let drag=null;
  const clearTargets=()=>grid.querySelectorAll('.is-drop-target,.drop-over,.drag-source').forEach(el=>el.classList.remove('is-drop-target','drop-over','drag-source'));
  const removeGhost=()=>{if(drag?.ghost)drag.ghost.remove();};
  const endDrag=()=>{clearTargets();removeGhost();drag=null;};
  const locate=(x,y)=>{
    const hit=document.elementFromPoint(x,y);
    const column=hit?.closest('.day-column');
    if(!column)return null;
    const surface=column.querySelector('.drop-surface');
    if(!surface)return null;
    const rect=surface.getBoundingClientRect();
    const ratio=Math.max(0,Math.min(1,(y-rect.top)/Math.max(1,rect.height)));
    const source=drag?tasks.find(t=>t.id===drag.id):null;
    const maxStart=Math.max(0,1440-(source?.duration||15));
    const start=Math.max(0,Math.min(maxStart,Math.round((ratio*1440)/15)*15));
    const targetEvent=hit?.closest('.cal-event');
    return {day:Number(column.dataset.dayIndex),start,targetEvent:targetEvent&&targetEvent.dataset.taskId!==drag?.id?targetEvent:null,column};
  };
  grid.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-drag-handle]');
    const card=e.target.closest('.cal-event');
    const id=handle?.dataset.dragHandle||card?.dataset.taskId;
    if(!id)return;
    if(e.target.closest('.event-tool,.event-check,[data-done],[data-delete],[data-fixed-open]'))return;
    const task=tasks.find(t=>t.id===id);if(!task||task.fixed)return;
    drag={id, pointerId:e.pointerId, startX:e.clientX, startY:e.clientY, active:false, ghost:null, last:null, sourceEl:card||handle.closest('.backlog-event')};
    // Keep normal click-to-edit behaviour unless the pointer actually moves.
  });
  document.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(!drag.active&&Math.hypot(dx,dy)<6)return;
    if(!drag.active){
      drag.active=true;
      if(drag.sourceEl?.classList)drag.sourceEl.classList.add('drag-source');
      drag.ghost=document.createElement('div');drag.ghost.className='drag-ghost';drag.ghost.textContent=tasks.find(t=>t.id===drag.id)?.title||'Move activity';document.body.appendChild(drag.ghost);
      try{if(navigator.vibrate&&e.pointerType==='touch')navigator.vibrate(12);}catch(_){ }
    }
    e.preventDefault();
    // Scroll the calendar automatically when dragging near an edge, so early/late
    // hours and off-screen days remain reachable without releasing the event.
    const scrollRect=grid.getBoundingClientRect(),edge=46;
    if(e.clientY<scrollRect.top+edge)grid.scrollTop=Math.max(0,grid.scrollTop-24);
    else if(e.clientY>scrollRect.bottom-edge)grid.scrollTop=Math.min(grid.scrollHeight-grid.clientHeight,grid.scrollTop+24);
    if(e.clientX<scrollRect.left+edge)grid.scrollLeft=Math.max(0,grid.scrollLeft-22);
    else if(e.clientX>scrollRect.right-edge)grid.scrollLeft=Math.min(grid.scrollWidth-grid.clientWidth,grid.scrollLeft+22);
    if(drag.ghost)drag.ghost.style.left=`${e.clientX}px`,drag.ghost.style.top=`${e.clientY}px`;
    clearTargets();
    const info=locate(e.clientX,e.clientY);drag.last=info;
    if(info){if(info.targetEvent)info.targetEvent.classList.add('drop-over');else info.column.classList.add('is-drop-target');if(drag.ghost)drag.ghost.textContent=`${DAY_SHORT[info.day]} · ${minsTime(info.start)}`;}
    else if(drag.ghost)drag.ghost.textContent='Drop on a day and time';
  },{passive:false});
  document.addEventListener('pointerup',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const state=drag;const wasActive=state.active;const info=wasActive?locate(e.clientX,e.clientY):null;
    endDrag();
    if(!wasActive)return;
    if(info?.targetEvent){swapTasks(state.id,info.targetEvent.dataset.taskId);return;}
    if(info){moveTask(state.id,info.day,info.start);return;}
    showToast('To move an event, drop it inside a day column at the time you want.');
  });
  document.addEventListener('pointercancel',e=>{if(drag&&e.pointerId===drag.pointerId)endDrag();});
}
const ACTIVITY_TEMPLATE_PRESETS={
  german:{title:'German practice',type:'language',duration:30,start:'08:30',note:'Vocabulary, grammar, listening, or speaking practice.'},
  english:{title:'English fluency practice',type:'language',duration:20,start:'11:15',note:'Speak aloud, shadow a podcast, or record a short answer.'},
  jobs:{title:'Job applications & follow-ups',type:'job',duration:75,start:'09:30',note:'Complete one tailored application or follow-up.'},
  cooking:{title:'Cook meals for the next 2 days',type:'life',duration:60,start:'18:00',note:'Prepare enough food for the next two days.'},
  cleaning:{title:'Quick clean & reset',type:'life',duration:10,start:'20:30',note:'A short tidy to reset your space.'},
  cycling:{title:'Cycling / outdoor time',type:'hobby',duration:60,start:'16:00',note:'Ride at a comfortable pace and enjoy the outdoors.'},
  movies:{title:'Movie / guilt-free downtime',type:'hobby',duration:120,start:'20:00',note:'Relax without needing to make the time productive.'},
  communication:{title:'Communication skills practice',type:'study',duration:15,start:'15:00',note:'Practise storytelling, conversation, or an interview answer.'}
};
function currentDayHasConfiguredShift(day){
  return tasks.some(t=>Number(t.day)===Number(day)&&(t.workday||/^work day$/i.test(t.title||'')));
}
function updateActivityTemplateStates(){
  const day=Number($('modalDay')?.value??mobileDay);
  document.querySelectorAll('[data-template]').forEach(button=>{
    const isWorkday=button.dataset.template==='workday';
    const disabled=isWorkday&&currentDayHasConfiguredShift(day)&&!$('editTaskId')?.value;
    button.disabled=false;
    button.setAttribute('aria-disabled',disabled?'true':'false');
    const meta=button.querySelector('.activity-template-meta');
    if(meta&&isWorkday){
      const shift=store.settings.shifts?.[day];
      meta.textContent=disabled?'Already scheduled today':(shift?.enabled?'Uses your shift hours':(store.settings.shifts||[]).some(x=>x?.enabled)?'Copies your shift hours':'Default 09:00–17:00');
    }
  });
}
function chooseActivityTemplate(key){
  const day=Number($('modalDay').value);
  if(key==='workday'&&currentDayHasConfiguredShift(day)){
    showToast(`A Work day block already exists on ${DAY_NAMES[day]}. Choose a non-workday or edit Work day settings.`);
    return;
  }
  let preset=ACTIVITY_TEMPLATE_PRESETS[key]?{...ACTIVITY_TEMPLATE_PRESETS[key]}:null;
  if(key==='class'){
    const t=store.settings.classTemplate||defaultClassTemplate();
    preset={title:String(t.title||'Course self-study'),type:'study',duration:Math.max(15,Math.min(240,Number(t.duration)||75)),start:t.start||'13:00',note:'Single session based on your saved class template.'};
  }
  if(key==='workday'){
    const shifts=store.settings.shifts||[];
    const sample=shifts[day]?.enabled?shifts[day]:shifts.find(x=>x?.enabled)||{start:'09:00',end:'17:00'};
    const start=sample.start||'09:00',end=sample.end||'17:00';
    let duration=timeMins(end)-timeMins(start);if(duration<=0)duration+=1440;
    preset={title:'Work day',type:'job',duration:Math.min(1440,duration||480),start,note:'Editable one-day work block. Recurring work shifts are managed in Work day settings.'};
  }
  if(!preset)return;
  $('modalTitleInput').value=preset.title;
  $('modalCategory').value=preset.type;
  const durationSelect=$('modalDuration'),duration=String(preset.duration);
  if(!Array.from(durationSelect.options).some(o=>o.value===duration)){
    const option=document.createElement('option');option.value=duration;option.textContent=durationLabel(Number(duration));durationSelect.add(option);
  }
  durationSelect.value=duration;
  $('modalTime').value=preset.start;
  updateEndTimeFromDuration();
  $('modalNote').value=preset.note||'';
  selectedActivitySuggestion=key;hideActivitySuggestions();const nameInput=$('modalTitleInput');if(document.activeElement!==nameInput){suppressActivitySuggestionFocus=true;nameInput.focus({preventScroll:true});}hideActivitySuggestions();
}
let selectedActivitySuggestion=null;
let suppressActivitySuggestionFocus=false;
const ACTIVITY_SUGGESTIONS=[
 {key:'german',label:'German practice'},
 {key:'english',label:'English fluency practice'},
 {key:'jobs',label:'Job applications & follow-ups'},
 {key:'workday',label:'Work day'},
 {key:'class',label:'Class / coursework'},
 {key:'cooking',label:'Cooking'},
 {key:'cleaning',label:'Cleaning'},
 {key:'cycling',label:'Cycling'},
 {key:'movies',label:'Movies & rest'},
 {key:'communication',label:'Communication skills'}
];
function hideActivitySuggestions(){const list=$('activitySuggestions'),input=$('modalTitleInput');if(list)list.hidden=true;if(input)input.setAttribute('aria-expanded','false');}
function renderActivitySuggestions(query=''){
 const list=$('activitySuggestions'),input=$('modalTitleInput');if(!list||!input)return;
 const q=String(query||'').trim().toLowerCase();
 const options=ACTIVITY_SUGGESTIONS.filter(x=>!q||x.label.toLowerCase().includes(q)||String(ACTIVITY_TEMPLATE_PRESETS[x.key]?.title||'').toLowerCase().includes(q));
 if(!options.length){hideActivitySuggestions();return;}
 list.innerHTML=options.map(x=>'<button type="button" class="activity-suggestion" role="option" aria-label="'+escapeHtml(x.label)+'" data-activity-suggestion="'+x.key+'">'+escapeHtml(x.label)+'</button>').join('');
 list.hidden=false;input.setAttribute('aria-expanded','true');
 list.querySelectorAll('[data-activity-suggestion]').forEach(button=>{button.addEventListener('pointerdown',e=>e.preventDefault());button.addEventListener('click',()=>chooseActivityTemplate(button.dataset.activitySuggestion));});
}
function clearActivityTemplateSelection(){selectedActivitySuggestion=null;hideActivitySuggestions();}
function inferredListId(t){
  if(t&&(['inbox','career','study','work','personal','language','hobbies','other'].includes(t.listId)||(Array.isArray(store.customLists)&&store.customLists.some(list=>list.id===t.listId))))return t.listId;
  if(!t||t.unscheduled||t.start==null)return 'inbox';
  if(t.workday||/^work day$/i.test(t.title||''))return 'work';
  return ({job:'career',study:'study',language:'language',life:'personal',hobby:'hobbies',other:'other'})[t.type]||'other';
}
function defaultFolderName(listId){
 const customList=Array.isArray(store.customLists)?store.customLists.find(list=>list.id===listId):null;
 if(customList)return customList.name;
 if(['career','work'].includes(listId))return 'Career & Work';
 if(['study','language'].includes(listId))return 'Learning';
 if(['personal','hobbies','other'].includes(listId))return 'Personal';
 return 'Inbox';
}
function taskReminderTimes(task){
 const source=Array.isArray(task?.reminderTimes)?task.reminderTimes:(task?.reminderAt?[task.reminderAt]:[]);
 return [...new Set(source.map(value=>String(value||'').trim()).filter(Boolean))].slice(0,5);
}
function updateModalScheduleVisibility(){
  const noSchedule=!!$('modalNoSchedule')?.checked,allDay=!!$('modalAllDay')?.checked;
  const fields=$('taskSchedulingFields');if(fields)fields.hidden=noSchedule||allDay;
  ['modalTime','modalEndTime','modalDuration'].forEach(id=>{const el=$(id);if(el)el.required=!noSchedule&&!allDay;});
  if(noSchedule||allDay){$('modalEndTime').setCustomValidity('');$('modalTime').setCustomValidity('');}
}
function taskModalFingerprint(){
  const form=$('taskForm');
  if(!form)return '';
  return JSON.stringify(Array.from(form.elements)
    .filter(el=>el.id&&['INPUT','SELECT','TEXTAREA'].includes(el.tagName))
    .map(el=>[el.id,el.type==='checkbox'||el.type==='radio'?el.checked:el.value]));
}
let taskModalInitialFingerprint='',editorSession=null,editorDraftTimer=null;
function draftFields(){return Object.fromEntries([...$('taskForm').elements].filter(el=>WeekwiseDrafts.FIELDS.has(el.id)).map(el=>[el.id,el.type==='checkbox'?el.checked:el.value]));}
function checkpointEditorDraft(){if(!editorSession||!$('taskModal').classList.contains('show')||editorSession.owner!==currentDataOwner||taskModalFingerprint()===taskModalInitialFingerprint)return;WeekwiseDrafts.save(localStorage,{version:2,...editorSession,fields:draftFields(),savedAt:new Date().toISOString()});renderDraftNotice();}
function renderDraftNotice(){const result=WeekwiseDrafts.read(localStorage,currentDataOwner);$('editorDraftNotice').hidden=!result;if(!result)return;$('editorDraftTitle').textContent=result.error?'Editor draft needs recovery':'Unsaved editor draft';$('editorDraftDescription').textContent=result.error?'The original draft is preserved. Download it before discarding or recovering it.':(result.draft.fields.modalTitleInput||'Untitled task')+' · saved on this device';$('restoreEditorDraft').disabled=!!result.error;}
function retireEditorDraft(){const result=WeekwiseDrafts.read(localStorage,currentDataOwner);if(result?.draft&&result.draft.sessionId===editorSession?.sessionId){WeekwiseDrafts.discard(localStorage,currentDataOwner,result.raw);renderDraftNotice();}}
function restoreEditorDraft(){try{const result=WeekwiseDrafts.read(localStorage,currentDataOwner);if(!result||result.error)throw new Error(result?.error||'No saved editor draft.');if($('taskModal').classList.contains('show')&&taskModalFingerprint()!==taskModalInitialFingerprint){showToast('Save or close your current editor before restoring a draft.');return;}const draft=result.draft,id=draft.fields.editTaskId||'',record=id?workspaceRecords().find(r=>r.task.id===id&&r.week===draft.week):null,same=record&&draft.base===JSON.stringify(record.task);if(same){openWorkspaceRecord(id,draft.week);}else openTaskModal(null,Number(draft.fields.modalDay)||now.getDay(),null,'inbox');const fields={...draft.fields};if(!same){fields.editTaskId='';fields.modalNoSchedule=true;fields.modalAllDay=false;fields.modalRecurrence='none';fields.modalRecurrenceScope='occurrence';}for(const [name,value]of Object.entries(fields)){const el=$(name);if(!el||!$('taskForm').contains(el))continue;if(el.type==='checkbox')el.checked=!!value;else if(el.tagName==='SELECT'){if(![...el.options].some(o=>o.value===value)){if(name!=='modalDuration'||!/^\d+$/.test(value)||Number(value)>1440)continue;const option=document.createElement('option');option.value=value;option.textContent=durationLabel(Number(value));el.add(option);}el.value=value;}else el.value=value;}editorSession={owner:currentDataOwner,sessionId:draft.sessionId,week:currentWeek,base:same?draft.base:null};updateModalScheduleVisibility();hideActivitySuggestions();showToast(same?'Draft restored to its original activity. Save when ready.':id?'The original activity changed. Recovered as a new unscheduled draft; review before saving.':'Draft restored. Review and save when ready.');$('modalTitleInput').focus({preventScroll:true});}catch(error){showToast(error.message);}}
function openTaskModal(id=null,day=mobileDay,startAt=null,defaultListId=null){
  const modal=$('taskModal');const t=id?tasks.find(t=>t.id===id):null;
  editorSession={owner:currentDataOwner,sessionId:uid(),week:currentWeek,base:t?JSON.stringify(t):null};
  if(id&&!t){showToast('This activity is no longer available. It may have been moved or deleted. Refresh the list and try again.');return;}
  renderTaskTemplateOptions();$('taskTemplateSelect').value='';$('deleteTaskTemplateBtn').disabled=true;
  $('editTaskId').value=t?.id||'';if(!t)clearActivityTemplateSelection();else hideActivitySuggestions();$('modalTitle').textContent=t?'Edit task':'Add a task';
  $('modalDescription').textContent=t?'To move this activity, choose a new day and start time, then tap Save changes. If the time is busy, Weekwise will choose the nearest available slot.':'Choose the day, start time, and duration. Enter HH:MM (for example, 17:30), or type 1730 and it will format automatically.';
  $('modalTitleInput').value=t?.title||'';$('modalDay').value=String(t?.day??day);$('modalCategory').value=t?.type||'life';
  const folderView=workspaceView.startsWith('folder:'),selectedFolder=folderView?workspaceView.slice(7):'';
  const folderExisting=folderView?workspaceRecords().find(r=>(r.task.folderName||defaultFolderName(r.listId))===selectedFolder):null;
  $('modalListId').value=t?inferredListId(t):(defaultListId||(folderExisting?.listId)||'career');
  if(!t&&!defaultListId&&!folderView)$('modalListId').value=({job:'career',study:'study',language:'language',life:'personal',hobby:'hobbies',other:'other'})[$('modalCategory').value]||'career';
  $('modalFolder').value=t?.folderName||(folderView?selectedFolder:defaultFolderName($('modalListId').value));
  $('modalSection').value=t?.sectionName||'';
  $('modalSchedulingMode').value=t?.schedulingMode||((t?.fixed||t?.workday||t?.type==='fixed')?'fixed':'flexible');
  $('modalPriority').value=t?.priority||'none';$('modalStatus').value=t?.done?'done':(t?.status||'todo');$('modalDurationEstimate').value=t?.estimatedDurationMinutes??'';$('modalRequiresCompletion').checked=t?.requiresCompletion!==false;$('modalTodayPriority').checked=!!t?.todayPriority;
  $('modalFocusEstimate').value=t?.focusEstimateMinutes?String(t.focusEstimateMinutes):'';$('modalImportance').value=t?.importance||'unclassified';$('modalUrgency').value=t?.urgency||'unclassified';$('modalRecurrenceScope').value='occurrence';$('modalRecurrenceScope').disabled=!t?.seriesId;
  $('modalRecurrence').value=t?.recurrence||'none';$('modalDueDate').value=t?.dueDate||'';const existingReminderTimes=taskReminderTimes(t);
  $('modalReminderAt').value=existingReminderTimes[0]||'';
  [2,3,4,5].forEach((n,index)=>{const input=$('modalReminderAt'+n);if(input)input.value=existingReminderTimes[index+1]||'';});
  const extraReminderDetails=document.querySelector('.task-extra-reminders');if(extraReminderDetails)extraReminderDetails.open=existingReminderTimes.length>1;
  $('modalTags').value=Array.isArray(t?.tags)?t.tags.join(', '):String(t?.tags||'');
  if(!t&&workspaceView.startsWith('tag:'))$('modalTags').value=workspaceView.slice(4);
  $('modalSubtasks').value=Array.isArray(t?.subtasks)?t.subtasks.map(s=>typeof s==='string'?s:s.title||'').join('\n'):'';
  $('modalAllDay').checked=!!t?.allDay;
  $('modalNoSchedule').checked=!!(t&&(t.unscheduled||t.start==null)&&!t.allDay)||(!t&&defaultListId==='inbox');
  const durationSelect=$('modalDuration'),duration=String(t?.duration||30);
  if(!Array.from(durationSelect.options).some(o=>o.value===duration)){const option=document.createElement('option');option.value=duration;option.textContent=durationLabel(Number(duration));durationSelect.add(option);}
  durationSelect.value=duration;const chosenStart=t?.start??(startAt===null||startAt===undefined?nextQuarterHour():startAt);$('modalTime').value=minsTime(chosenStart);updateEndTimeFromDuration();$('modalNote').value=t?.note||'';
  $('saveTaskBtn').textContent=t?'Save changes':'Add task';$('deleteTaskBtn').style.display=t&&!t.fixed?'inline-flex':'none';
  updateModalScheduleVisibility();
  taskModalInitialFingerprint=taskModalFingerprint();
  modal.classList.add('show');
  (()=>{
    const titleInput=$('modalTitleInput');
    if(t){
      hideActivitySuggestions();
      if(document.activeElement!==titleInput){
        suppressActivitySuggestionFocus=true;
        titleInput.focus({preventScroll:true});
      }else{
        suppressActivitySuggestionFocus=false;
      }
      hideActivitySuggestions();
    }else{
      titleInput.focus();
    }
  })();
}
function closeTaskModal(force=false){
  const modal=$('taskModal');
  if(!modal||!modal.classList.contains('show'))return;
  if(!force&&taskModalFingerprint()!==taskModalInitialFingerprint){
    if(!window.confirm('Discard your unsaved changes?'))return;
    try{retireEditorDraft();}catch(error){showToast(error.message);return;}
  }
  modal.classList.remove('show');
  taskModalInitialFingerprint='';
  $('editTaskId').value='';
  hideActivitySuggestions();
}
function saveModalTask(e){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
  e.preventDefault();
  const id=$('editTaskId').value,title=$('modalTitleInput').value.trim();if(!title)return;
  if(id){
    const existing=tasks.find(t=>t.id===id);
    if(!existing){showToast('This activity is no longer available. Refresh the current view before saving.');return;}
    if(existing.fixed){showToast('This time block is managed by Work day & weekly settings; no changes were saved.');return;}
  }
  const schedulingMode=$('modalSchedulingMode').value;
  const noSchedule=!!$('modalNoSchedule').checked,allDay=!!$('modalAllDay').checked&&!noSchedule;
  let preferred=null,duration=Math.max(10,Number($('modalDuration').value)||30);
  if(!noSchedule&&!allDay){
    if(!validateTimeFields(['modalTime']))return;
    if(!normalizeEndTimeField($('modalEndTime'))){$('modalEndTime').reportValidity?.();$('modalEndTime').focus();return;}
    const start=timeMins($('modalTime').value||'10:00'),end=timeMins($('modalEndTime').value);
    if(end<=start){$('modalEndTime').setCustomValidity('End time must be later than start time on the same day. Use 24:00 for midnight.');$('modalEndTime').reportValidity?.();$('modalEndTime').focus();return;}
    $('modalEndTime').setCustomValidity('');preferred=start;duration=end-start;
  }
  const day=Number($('modalDay').value),type=$('modalCategory').value,note=$('modalNote').value.trim(),recurrence=$('modalRecurrence').value;
  const occurrenceDate=dateKey(dayDate(currentWeek,day));
  const listId=$('modalListId').value,folderName=$('modalFolder').value.trim()||defaultFolderName($('modalListId').value),sectionName=$('modalSection').value.trim(),priority=$('modalPriority').value,status=$('modalStatus').value,importance=$('modalImportance').value,urgency=$('modalUrgency').value,dueDate=$('modalDueDate').value||null,reminderTimes=[...new Set([1,2,3,4,5].map(n=>$('modalReminderAt'+(n===1?'':n)).value||'').filter(Boolean))].sort().slice(0,5),reminderAt=reminderTimes[0]||null;
  const focusEstimateRaw=$('modalFocusEstimate').value.trim();
  const focusEstimateMinutes=focusEstimateRaw?Math.max(5,Math.min(1440,Math.round(Number(focusEstimateRaw)/5)*5)):null;
  const estimatedDurationMinutes=$('modalDurationEstimate').value?Number($('modalDurationEstimate').value):null,requiresCompletion=$('modalRequiresCompletion').checked,todayPriority=$('modalTodayPriority').checked;
  const tags=[...new Set($('modalTags').value.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean).slice(0,20))];
  const attachmentParse=parseTaskAttachmentInput($('modalAttachments').value);
  if(attachmentParse.invalid.length){showToast('Use complete http:// or https:// URLs for attachments.');$('modalAttachments').focus();return;}
  const attachments=attachmentParse.valid;
  const subtasks=$('modalSubtasks').value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,40).map(title=>({id:uid(),title,done:false}));
  if(!id&&!noSchedule&&title.toLowerCase()==='work day'&&currentDayHasConfiguredShift(day)){showToast(`A Work day block is already scheduled on ${DAY_NAMES[day]}. Choose another day or use Work day settings.`);updateActivityTemplateStates();return;}
  let actualStart=null,seriesId=null,templateFields={title,type,schedulingMode,estimatedDurationMinutes,requiresCompletion,duration,start:preferred,allDay,note,recurrence,listId,folderName,sectionName,priority,status,focusEstimateMinutes,importance,urgency,dueDate,reminderAt,reminderTimes,tags,subtasks,attachments};
  if(id){
    const t=tasks.find(x=>x.id===id);
    if(t&&!t.fixed){
      const oldSeriesId=t.seriesId||null;
      t.title=title;t.day=day;t.type=type;t.schedulingMode=schedulingMode;t.duration=duration;t.note=note;t.listId=listId;t.folderName=folderName;t.sectionName=sectionName;t.priority=priority;t.status=status;t.done=status==='done';t.focusEstimateMinutes=focusEstimateMinutes;t.estimatedDurationMinutes=estimatedDurationMinutes;t.requiresCompletion=requiresCompletion;t.todayPriority=todayPriority;t.importance=importance;t.urgency=urgency;t.dueDate=dueDate;t.reminderTimes=reminderTimes;t.reminderAt=reminderAt;t.reminderNotifiedTimes=(Array.isArray(t.reminderNotifiedTimes)?t.reminderNotifiedTimes:[]).filter(value=>reminderTimes.includes(value));if(t.reminderNotifiedAt&&reminderTimes.includes(t.reminderNotifiedAt)&&!t.reminderNotifiedTimes.includes(t.reminderNotifiedAt))t.reminderNotifiedTimes.push(t.reminderNotifiedAt);t.reminderNotifiedAt=t.reminderNotifiedAt===reminderAt?reminderAt:null;t.tags=tags;t.attachments=attachments;t.allDay=allDay;t.allDayDate=allDay?occurrenceDate:null;
      const prior=Array.isArray(t.subtasks)?t.subtasks:[];
      t.subtasks=subtasks.map(s=>{const old=prior.find(p=>typeof p==='object'&&p.title===s.title);return old?{...old,...s,id:old.id||s.id,done:!!old.done}:{...s};});
      t.start=noSchedule||allDay?null:findSlot(day,duration,preferred,0,1440,tasks.filter(x=>x.day===day&&x.id!==id));t.unscheduled=noSchedule||(!allDay&&t.start===null);actualStart=t.start;
      if(recurrence==='none'){
        if(oldSeriesId){if($('modalRecurrenceScope').value==='occurrence'){const rule=store.recurringTemplates.find(r=>r.id===oldSeriesId);if(rule)rule.excludedDates=[...new Set([...(rule.excludedDates||[]),t.occurrenceDate||occurrenceDate])];t.seriesId=null;t.recurrence='none';t.occurrenceDate=null;}else stopRecurringSeries(t,occurrenceDate,$('modalRecurrenceScope').value);}
        else{t.recurrence='none';t.seriesId=null;t.occurrenceDate=null;}
      }else{
        seriesId=oldSeriesId||uid();t.seriesId=seriesId;t.occurrenceDate=occurrenceDate;t.recurrence=recurrence;
        if(oldSeriesId&&$('modalRecurrenceScope').value==='occurrence'){t.recurrenceOverride=true;}else{const anchor=$('modalRecurrenceScope').value==='series'?(store.recurringTemplates.find(r=>r.id===seriesId)?.startDate||occurrenceDate):occurrenceDate;upsertRecurringTemplate(seriesId,anchor,templateFields);}
      }
    }
  }else{
    createTask(day,title,type,duration,noSchedule||allDay?null:preferred,{min:0,max:1440,custom:true,note});
    const t=tasks[tasks.length-1];t.schedulingMode=schedulingMode;t.unscheduled=noSchedule||(!allDay&&t.start===null);t.allDay=allDay;t.allDayDate=allDay?occurrenceDate:null;t.listId=listId;t.folderName=folderName;t.sectionName=sectionName;t.priority=priority;t.status=status;t.done=status==='done';t.focusEstimateMinutes=focusEstimateMinutes;t.estimatedDurationMinutes=estimatedDurationMinutes;t.requiresCompletion=requiresCompletion;t.todayPriority=todayPriority;t.importance=importance;t.urgency=urgency;t.dueDate=dueDate;t.reminderTimes=reminderTimes;t.reminderAt=reminderAt;t.reminderNotifiedAt=null;t.reminderNotifiedTimes=[];t.tags=tags;t.attachments=attachments;t.subtasks=subtasks;actualStart=t.start;
    if(recurrence!=='none'){
      seriesId=uid();t.seriesId=seriesId;t.occurrenceDate=occurrenceDate;t.recurrence=recurrence;
      upsertRecurringTemplate(seriesId,occurrenceDate,templateFields);
    }else t.recurrence='none';
  }
  if(seriesId||recurrence!=='none')materializeRecurringRange(parseKey(currentWeek),parseKey(addDaysToKey(currentWeek,89)));
  saveCurrent();let retainedDraftMessage='';try{retireEditorDraft();}catch(error){retainedDraftMessage='Task saved; its draft is retained: '+error.message;}closeTaskModal(true);renderAll();
  if(retainedDraftMessage){showToast(retainedDraftMessage);return;}
  if(recurrence!=='none')showToast('Task saved · repeating '+recurrence+'.');
  else if(allDay)showToast('All-day event saved for '+fmtDate(dayDate(currentWeek,day),{weekday:'short',day:'numeric',month:'short'})+'.');
  else if(noSchedule)showToast('Task saved to '+(listId==='inbox'?'Inbox':'your list')+'.');
  else if(actualStart===null)showToast('No free slot on that day; task is in Needs a time.');
  else if(actualStart!==preferred)showToast(`That time was busy; scheduled at ${minsTime(actualStart)} instead.`);
  else showToast(id?`Task updated · ${DAY_SHORT[day]} ${minsTime(actualStart)}`:`Task added · ${DAY_SHORT[day]} ${minsTime(actualStart)}`);
}
function applySettings(){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}const timeIds=['tripStart'];for(let i=0;i<7;i++){if(document.querySelector(`[data-shift-enabled="${i}"]`)?.checked)timeIds.push(`shiftstart${i}`,`shiftend${i}`);}if(!validateTimeFields(timeIds))return;const newWeek=$('weekStart').value?dateKey(sundayOf(parseKey($('weekStart').value))):currentWeek;saveCurrent();store.settings=settingsFromForm();applyThemePreference(store.settings.theme);saveStore();loadWeek(newWeek);closeUtilityPanel();showToast('Settings saved. Add activities whenever you are ready.');}
function saveTripDestination(){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}store.settings.destination=$('tripDestination').value.trim();saveStore();const trip=tasks.find(t=>t.fixed&&t.duration===540&&t.day===store.settings.travelDay);if(trip)trip.title=store.settings.destination?`Explore ${store.settings.destination}`:'Explore another city';if(trip)trip.note='9-hour city day · travel, explore, eat, and enjoy';saveCurrent();renderAll();showToast('City day updated');}

function reminderTodayKey(){return dateKey(new Date());}
function reminderState(note){if(note.done)return {label:'Completed',kind:'done'};if(!note.date)return {label:'No date',kind:'none'};const today=reminderTodayKey();if(note.date<today)return {label:'Overdue',kind:'overdue'};if(note.date===today)return {label:'Due today',kind:'today'};return {label:fmtDate(parseKey(note.date),{day:'numeric',month:'short'}),kind:'upcoming'};}
function reminderDueOpen(){return reminders.filter(n=>!n.done&&n.date&&n.date<=reminderTodayKey());}
function updateReminderBadge(){const badge=$('reminderBadge');if(!badge)return;const count=reminderDueOpen().length;badge.textContent=String(count);badge.hidden=count===0;const menu=$('remindersMenuBtn');if(menu)menu.setAttribute('aria-label',count?'Reminders and sticky notes, '+count+' due':'Reminders and sticky notes');}
function reminderFormReset(){$('reminderId').value='';$('reminderTitle').value='';$('reminderBody').value='';$('reminderDate').value='';$('reminderColour').value='yellow';$('reminderPinned').checked=false;$('saveReminderBtn').textContent='＋ Save reminder';$('cancelReminderEdit').hidden=true;}
function reminderEdit(id){const note=reminders.find(n=>n.id===id);if(!note)return;$('reminderId').value=note.id;$('reminderTitle').value=note.title||'';$('reminderBody').value=note.body||'';$('reminderDate').value=note.date||'';$('reminderColour').value=note.colour||'yellow';$('reminderPinned').checked=!!note.pinned;$('saveReminderBtn').textContent='Save changes';$('cancelReminderEdit').hidden=false;$('reminderTitle').focus();}
function reminderSave(e){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}e.preventDefault();const title=$('reminderTitle').value.trim();if(!title){$('reminderTitle').focus();return;}const id=$('reminderId').value,fields={title,body:$('reminderBody').value.trim(),date:$('reminderDate').value||'',colour:$('reminderColour').value||'yellow',pinned:$('reminderPinned').checked,updatedAt:new Date().toISOString()};if(id){const note=reminders.find(n=>n.id===id);if(note)Object.assign(note,fields);}else reminders.push({id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),...fields,done:false,createdAt:new Date().toISOString()});saveReminders();reminderFormReset();renderReminders();showToast(id?'Reminder updated':'Reminder saved');}
function reminderToggleDone(id){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}const note=reminders.find(n=>n.id===id);if(!note)return;note.done=!note.done;note.updatedAt=new Date().toISOString();saveReminders();renderReminders();showToast(note.done?'Reminder completed':'Reminder reopened');}
function reminderTogglePin(id){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}const note=reminders.find(n=>n.id===id);if(!note)return;note.pinned=!note.pinned;saveReminders();renderReminders();}
function reminderDelete(id){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}const note=reminders.find(n=>n.id===id);if(!note)return;if(!confirm('Delete this reminder?'))return;reminders=reminders.filter(n=>n.id!==id);saveReminders();renderReminders();showToast('Reminder deleted');}
function renderReminders(){
 const list=$('reminderList');if(!list)return;updateReminderBadge();const filter=$('reminderFilter')?.value||'open';let items=reminders.slice();if(filter==='open')items=items.filter(n=>!n.done);if(filter==='done')items=items.filter(n=>n.done);if(filter==='due')items=items.filter(n=>!n.done&&n.date&&n.date<=reminderTodayKey());
 items.sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||Number(!!a.done)-Number(!!b.done)||((a.date||'9999-12-31').localeCompare(b.date||'9999-12-31'))||(b.createdAt||'').localeCompare(a.createdAt||''));
 const due=reminderDueOpen().length,open=reminders.filter(n=>!n.done).length;const summary=$('reminderSummary');if(summary)summary.textContent=open+' open · '+due+' due today or overdue · '+reminders.length+' total';
 if(!items.length){list.innerHTML='<div class="reminder-empty">'+(reminders.length?'No notes match this filter.':'Your sticky-note space is empty. Add a reminder above — with or without a date.')+'</div>';return;}
 list.innerHTML=items.map(n=>{const st=reminderState(n),colour=['yellow','purple','blue','green','pink'].includes(n.colour)?n.colour:'yellow';return '<article class="sticky-note note-'+colour+(n.done?' note-done':'')+(n.pinned?' is-pinned':'')+'" data-reminder-id="'+escapeHtml(n.id)+'"><div class="sticky-note-top"><div class="sticky-note-markers">'+(n.pinned?'<span class="sticky-tag">Pinned</span>':'')+'<span class="sticky-tag">'+escapeHtml(st.label)+'</span></div><button class="sticky-pin" type="button" data-reminder-pin="'+escapeHtml(n.id)+'" aria-label="'+(n.pinned?'Unpin':'Pin')+' reminder" title="'+(n.pinned?'Unpin':'Pin')+'">'+(n.pinned?'📌':'＋')+'</button></div><h4 class="'+(n.done?'is-done':'')+'">'+escapeHtml(n.title)+'</h4>'+(n.body?'<p>'+escapeHtml(n.body)+'</p>':'')+'<div class="sticky-note-foot"><span class="sticky-note-date">'+(n.date?'◷ '+escapeHtml(st.label):'✦ Flexible reminder')+'</span><div class="sticky-note-actions"><button type="button" data-reminder-done="'+escapeHtml(n.id)+'">'+(n.done?'Reopen':'Done')+'</button><button type="button" data-reminder-edit="'+escapeHtml(n.id)+'">Edit</button><button type="button" data-reminder-delete="'+escapeHtml(n.id)+'">×</button></div></div></article>';}).join('');
 list.querySelectorAll('[data-reminder-done]').forEach(b=>b.addEventListener('click',()=>reminderToggleDone(b.dataset.reminderDone)));
 list.querySelectorAll('[data-reminder-pin]').forEach(b=>b.addEventListener('click',()=>reminderTogglePin(b.dataset.reminderPin)));
 list.querySelectorAll('[data-reminder-edit]').forEach(b=>b.addEventListener('click',()=>reminderEdit(b.dataset.reminderEdit)));
 list.querySelectorAll('[data-reminder-delete]').forEach(b=>b.addEventListener('click',()=>reminderDelete(b.dataset.reminderDelete)));
}
function openReminders(){renderReminders();openUtilityPanel('remindersPanel','Reminders & sticky notes');}
function nudgeDueReminders(){const due=reminderDueOpen();if(!due.length)return;const today=reminderTodayKey();let seen='';try{seen=localStorage.getItem('weekwise-reminder-nudge-v1')||'';}catch(_){}if(seen===today)return;try{localStorage.setItem('weekwise-reminder-nudge-v1',today);}catch(_){}showToast(due.length===1?'You have 1 reminder due. Open More → Reminders & sticky notes.':'You have '+due.length+' reminders due. Open More → Reminders & sticky notes.');}


function cloudFingerprint(payload){return JSON.stringify(payload);}
function buildCloudPayload(){let view='week';try{const v=localStorage.getItem('weekwise-calendar-view-v1');if(['day','week','month','agenda','year'].includes(v))view=v;}catch(_){}return {version:1,store:store,reminders:reminders,focusSessions:focusSessions,habits:habits,countdowns:countdowns,savedTaskFilters:savedTaskFilters,taskTemplates:taskTemplates,calendarView:view};}
function localHasWeekwiseData(){const hasActivities=Object.values(store.weeks||{}).some(w=>Array.isArray(w&&w.tasks)&&w.tasks.length>0);const hasNotes=Array.isArray(reminders)&&reminders.length>0;const hasHabits=Array.isArray(habits)&&habits.length>0;const hasCountdowns=Array.isArray(countdowns)&&countdowns.length>0;const hasFilters=Array.isArray(savedTaskFilters)&&savedTaskFilters.length>0;const hasCustomLists=Array.isArray(store.customLists)&&store.customLists.length>0;let settingsChanged=false;try{settingsChanged=JSON.stringify(store.settings)!==JSON.stringify(defaultSettings());}catch(_){}return hasActivities||hasNotes||hasHabits||hasCountdowns||hasFilters||hasCustomLists||(Array.isArray(taskTemplates)&&taskTemplates.length>0)||settingsChanged;}
function readCloudMeta(){try{return JSON.parse(localStorage.getItem(CLOUD_META_KEY)||'null');}catch(_){return null;}}
function writeCloudMeta(revision,payload){localStorage.setItem(CLOUD_META_KEY,JSON.stringify({userId:cloudUser?.id||'',revision:Number(revision)||0,fingerprint:cloudFingerprint(payload),syncedAt:new Date().toISOString()}));}
function setCloudStatus(message){const el=$('cloudStatus');if(el){el.textContent=message;const m=String(message||'').toLowerCase();el.dataset.tone=/fail|error|invalid|not confirmed|could not|rejected|unable/.test(m)?'error':/synced|success|sent|created|updated|signed out/.test(m)?'success':/signing|creating|sending|checking|syncing|saving|loading/.test(m)?'loading':'';}const badge=$('cloudMenuBadge');if(badge){badge.textContent=WeekwiseData.syncLabel(message,!!cloudUser,!!cloudConflict);badge.title=message;}}
function renderCloudPanel(){
 const form=$('cloudAuthForm'),signed=$('cloudSignedIn'),email=$('cloudUserEmail'),conflict=$('cloudConflict');
 const recovery=cloudAuthMode==='recovery';
 if(form)form.hidden=!!cloudUser&&!recovery;
 if(signed)signed.hidden=!cloudUser||recovery;
 if(email)email.textContent=cloudUser?.email||'';
 if(conflict)conflict.hidden=!cloudConflict;
 if(!cloudClient)setCloudStatus('Cloud sign-in is unavailable because the Supabase library did not load. Local planning still works.');
 else if(!cloudUser)setCloudStatus('Weekwise is using this browser only. Sign in to sync schedules across devices.');
 if(cloudConflict)setCloudStatus('Sync paused to protect both versions. Choose which copy to keep.');
}
function validateCloudPayload(payload){
 if(!payload||!payload.store)throw new Error('The cloud planner snapshot is incomplete.');WeekwiseData.validateStore(payload.store);
 for(const name of ['reminders','focusSessions','habits','countdowns','savedTaskFilters','taskTemplates'])if(payload[name]!==undefined)WeekwiseData.validateCollection(payload[name],name);
 return payload;
}
function saveCloudLocalPayload(payload){
 if(localStorage.getItem(STORE_KEY)!==lastSavedDisk)throw new Error('Another tab has local changes. Reload this tab before downloading cloud data.');
 if(plannerStorageBlocked||WeekwiseData.blockedKeys().length)throw new Error('Stored data needs recovery before cloud changes can be applied.');
 const safe=JSON.parse(JSON.stringify(validateCloudPayload(payload)));
 safe.store.settings={...defaultSettings(),...safe.store.settings};safe.store.customLists=safe.store.customLists||[];safe.store.recurringTemplates=safe.store.recurringTemplates||[];
 const pairs=[['reminders',REMINDERS_KEY],['focusSessions',FOCUS_SESSIONS_KEY],['habits',HABITS_KEY],['countdowns',COUNTDOWNS_KEY],['savedTaskFilters',TASK_FILTERS_KEY],['taskTemplates',TASK_TEMPLATES_KEY]];
 const entries=[[STORE_KEY,JSON.stringify(safe.store)],...pairs.filter(([name])=>Array.isArray(safe[name])).map(([name,key])=>[key,JSON.stringify(safe[name])])];
 if(['day','week','month','agenda','year'].includes(safe.calendarView))entries.push(['weekwise-calendar-view-v1',safe.calendarView]);
 WeekwiseData.commitStorage(localStorage,entries,'weekwise-pre-cloud-v1');
 cloudApplyingRemote=true;
 try{
  store=safe.store;lastSavedStore=JSON.stringify(store);lastSavedDisk=localStorage.getItem(STORE_KEY);
  if(safe.reminders)reminders=safe.reminders;if(safe.focusSessions)focusSessions=safe.focusSessions;if(safe.habits)habits=safe.habits;if(safe.countdowns)countdowns=safe.countdowns;if(safe.savedTaskFilters)savedTaskFilters=safe.savedTaskFilters;if(safe.taskTemplates)taskTemplates=safe.taskTemplates;
  syncWorkspaceLists();currentWeek=dateKey(sundayOf(now));mobileDay=now.getDay();monthAnchor=new Date(now.getFullYear(),now.getMonth(),1);loadWeek(currentWeek);renderReminders();
 }finally{cloudApplyingRemote=false;}
}
function isolatePlannerOwner(nextOwner){
 if(currentDataOwner===nextOwner)return;
 const previousOwner=currentDataOwner,payload=JSON.parse(JSON.stringify(buildCloudPayload()));
 if(focusState?.owner===previousOwner){focusState=WeekwiseFocus.pause(focusState);WeekwiseData.commitStorage(localStorage,[['weekwise-focus-active-v1:'+previousOwner,JSON.stringify(focusState)]]);}
 checkpointEditorDraft();
 localStorage.setItem('weekwise-account-cache-v1:'+previousOwner,JSON.stringify({payload,meta:readCloudMeta()}));
 closeTaskModal(true);
 // First-time local capture belongs to the account the user deliberately signs into.
 if(previousOwner==='local'&&nextOwner!=='local'&&!readCloudMeta()?.userId&&Object.values(payload.store.weeks).some(w=>w.tasks?.length)&&confirm('Use your device-only planner with this account? Cancel keeps it separate on this device.')){currentDataOwner=nextOwner;return;}
 const cached=WeekwiseData.readJSON(localStorage,'weekwise-account-cache-v1:'+nextOwner,value=>{validateCloudPayload(value.payload);return value;},null);
 if(WeekwiseData.blockedKeys().length)throw new Error('This account cache needs recovery. Export the original data before continuing.');
 const next=cached?.payload||{version:1,store:{settings:defaultSettings(),weeks:{},recurringTemplates:[],customLists:[]},reminders:[],focusSessions:[],habits:[],countdowns:[],savedTaskFilters:[],taskTemplates:[]};
 for(const name of ['reminders','focusSessions','habits','countdowns','savedTaskFilters','taskTemplates'])if(!Array.isArray(next[name]))next[name]=[];
 saveCloudLocalPayload(next);currentDataOwner=nextOwner;
 localStorage.setItem(CLOUD_META_KEY,JSON.stringify(cached?.meta||{userId:nextOwner==='local'?'':nextOwner,revision:0,fingerprint:cloudFingerprint(buildCloudPayload())}));
 focusState=null;
}
async function requestCloudSave(payload,revision,userId){return WeekwiseCloudTransport.save({client:cloudClient,url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY,userId,payload,revision});}
function applyCloudRow(row){
 saveCloudLocalPayload(row.data||{});
 cloudRevision=Number(row.revision)||0;cloudReady=true;cloudConflict=null;
 writeCloudMeta(cloudRevision,buildCloudPayload());
 renderCloudPanel();
 setCloudStatus('All changes synced. Last saved '+new Date(row.updated_at||Date.now()).toLocaleString()+'.');
}
function showCloudConflict(row){
 cloudConflict=row;cloudRevision=Number(row?.revision)||0;
 renderCloudPanel();
 setCloudStatus('Both this device and the cloud have changes. Choose which version to keep.');
}
function queueCloudSave(){
 if(localStorage.getItem(STORE_KEY)!==lastSavedDisk||['weekwise-reminders-v1','weekwise-focus-sessions-v1','weekwise-habits-v1','weekwise-countdowns-v1','weekwise-saved-filters-v1','weekwise-task-templates-v1'].some(key=>WeekwiseData.unchanged?.(localStorage,key)===false)){setCloudStatus('Another tab changed this planner. Reload before syncing.');return;}
 if(plannerStorageBlocked||WeekwiseData.blockedKeys().length||!cloudClient||!cloudUser||!cloudReady||cloudApplyingRemote||cloudConflict)return;
 const meta=readCloudMeta();if(meta?.userId===cloudUser.id&&meta.fingerprint===cloudFingerprint(buildCloudPayload())){if(cloudSyncTimer){clearTimeout(cloudSyncTimer);cloudSyncTimer=null;}return;}
 if(cloudSyncTimer)clearTimeout(cloudSyncTimer);
 setCloudStatus('Changes saved on this device. Syncing to cloud…');
 cloudSyncTimer=setTimeout(()=>{cloudSyncTimer=null;saveCloudSnapshot();},900);
}
async function saveCloudSnapshot(){
 if(localStorage.getItem(STORE_KEY)!==lastSavedDisk||['weekwise-reminders-v1','weekwise-focus-sessions-v1','weekwise-habits-v1','weekwise-countdowns-v1','weekwise-saved-filters-v1','weekwise-task-templates-v1'].some(key=>WeekwiseData.unchanged?.(localStorage,key)===false)){setCloudStatus('Another tab changed this planner. Reload before syncing.');return;}
 if(plannerStorageBlocked||WeekwiseData.blockedKeys().length||!cloudClient||!cloudUser||!cloudReady||cloudApplyingRemote||cloudConflict||cloudBusy)return;
 cloudBusy=true;
 const payload=JSON.parse(JSON.stringify(buildCloudPayload())),expectedRevision=cloudRevision,savingUserId=cloudUser.id,savingEpoch=cloudSessionEpoch;
 let savedPayload=null;
 try{
  const {data,error}=await requestCloudSave(payload,expectedRevision,savingUserId);
  if(savingEpoch!==cloudSessionEpoch||cloudUser?.id!==savingUserId)return;
  if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;
  if(!result)throw new Error('The cloud returned no save result.');
  if(!result.saved){showCloudConflict({data:result.data||{},revision:Number(result.revision)||0,updated_at:result.updated_at||null});return;}
  cloudRevision=Number(result.revision)||expectedRevision+1;cloudReady=true;
  writeCloudMeta(cloudRevision,payload);
  savedPayload=payload;
  setCloudStatus('All changes synced · '+new Date(result.updated_at||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
  const badge=$('cloudMenuBadge');if(badge)badge.textContent='Synced';
 }catch(error){
  if(savingEpoch!==cloudSessionEpoch||cloudUser?.id!==savingUserId)return;
  console.warn('Weekwise cloud save could not be confirmed.');
  setCloudStatus('Cloud save failed. Your changes remain on this device. Open Cloud sync and try Sync now. '+(error?.message||''));
 }finally{
  cloudBusy=false;
  // Recheck only after releasing the save lock. A timer may have fired while the
  // previous request was still in flight, so schedule again if newer edits exist.
  if(savedPayload&&cloudUser&&cloudReady&&!cloudConflict&&cloudFingerprint(buildCloudPayload())!==cloudFingerprint(savedPayload))queueCloudSave();
  if(savingEpoch!==cloudSessionEpoch&&cloudUser&&cloudReady&&!cloudConflict)queueCloudSave();
 }
}
async function startCloudForUser(user,force=false){
 if(plannerStorageBlocked||WeekwiseData.blockedKeys().length){setCloudStatus('Cloud sync paused: stored data needs recovery.');return;}
 if(!cloudClient||!user)return;
 if(cloudUser?.id===user.id&&currentDataOwner===user.id&&cloudReady&&!force)return;
 const epoch=cloudSessionEpoch,userId=user.id;
 const initializing=(async()=>{
  cloudUser=user;cloudReady=false;cloudConflict=null;
  try{
   isolatePlannerOwner(userId);renderCloudPanel();setCloudStatus('Checking your cloud data…');
   const {data:row,error}=await cloudClient.from('weekwise_cloud_data').select('user_id,data,revision,updated_at').eq('user_id',userId).maybeSingle();
   if(epoch!==cloudSessionEpoch||cloudUser?.id!==userId)return;if(error)throw error;
   const payload=buildCloudPayload(),meta=readCloudMeta(),localFingerprint=cloudFingerprint(payload),hasLocal=localHasWeekwiseData();
   if(!row){cloudRevision=0;cloudReady=true;await saveCloudSnapshot();return;}
   validateCloudPayload(row.data);cloudReady=true;cloudRevision=Number(row.revision)||0;
   if(meta?.userId===userId){
    const localDirty=localFingerprint!==meta.fingerprint,remoteChanged=Number(row.revision)>Number(meta.revision||0);
    if(localDirty&&remoteChanged){showCloudConflict(row);return;}
    if(localDirty){queueCloudSave();return;}
    applyCloudRow(row);return;
   }
   if(!hasLocal){applyCloudRow(row);return;}showCloudConflict(row);
  }catch(error){if(epoch!==cloudSessionEpoch||cloudUser?.id!==userId)return;cloudReady=false;setCloudStatus('Cloud sync could not be initialized. Your data is preserved on this device. '+error.message);renderCloudPanel();}
 })();
 cloudInitializationUser=userId;cloudInitPromise=initializing;
 try{await initializing;}finally{if(cloudInitPromise===initializing){cloudInitPromise=null;cloudInitializationUser=null;}}
 if(epoch===cloudSessionEpoch&&cloudUser?.id===userId&&currentDataOwner===userId)finishSignInLanding();
}
async function initializeCloud(){
 setCloudAuthMode('signin',false);
 const gate=$('signinLanding');if(gate){gate.hidden=false;document.body.classList.add('signin-required');window.signinGateInFlow=false;}
 if(!cloudClient){if(localStorage.getItem('weekwise-local-mode-v1')==='true'&&currentDataOwner==='local')finishSignInLanding();renderCloudPanel();setCloudStatus('Cloud library unavailable. Weekwise still saves locally. Check your internet connection and reload to enable cloud sync.');return;}
 try{
  // Subscribe before reading the session so auth redirects such as password recovery are not missed.
  cloudClient.auth.onAuthStateChange((event,session)=>{
   if(session?.user?.id!==cloudUser?.id||event==='SIGNED_OUT'){cloudSessionEpoch++;cloudReady=false;if(cloudSyncTimer)clearTimeout(cloudSyncTimer);$('signinLanding').hidden=false;document.body.classList.add('signin-required');}
   setTimeout(async()=>{
    if(event==='PASSWORD_RECOVERY'&&session?.user){await startCloudForUser(session.user);cloudUser=session.user;const gate=$('signinLanding');if(gate){gate.hidden=true;document.body.classList.remove('signin-required');}setCloudAuthMode('recovery');openCloudPanel();return;}
    if(session?.user)startCloudForUser(session.user).catch(()=>{});
    else{if(activeUtilityPanel===$('cloudPanel'))closeUtilityPanel(false);try{isolatePlannerOwner('local');}catch(error){setCloudStatus('Account data could not be isolated: '+error.message);return;}cloudUser=null;cloudReady=false;cloudRevision=0;cloudConflict=null;if(cloudSyncTimer)clearTimeout(cloudSyncTimer);renderCloudPanel();setCloudStatus('Signed out. Your schedules remain saved on this device.');$('signinLanding').hidden=false;document.body.classList.add('signin-required');window.signinGateInFlow=false;}
   },0);
  });
  const {data:{session}}=await cloudClient.auth.getSession();
  if(session?.user)await startCloudForUser(session.user);else if(localStorage.getItem('weekwise-local-mode-v1')==='true'&&currentDataOwner==='local')finishSignInLanding();
 }catch(error){console.error(error);setCloudStatus('Could not check cloud sign-in. Local planning still works.');}
}

let cloudAuthMode='signin',cloudAuthBusy=false;
function setCloudAuthMode(mode,resetStatus=true){
 cloudAuthMode=['signin','signup','recovery'].includes(mode)?mode:'signin';
 const signup=cloudAuthMode==='signup',recovery=cloudAuthMode==='recovery';
 const signInTab=$('cloudSignInMode'),signUpTab=$('cloudSignUpBtn'),tabs=document.querySelector('.cloud-auth-tabs');
 if(signInTab){signInTab.classList.toggle('active',cloudAuthMode==='signin');signInTab.setAttribute('aria-selected',cloudAuthMode==='signin'?'true':'false');}
 if(signUpTab){signUpTab.classList.toggle('active',signup);signUpTab.setAttribute('aria-selected',signup?'true':'false');}
 if(tabs)tabs.hidden=recovery;
 $('cloudAuthIntro').textContent=recovery?'Choose a new password for your Weekwise account.':signup?'Create one account to access the same schedules and reminders on all your devices.':'Sign in to keep your Weekwise schedule synced across your devices.';
 $('cloudSignInBtn').textContent=recovery?'Update password':signup?'Create account':'Sign in';
 $('cloudPasswordLabel').textContent=recovery?'New password':'Password';
 $('cloudPassword').placeholder=recovery?'Choose a new password':signup?'At least 8 characters':'Enter your password';
 $('cloudPassword').autocomplete=signup||recovery?'new-password':'current-password';
 $('cloudConfirmPasswordWrap').hidden=!(signup||recovery);
 $('cloudConfirmPassword').required=signup||recovery;
 $('cloudReferralCodeWrap').hidden=!signup;
 $('cloudReferralCode').required=signup;
 if(!signup)$('cloudReferralCode').value='';
 $('cloudConfirmPassword').autocomplete='new-password';
 $('cloudForgotPassword').hidden=signup||recovery;
 $('cloudPasswordHint').textContent=recovery?'Use at least 8 characters.':signup?'A referral code and a password of at least 8 characters are required.':'Use your Weekwise account details.';
 if(!signup&&!recovery)$('cloudConfirmPassword').value='';
 if(resetStatus)setCloudStatus(recovery?'Enter and confirm your new password.':signup?'Create a Weekwise account with your email.':'Sign in to sync schedules across devices.');
 renderCloudPanel();
}
function setCloudAuthBusy(busy){
 cloudAuthBusy=busy;
 ['cloudEmail','cloudPassword','cloudConfirmPassword','cloudReferralCode','cloudSignInBtn','cloudSignUpBtn','cloudSignInMode','cloudForgotPassword','cloudTogglePassword'].forEach(id=>{const el=$(id);if(el)el.disabled=busy;});
 const button=$('cloudSignInBtn');
 if(button&&busy){button.dataset.previousLabel=button.textContent;button.textContent=cloudAuthMode==='signup'?'Creating account…':cloudAuthMode==='recovery'?'Updating password…':'Signing in…';}
 else if(button&&!busy){button.textContent=cloudAuthMode==='signup'?'Create account':cloudAuthMode==='recovery'?'Update password':'Sign in';}
}
function validateCloudPassword(){
 const password=$('cloudPassword').value,confirmation=$('cloudConfirmPassword').value;
 if(password.length<8){setCloudStatus('Use a password with at least 8 characters.');$('cloudPassword').focus();return false;}
 if((cloudAuthMode==='signup'||cloudAuthMode==='recovery')&&password!==confirmation){setCloudStatus('The passwords do not match. Please check both fields.');$('cloudConfirmPassword').focus();return false;}
 return true;
}
async function cloudSignIn(){
 if(!cloudClient){setCloudStatus('Cloud library unavailable. Your local schedules are still saved.');return;}
 const email=$('cloudEmail').value.trim(),password=$('cloudPassword').value;
 if(!email||!password){$('cloudAuthForm').reportValidity();return;}
 setCloudAuthBusy(true);setCloudStatus('Signing in…');
 try{
  const {data,error}=await cloudClient.auth.signInWithPassword({email,password});
  if(error){
   const message=error.message||'Please try again.';
   if(/email not confirmed/i.test(message))setCloudStatus('Your email is not confirmed yet. Open the confirmation email from Supabase, then return and sign in.');
   else if(/invalid login credentials/i.test(message))setCloudStatus('Email or password is incorrect. Check your details or use Forgot password.');
   else setCloudStatus('Sign-in failed: '+message);
   return;
  }
  if(data?.user){cloudUser=data.user;await startCloudForUser(data.user,true);}
 }catch(error){setCloudStatus('Could not sign in: '+(error?.message||'Please try again.'));}
 finally{setCloudAuthBusy(false);}
}
async function cloudSignUp(){
 if(!cloudClient){setCloudStatus('Cloud library unavailable. Your local schedules are still saved.');return;}
 const email=$('cloudEmail').value.trim();
 const referralCode=$('cloudReferralCode').value.trim().toUpperCase();
 if(!email||!referralCode){$('cloudAuthForm').reportValidity();if(!referralCode){setCloudStatus('A referral code from the Weekwise owner is required to create an account.');$('cloudReferralCode').focus();}return;}
 if(!validateCloudPassword())return;
 setCloudAuthBusy(true);setCloudStatus('Checking invite and creating your Weekwise account…');
 try{
  const {data,error}=await cloudClient.auth.signUp({email,password:$('cloudPassword').value,options:{emailRedirectTo:location.origin+location.pathname,data:{weekwise_referral_code:referralCode}}});
  if(error){setCloudStatus('Account creation failed: '+(error.message||'Check your referral code and try again.'));return;}
  $('cloudReferralCode').value='';
  if(data?.session&&data?.user){
   cloudUser=data.user;await startCloudForUser(data.user,true);if(cloudReady)setCloudStatus('Account created and cloud sync is ready.');
  }else{
   setCloudStatus('Account created. Check your inbox and spam folder for the confirmation link, then return here to sign in. If the link fails, add the Weekwise site address to Supabase Authentication → URL Configuration.');
   setCloudAuthMode('signin',false);
  }
 }catch(error){setCloudStatus('Could not create your account: '+(error?.message||'Please try again.'));}
 finally{setCloudAuthBusy(false);}
}
async function cloudResetPassword(){
 if(!cloudClient){setCloudStatus('Cloud library unavailable.');return;}
 const email=$('cloudEmail').value.trim();
 if(!email){setCloudStatus('Enter your email address first, then choose Forgot password.');$('cloudEmail').focus();return;}
 setCloudAuthBusy(true);setCloudStatus('Sending password-reset link…');
 try{
  const {error}=await cloudClient.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(error)throw error;
  setCloudStatus('Password-reset email sent if that account exists. Check your inbox and spam folder.');
 }catch(error){setCloudStatus('Could not send reset email: '+(error?.message||'Please try again.'));}
 finally{setCloudAuthBusy(false);}
}
async function cloudUpdatePassword(){
 if(!cloudClient||!cloudUser){setCloudStatus('Open the password-reset link from your email again to continue.');return;}
 if(!validateCloudPassword())return;
 setCloudAuthBusy(true);setCloudStatus('Updating your password…');
 try{
  const {error}=await cloudClient.auth.updateUser({password:$('cloudPassword').value});
  if(error)throw error;
  $('cloudPassword').value='';$('cloudConfirmPassword').value='';
  setCloudAuthMode('signin',false);setCloudStatus('Password updated successfully.');
  renderCloudPanel();
 }catch(error){setCloudStatus('Could not update password: '+(error?.message||'Please try again.'));}
 finally{setCloudAuthBusy(false);}
}
async function submitCloudAuth(){
 if(cloudAuthBusy)return;
 if(cloudAuthMode==='signup')return cloudSignUp();
 if(cloudAuthMode==='recovery')return cloudUpdatePassword();
 return cloudSignIn();
}
function wireCloudAuthControls(){
 $('cloudSignInMode').addEventListener('click',()=>setCloudAuthMode('signin'));
 $('cloudSignUpBtn').addEventListener('click',()=>setCloudAuthMode('signup'));
 $('cloudForgotPassword').addEventListener('click',cloudResetPassword);
 $('cloudTogglePassword').addEventListener('click',()=>{
  const input=$('cloudPassword'),show=input.type==='password';input.type=show?'text':'password';
  $('cloudTogglePassword').textContent=show?'Hide':'Show';
  $('cloudTogglePassword').setAttribute('aria-label',show?'Hide password':'Show password');
  $('cloudTogglePassword').setAttribute('aria-pressed',show?'true':'false');
 });
 $('cloudConfirmPassword').addEventListener('input',()=>{
  const input=$('cloudConfirmPassword');
  input.setCustomValidity(input.value&&input.value!==$('cloudPassword').value?'Passwords do not match.':'');
 });
 $('cloudPassword').addEventListener('input',()=>{
  const input=$('cloudConfirmPassword');
  if(input.value)input.setCustomValidity(input.value!==$('cloudPassword').value?'Passwords do not match.':'');
 });
 $('cloudAuthForm').addEventListener('submit',e=>{e.preventDefault();submitCloudAuth();});
}

async function cloudUseRemote(){
 if(!cloudConflict)return;
 const row=cloudConflict;cloudConflict=null;applyCloudRow(row);
}
async function cloudUseLocal(){
 if(!cloudConflict||!cloudUser)return;
 if(!confirm('Replace the cloud copy with the planner saved on this device? This cannot be automatically undone. Export a backup first if you need both versions.'))return;
 const row=cloudConflict;cloudConflict=null;cloudRevision=Number(row.revision)||0;cloudReady=true;
 await saveCloudSnapshot();renderCloudPanel();
}
async function cloudSyncNow(){
 if(!cloudUser){openUtilityPanel('cloudPanel','Cloud sync & account');setCloudStatus('Sign in to sync your schedules.');return;}
 if(cloudConflict){renderCloudPanel();setCloudStatus('Choose which version to keep before syncing.');return;}
 if(!cloudReady){await startCloudForUser(cloudUser,true);return;}
 await saveCloudSnapshot();
}
async function checkCloudForRemoteChanges(){
 if(!cloudClient||!cloudUser||!cloudReady||cloudBusy||cloudConflict||document.hidden)return;
 try{
  const readUser=cloudUser.id,readEpoch=cloudSessionEpoch;const {data:row,error}=await cloudClient.from('weekwise_cloud_data').select('user_id,data,revision,updated_at').eq('user_id',readUser).maybeSingle();
  if(readEpoch!==cloudSessionEpoch||cloudUser?.id!==readUser)return;if(error)throw error;if(!row||Number(row.revision)<=cloudRevision)return;
  const meta=readCloudMeta(),localFingerprint=cloudFingerprint(buildCloudPayload()),localDirty=meta?.userId===cloudUser.id&&localFingerprint!==meta.fingerprint;
  if(localDirty)showCloudConflict(row);else applyCloudRow(row);
 }catch(error){console.warn('Could not check cloud for updates',error);}
}
function openCloudPanel(){renderCloudPanel();openUtilityPanel('cloudPanel','Cloud sync & account');}
function openSignInFromLanding(){const gate=$('signinLanding');if(gate){gate.hidden=true;document.body.classList.remove('signin-required');window.signinGateInFlow=true;}openCloudPanel();}
function finishSignInLanding(){const gate=$('signinLanding');if(!gate)return;if(activeUtilityPanel===$('cloudPanel'))closeUtilityPanel(false);gate.hidden=true;document.body.classList.remove('signin-required');window.signinGateInFlow=false;now=new Date();mobileDay=now.getDay();currentWeek=dateKey(sundayOf(now));monthAnchor=new Date(now.getFullYear(),now.getMonth(),1);loadWeek(currentWeek);setWorkspaceView('today');restoreFocusState();renderReminders();const heading=$('calendarInstruction');if(heading)heading.hidden=true;showToast('Welcome to Weekwise. Here is today’s plan.');}

function exportEditorHistory(){
 try{
  const archive=WeekwiseDrafts.exportHistory(localStorage,currentDataOwner);
  if(!archive.entries.length){showToast('No editor drafts or archived drafts are saved for this planner on this device.');return;}
  const filename='weekwise-editor-history-'+dateKey(now)+'.json';
  const blob=new Blob([JSON.stringify(archive,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast('Exported '+archive.entries.length+' editor history '+(archive.entries.length===1?'record':'records')+'. Keep the file private.');
 }catch(error){showToast(error.message||'Could not export editor history. Existing drafts were preserved.');}
}
function exportBackup(){if(plannerStorageBlocked||WeekwiseData.blockedKeys().length){showToast('Download the original data from the recovery notice before restoring.');return;}const payload={...store,app:'Weekwise',version:6,exportedAt:new Date().toISOString(),settings:store.settings,weeks:store.weeks,recurringTemplates:store.recurringTemplates||[],customLists:store.customLists||[],reminders,focusSessions,habits,countdowns,savedTaskFilters,taskTemplates};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`weekwise-backup-${currentWeek}.json`;a.click();URL.revokeObjectURL(url);showToast('Backup exported');}
async function loadImport(file){
 try{
  if(file.size>WeekwiseData.MAX_BACKUP_BYTES)throw new Error('Backup must be smaller than 10 MB.');
  const data=WeekwiseData.parseBackup(await file.text());
  const count=Object.values(data.weeks).reduce((sum,week)=>sum+week.tasks.length,0);
  if(!confirm('Restore this backup with '+count+' tasks? It replaces the planner on this device and, when synced, your cloud copy. A local recovery checkpoint will be kept. Export a backup first if you need a separate copy.'))return;
  const restored=WeekwiseData.storeFromBackup(data);
  const collections=[['reminders',REMINDERS_KEY],['focusSessions',FOCUS_SESSIONS_KEY],['habits',HABITS_KEY],['countdowns',COUNTDOWNS_KEY],['savedTaskFilters',TASK_FILTERS_KEY],['taskTemplates',TASK_TEMPLATES_KEY]];
  const entries=[[STORE_KEY,JSON.stringify(restored)],...collections.filter(([name])=>Array.isArray(data[name])).map(([name,key])=>[key,JSON.stringify(data[name])])];
  WeekwiseData.commitStorage(localStorage,entries,'weekwise-pre-restore-v1');
  WeekwiseData.clearBlocked(entries.map(([key])=>key));plannerStorageBlocked=false;plannerStorageError='';store=restored;lastSavedStore=JSON.stringify(store);lastSavedDisk=localStorage.getItem(STORE_KEY);
  if(Array.isArray(data.reminders))reminders=data.reminders;
  if(Array.isArray(data.focusSessions))focusSessions=data.focusSessions;
  if(Array.isArray(data.habits))habits=data.habits;
  if(Array.isArray(data.countdowns))countdowns=data.countdowns;
  if(Array.isArray(data.savedTaskFilters))savedTaskFilters=data.savedTaskFilters;
  if(Array.isArray(data.taskTemplates))taskTemplates=data.taskTemplates;
  store.settings={...defaultSettings(),...store.settings};
  syncWorkspaceLists();loadWeek(currentWeek);renderReminders();renderHabitTracker();renderCountdowns();renderTaskTemplateOptions();
  $('storageRecoveryNotice')?.remove();queueCloudSave();showToast('Backup restored. A pre-restore recovery checkpoint is kept on this device.');
 }catch(e){showToast(e.message||'That file does not look like a Weekwise backup.');}
}
function showStorageRecoveryNotice(){
 if($('storageRecoveryNotice'))return;
 if(!plannerStorageBlocked&&!WeekwiseData.blockedKeys().length)return;
 const banner=document.createElement('aside');banner.id='storageRecoveryNotice';banner.setAttribute('role','alert');
 banner.style.cssText='position:fixed;z-index:5000;bottom:16px;left:16px;right:16px;padding:16px;background:#fff3df;color:#382a15;border:2px solid #976519;border-radius:12px';
 const message=document.createElement('p');message.textContent='Your stored planner could not be read. Saving and cloud sync are paused to protect it. '+plannerStorageError+' Affected collections: '+WeekwiseData.blockedKeys().map(key=>key.replace('weekwise-','')).join(', ')+'. Download the original data before restoring a valid backup from More → Import backup.';
 const button=document.createElement('button');button.className='btn';button.textContent='Download original local data';
 button.onclick=()=>{const raw=JSON.stringify(Object.fromEntries([STORE_KEY,'weekwise-planner-v1',...WeekwiseData.blockedKeys()].map(key=>[key,localStorage.getItem(key)])),null,2);const url=URL.createObjectURL(new Blob([raw],{type:'text/plain'}));const link=document.createElement('a');link.href=url;link.download='weekwise-recovery-original.txt';link.click();URL.revokeObjectURL(url);};
 banner.append(message,button);document.body.append(banner);
}
function shiftWeeks(n){const d=parseKey(currentWeek);d.setDate(d.getDate()+7*n);saveCurrent();loadWeek(dateKey(d));}
function setCalendarView(view){if(view!=='day'&&view!=='week')return;if(calendarView===view)return;calendarView=view;try{localStorage.setItem('weekwise-calendar-view-v1',view);}catch(_){}renderAll();}
function updateViewControls(){const dayBtn=$('dayViewBtn'),weekBtn=$('weekViewBtn');if(dayBtn){dayBtn.classList.toggle('active',calendarView==='day');dayBtn.setAttribute('aria-pressed',calendarView==='day'?'true':'false');}if(weekBtn){weekBtn.classList.toggle('active',calendarView==='week');weekBtn.setAttribute('aria-pressed',calendarView==='week'?'true':'false');}const prev=$('prevWeek'),next=$('nextWeek');if(prev){prev.title=calendarView==='day'?'Previous day':'Previous week';prev.setAttribute('aria-label',prev.title);}if(next){next.title=calendarView==='day'?'Next day':'Next week';next.setAttribute('aria-label',next.title);}}
function shiftPeriod(n){if(calendarView!=='day'){shiftWeeks(n);return;}const d=dayDate(currentWeek,mobileDay);d.setDate(d.getDate()+n);saveCurrent();mobileDay=d.getDay();loadWeek(dateKey(sundayOf(d)));}
function addQuick(e){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}e.preventDefault();const title=$('quickTitle').value.trim();if(!title)return;if(!validateTimeFields(['quickTime']))return;const day=Number($('quickDay').value),type=$('quickType').value,duration=Number($('quickDuration').value),preferred=timeMins($('quickTime').value||'10:00');createTask(day,title,type,duration,preferred,{min:0,max:1440,custom:true});const t=tasks[tasks.length-1];t.unscheduled=t.start===null;saveCurrent();renderAll();$('quickTitle').value='';showToast(t.start===null?'Added to the day, but needs a time':'Activity added to your week');}
function setup(){syncWorkspaceLists();populateDaySelects();syncSettingsForm();setupSystemThemeListener();wireTime24Fields();wireWorkspaceControls();wireCountdownControls();$('weekStart').value=currentWeek;loadWeek(currentWeek);setupDragDrop();$('signinLandingContinue').addEventListener('click',openSignInFromLanding);$('dayViewBtn').addEventListener('click',()=>setCalendarView('day'));$('weekViewBtn').addEventListener('click',()=>setCalendarView('week'));$('monthViewBtn').addEventListener('click',()=>setCalendarView('month'));$('agendaViewBtn').addEventListener('click',()=>setCalendarView('agenda'));$('yearViewBtn').addEventListener('click',()=>setCalendarView('year'));$('prevWeek').addEventListener('click',()=>shiftPeriod(-1));$('nextWeek').addEventListener('click',()=>shiftPeriod(1));$('thisWeek').addEventListener('click',()=>{
 saveCurrent();
 now=new Date();mobileDay=now.getDay();currentWeek=dateKey(sundayOf(now));
 monthAnchor=new Date(now.getFullYear(),now.getMonth(),1);
 agendaAnchor=dateOnly(now);calendarYear=now.getFullYear();
 weekwiseAnimateCalendar();loadWeek(currentWeek);
});$('menuSettingsBtn').addEventListener('click',()=>openUtilityPanel('settingsPanel','Work day & weekly settings'));$('menuQuickAddBtn').addEventListener('click',()=>openUtilityPanel('quickAddDetails','Quick add activity'));$('menuHabitsBtn').addEventListener('click',()=>openUtilityPanel('routineDetails','Habits & focus tips'));$('dashboardMenuBtn').addEventListener('click',openDashboard);$('remindersMenuBtn').addEventListener('click',openReminders);$('cloudMenuBtn').addEventListener('click',openCloudPanel);wireCloudAuthControls();$('cloudSyncNow').addEventListener('click',cloudSyncNow);$('cloudSignOut').addEventListener('click',async()=>{if(cloudClient)await cloudClient.auth.signOut();});$('cloudUseRemote').addEventListener('click',cloudUseRemote);$('cloudUseLocal').addEventListener('click',cloudUseLocal);$('reminderForm').addEventListener('submit',reminderSave);$('cancelReminderEdit').addEventListener('click',reminderFormReset);$('reminderFilter').addEventListener('change',renderReminders);document.querySelectorAll('[data-template-editor]').forEach(card=>{const activate=()=>openTemplateEditor(card.dataset.templateEditor);card.addEventListener('click',activate);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});});$('closeTemplate').addEventListener('click',closeTemplateEditor);$('cancelTemplate').addEventListener('click',closeTemplateEditor);$('templateForm').addEventListener('submit',saveTemplateEditor);$('templateModal').addEventListener('click',e=>{if(e.target===$('templateModal'))closeTemplateEditor();});$('closeUtility').addEventListener('click',()=>closeUtilityPanel());$('utilityModal').addEventListener('click',e=>{if(e.target===$('utilityModal'))closeUtilityPanel();});$('applySettings').addEventListener('click',applySettings);$('themeMode').addEventListener('change',()=>{store.settings.theme=$('themeMode').value;applyThemePreference(store.settings.theme);saveStore();showToast('Appearance saved');});$('cancelSettings').addEventListener('click',()=>{syncSettingsForm();closeUtilityPanel();});$('saveDestination').addEventListener('click',saveTripDestination);$('tripDestination').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveTripDestination();}});$('addTaskBtn').addEventListener('click',()=>openTaskModal(null,mobileDay,nextQuarterHour()));$('remindersQuickBtn').addEventListener('click',openReminders);$('exportCalendarBtn').addEventListener('click',exportCalendarICS);$('importCalendarBtn').addEventListener('click',()=>$('calendarImportFile').click());$('calendarImportFile').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importCalendarICS(file).catch(error=>showToast('Could not import calendar file: '+(error?.message||'invalid iCalendar file'))).finally(()=>{e.target.value='';});});$('activitySuggestions').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();hideActivitySuggestions();$('modalTitleInput').focus();}});$('modalTitleInput').addEventListener('focus',()=>{if(suppressActivitySuggestionFocus){suppressActivitySuggestionFocus=false;return;}renderActivitySuggestions($('modalTitleInput').value);});$('modalTitleInput').addEventListener('click',()=>renderActivitySuggestions($('modalTitleInput').value));$('modalTitleInput').addEventListener('input',()=>{selectedActivitySuggestion=null;renderActivitySuggestions($('modalTitleInput').value);});$('modalTitleInput').addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&!$('activitySuggestions').hidden){const first=$('activitySuggestions').querySelector('button');if(first){e.preventDefault();first.focus();}}if(e.key==='Escape')hideActivitySuggestions();});document.addEventListener('click',e=>{if(!e.target.closest('.activity-name-wrap'))hideActivitySuggestions();});$('modalDay').addEventListener('change',updateActivityTemplateStates);$('modalNoSchedule').addEventListener('change',()=>{if($('modalNoSchedule').checked)$('modalAllDay').checked=false;updateModalScheduleVisibility();});$('modalAllDay').addEventListener('change',()=>{if($('modalAllDay').checked)$('modalNoSchedule').checked=false;updateModalScheduleVisibility();});$('modalListId').addEventListener('change',()=>{if($('modalListId').value==='inbox'){$('modalNoSchedule').checked=true;$('modalAllDay').checked=false;}updateModalScheduleVisibility();});$('modalTime').addEventListener('input',()=>{const el=$('modalTime'),value=String(el.value||'').trim();if(value.includes(':')||value.length===3||value.length===4){if(normalizeTimeField(el))updateEndTimeFromDuration();}});$('modalDuration').addEventListener('change',updateEndTimeFromDuration);$('modalEndTime').addEventListener('input',()=>{const el=$('modalEndTime');el.setCustomValidity('');const value=String(el.value||'').trim();if(value==='24:00'||value.includes(':')||value.length===3||value.length===4)updateDurationFromEnd();});$('modalEndTime').addEventListener('change',updateDurationFromEnd);$('modalEndTime').addEventListener('blur',()=>{if(String($('modalEndTime').value||'').trim()){normalizeEndTimeField($('modalEndTime'));updateDurationFromEnd();}});$('closeModal').addEventListener('click',()=>closeTaskModal());$('taskForm').addEventListener('submit',saveModalTask);
$('applyTaskTemplateBtn').addEventListener('click',applySelectedTaskTemplate);$('saveTaskTemplateBtn').addEventListener('click',saveModalAsTaskTemplate);$('deleteTaskTemplateBtn').addEventListener('click',deleteSelectedTaskTemplate);$('taskTemplateSelect').addEventListener('change',()=>{$('deleteTaskTemplateBtn').disabled=!$('taskTemplateSelect').value;});$('deleteTaskBtn').addEventListener('click',()=>{const id=$('editTaskId').value,t=tasks.find(x=>x.id===id);if(t&&!t.fixed&&confirm(`Delete “${t.title}”?`)){if(t.seriesId){const template=(store.recurringTemplates||[]).find(item=>item.id===t.seriesId);if(template){template.excludedDates=Array.isArray(template.excludedDates)?template.excludedDates:[];const occurrenceDate=t.occurrenceDate||dateKey(dayDate(currentWeek,t.day));if(!template.excludedDates.includes(occurrenceDate))template.excludedDates.push(occurrenceDate);}}tasks=tasks.filter(x=>x.id!==id);saveCurrent();closeTaskModal(true);renderAll();showToast('Activity deleted');}});$('taskModal').addEventListener('click',e=>{if(e.target===$('taskModal'))closeTaskModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeTaskModal();closeTemplateEditor();if(activeUtilityPanel)closeUtilityPanel();$('moreActions').open=false;}});$('quickAddForm').addEventListener('submit',addQuick);$('exportBtn').addEventListener('click',exportBackup);$('exportEditorHistoryBtn').addEventListener('click',exportEditorHistory);$('importBtn').addEventListener('click',()=>$('importFile').click());$('importFile').addEventListener('change',e=>{const file=e.target.files&&e.target.files[0];if(file)loadImport(file);e.target.value='';});$('printBtn').addEventListener('click',()=>{window.print();$('moreActions').open=false;});$('exportBtn').addEventListener('click',()=>$('moreActions').open=false);$('importBtn').addEventListener('click',()=>$('moreActions').open=false);$('weekStart').addEventListener('change',setWeekFromInput);$('quickDay').value=String(mobileDay);const mobileQuery=window.matchMedia('(max-width: 650px)');if(mobileQuery.addEventListener)mobileQuery.addEventListener('change',()=>renderDays());else if(mobileQuery.addListener)mobileQuery.addListener(()=>renderDays());window.addEventListener('resize',()=>{if(window.innerWidth<=650)renderMobileDayPicker();});initializeCloud();setInterval(checkCloudForRemoteChanges,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkCloudForRemoteChanges();});}

/* Optional visual gaps, monthly calendar, and week-selectable dashboard. */
const weekwiseOriginalRenderDays=renderDays;
const weekwiseOriginalRenderStats=renderStats;
function weekwiseTasksOnDate(date){
 const key=dateKey(sundayOf(date)),dateKeyValue=dateKey(date);
 const source=key===currentWeek?tasks:(Array.isArray(store.weeks[key]&&store.weeks[key].tasks)?store.weeks[key].tasks:[]);
 return source.filter(function(t){
  const timed=Number(t.day)===date.getDay()&&t.start!==null&&t.start!==undefined&&!t.unscheduled&&Number(t.duration)>0;
  const allDay=!!t.allDay&&(t.allDayDate||t.dueDate)===dateKeyValue;
  return timed||allDay;
 }).sort(function(a,b){const aa=!!a.allDay,bb=!!b.allDay;if(aa!==bb)return aa?-1:1;return Number(a.start)-Number(b.start);});
}
function weekwiseRenderMonth(){
 const grid=$('daysGrid');grid.classList.add('month-mode');grid.setAttribute('aria-label','Monthly calendar');
 const picker=$('mobileDayPicker');if(picker)picker.hidden=true;const help=$('mobileHelp');if(help)help.hidden=true;
 updateViewControls();
 const year=monthAnchor.getFullYear(),month=monthAnchor.getMonth(),layout=WeekwiseCalendarLayout.month(year,month,store.settings.calendarGridStartDay),start=layout.start,count=layout.count;
 let markup='<div class="month-calendar">'+layout.weekdays.map(function(i){return '<div class="month-weekday">'+DAY_SHORT[i]+'</div>';}).join('');
 for(let i=0;i<count;i++){
  const date=new Date(start);date.setDate(start.getDate()+i);
  const key=dateKey(date),inMonth=date.getMonth()===month,isToday=key===dateKey(now),items=weekwiseTasksOnDate(date);
  const chips=items.slice(0,3).map(function(t){const allDay=!!t.allDay,end=Number(t.start)+Number(t.duration||0),endLabel=end===1440?'24:00':minsTime(end),when=allDay?'All day':minsTime(Number(t.start));return '<button type="button" class="month-event-chip '+categoryClass(t.type)+(t.done?' done':'')+(allDay?' month-event-all-day':'')+'" data-month-event="'+escapeHtml(t.id)+'" data-month-date="'+key+'" title="'+escapeHtml(t.title+' · '+(allDay?'All day':minsTime(Number(t.start))+'–'+endLabel))+'"><span class="month-event-time">'+when+'</span><span class="month-event-title">'+escapeHtml(t.title)+'</span></button>';}).join('');
  const more=items.length>3?'<div class="month-more">+'+(items.length-3)+' more</div>':'';
  markup+='<div class="month-day-cell '+(inMonth?'':'outside-month')+(isToday?' is-today':'')+'" role="button" tabindex="0" data-month-day="'+key+'" aria-label="'+escapeHtml(fmtDate(date,{weekday:'long',day:'numeric',month:'long'}))+', '+items.length+' activities"><div class="month-day-number"><span>'+date.getDate()+'</span>'+(isToday?'<span class="month-today-dot" aria-hidden="true"></span>':'')+'</div><div class="month-event-list">'+chips+more+'</div>'+(items.length?'':'<span class="month-empty-hint">+ Add</span>')+'</div>';
 }
 grid.innerHTML=markup+'</div>';grid.scrollTop=0;grid.scrollLeft=0;grid.dataset.hasRendered='true';
 grid.onclick=function(e){
  if(calendarView!=='month')return;
  const ev=e.target.closest('[data-month-event]');
  if(ev){e.preventDefault();e.stopPropagation();const date=parseKey(ev.dataset.monthDate),id=ev.dataset.monthEvent;saveCurrent();mobileDay=date.getDay();currentWeek=dateKey(sundayOf(date));loadWeek(currentWeek);calendarView='day';try{localStorage.setItem('weekwise-calendar-view-v1','day');}catch(_){}renderAll();const item=tasks.find(function(t){return t.id===id;});if(item){if(item.fixed)openFixedSettings(id);else openTaskModal(id);}return;}
  const cell=e.target.closest('[data-month-day]');
  if(cell){const date=parseKey(cell.dataset.monthDay);saveCurrent();mobileDay=date.getDay();monthAnchor=new Date(date.getFullYear(),date.getMonth(),1);currentWeek=dateKey(sundayOf(date));loadWeek(currentWeek);calendarView='day';try{localStorage.setItem('weekwise-calendar-view-v1','day');}catch(_){}renderAll();openTaskModal(null,mobileDay,dateKey(date)===dateKey(now)?nextQuarterHour():10*60);}
 };
 grid.onkeydown=function(e){if(calendarView!=='month'||(e.key!=='Enter'&&e.key!==' '))return;const cell=e.target.closest('[data-month-day]');if(cell&&!e.target.closest('[data-month-event]')){e.preventDefault();cell.click();}};
}
function weekwiseRenderBreaks(){
 const grid=$('daysGrid');grid.querySelectorAll('.break-layer').forEach(function(el){el.remove();});
 if(store.settings.showBreaks===false)return;
 const hourHeight=56;
 grid.querySelectorAll('.day-column').forEach(function(column){
  const day=Number(column.dataset.dayIndex),items=tasks.filter(function(t){return Number(t.day)===day&&t.start!==null&&t.start!==undefined&&!t.unscheduled&&Number(t.duration)>0;}).slice().sort(function(a,b){return Number(a.start)-Number(b.start);});
  let covered=null;const gaps=[];
  items.forEach(function(t){const st=Math.max(0,Number(t.start)),en=Math.min(1440,st+Number(t.duration||0));if(covered!==null&&st-covered>=15)gaps.push({start:covered,end:st});covered=covered===null?en:Math.max(covered,en);});
  if(!gaps.length)return;
  const layer=document.createElement('div');layer.className='break-layer';layer.setAttribute('aria-hidden','true');
  layer.innerHTML=gaps.map(function(g){const mins=g.end-g.start,top=g.start/60*hourHeight,pixels=mins/60*hourHeight,height=Math.max(10,Math.min(19,pixels-2)),label=mins>=60?(Math.floor(mins/60)+'h'+(mins%60?' '+(mins%60)+'m':'')+' break'):(mins+'m break');return '<span class="break-gap" style="top:'+(top+Math.max(1,(pixels-height)/2))+'px;height:'+height+'px" title="'+label+' between scheduled activities">'+label+'</span>';}).join('');
  column.appendChild(layer);
 });
}
renderDays=function(){
 const grid=$('daysGrid');
 grid.classList.remove('month-mode','agenda-mode','year-mode');grid.onclick=null;grid.onkeydown=null;grid.onchange=null;
 if(calendarView==='month'){grid.style.height='auto';grid.style.minHeight='0';grid.style.maxHeight='none';weekwiseRenderMonth();updateCalendarPeriodLabel();return;}
 if(calendarView==='agenda'){grid.style.height='auto';grid.style.minHeight='0';grid.style.maxHeight='none';weekwiseRenderAgenda();updateCalendarPeriodLabel();return;}
 if(calendarView==='year'){grid.style.height='auto';grid.style.minHeight='0';grid.style.maxHeight='none';weekwiseRenderYear();updateCalendarPeriodLabel();return;}
 grid.style.height='';grid.style.minHeight='';grid.style.maxHeight='';
 const picker=$('mobileDayPicker');if(picker)picker.hidden=workspaceView!=='calendar';const help=$('mobileHelp');if(help)help.hidden=workspaceView!=='calendar';
 weekwiseOriginalRenderDays();weekwiseRenderBreaks();updateCalendarPeriodLabel();
};
updateViewControls=function(){
 [['dayViewBtn','day'],['weekViewBtn','week'],['monthViewBtn','month'],['agendaViewBtn','agenda'],['yearViewBtn','year']].forEach(function(pair){const b=$(pair[0]);if(b){b.classList.toggle('active',calendarView===pair[1]);b.setAttribute('aria-pressed',calendarView===pair[1]?'true':'false');}});
 const unit=calendarView==='day'?'day':calendarView==='month'?'month':calendarView==='year'?'year':'week';
 ['prevWeek','nextWeek'].forEach(function(id){const b=$(id);if(b){b.title=(id==='prevWeek'?'Previous ':'Next ')+unit;b.setAttribute('aria-label',b.title);}});
};
function weekwiseAnimateCalendar(){
 const grid=$('daysGrid');
 if(!grid||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 grid.classList.remove('weekwise-transition-enter');
 void grid.offsetWidth;
 grid.classList.add('weekwise-transition-enter');
 setTimeout(function(){grid.classList.remove('weekwise-transition-enter');},380);
}
setCalendarView=function(view){
 if(!['day','week','month','agenda','year'].includes(view))return;
 const changing=calendarView!==view;saveCurrent();
 if(changing)weekwiseAnimateCalendar();
 const selectedDate=dayDate(currentWeek,mobileDay);
 if(changing&&view==='month')monthAnchor=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
 if(changing&&view==='agenda')agendaAnchor=dateOnly(selectedDate);
 if(changing&&view==='year')calendarYear=selectedDate.getFullYear();
 calendarView=view;try{localStorage.setItem('weekwise-calendar-view-v1',view);}catch(_){}
 renderAll();updateCalendarPeriodLabel();
};
shiftPeriod=function(n){
 weekwiseAnimateCalendar();
 if(calendarView==='month'){saveCurrent();monthAnchor=new Date(monthAnchor.getFullYear(),monthAnchor.getMonth()+n,1);currentWeek=dateKey(sundayOf(monthAnchor));loadWeek(currentWeek);renderAll();return;}
 if(calendarView==='year'){calendarYear+=n;renderAll();updateCalendarPeriodLabel();return;}
 if(calendarView==='agenda'){agendaAnchor=addDaysForView(agendaAnchor,n*7);renderAll();updateCalendarPeriodLabel();return;}
 if(calendarView!=='day'){shiftWeeks(n);return;}
 const d=dayDate(currentWeek,mobileDay);d.setDate(d.getDate()+n);saveCurrent();mobileDay=d.getDay();loadWeek(dateKey(sundayOf(d)));
};
openDashboard=function(){
 dashboardWeekKey=currentWeek;const picker=$('dashboardWeekPicker');if(picker)picker.value=currentWeek;renderStats();openUtilityPanel('dashboard','Effort dashboard');
};
renderStats=function(){
 const selected=dashboardWeekKey||currentWeek,oldTasks=tasks,oldWeek=currentWeek;
 if(selected!==currentWeek){tasks=Array.isArray(store.weeks[selected]&&store.weeks[selected].tasks)?store.weeks[selected].tasks:[];currentWeek=selected;}
 const measuredTasks=tasks;
 weekwiseOriginalRenderStats();
 const scheduled=measuredTasks.filter(function(t){return t.start!==null&&t.start!==undefined&&!t.unscheduled&&Number(t.duration)>0;});
 const total=scheduled.length,done=scheduled.filter(function(t){return t.done;}).length,planned=scheduled.reduce(function(n,t){return n+Number(t.duration||0);},0),logged=scheduled.filter(function(t){return t.done;}).reduce(function(n,t){return n+Number(t.duration||0);},0);
 const groups=[{key:'job',label:'Career'},{key:'study',label:'Coursework & communication'},{key:'language',label:'Languages'},{key:'life',label:'Home & routines'},{key:'hobby',label:'Hobbies & city trips'},{key:'workday',label:'Work day'},{key:'other',label:'Other'}].map(function(g){g.total=scheduled.filter(function(t){return analyticsGroup(t)===g.key;}).reduce(function(n,t){return n+Number(t.duration||0);},0);return g;}).sort(function(a,b){return b.total-a.total;});
 const days=DAY_NAMES.map(function(_,i){const a=scheduled.filter(function(t){return Number(t.day)===i;});return {label:DAY_SHORT[i],total:a.reduce(function(n,t){return n+Number(t.duration||0);},0)};}).sort(function(a,b){return b.total-a.total;});
 const insight=$('dashboardInsight');
 if(insight){if(!total)insight.textContent='This week has no scheduled activities yet. Add activities to start tracking your effort.';else insight.innerHTML='<strong>'+done+' of '+total+' activities completed.</strong> You logged <strong>'+durationText(logged)+'</strong> of <strong>'+durationText(planned)+'</strong> planned time. Most time is allocated to <strong>'+(groups[0]&&groups[0].total?groups[0].label:'no category yet')+'</strong>'+(days[0]&&days[0].total?'; <strong>'+days[0].label+'</strong> is your busiest day ('+durationText(days[0].total)+' planned)':'')+'.';}
 tasks=oldTasks;currentWeek=oldWeek;
 const picker=$('dashboardWeekPicker');if(picker&&!picker.value)picker.value=selected;
 if(calendarView==='month')$('weekLabel').textContent=monthAnchor.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
 else if(calendarView==='day')$('weekLabel').textContent=DAY_NAMES[mobileDay]+', '+fmtDate(dayDate(currentWeek,mobileDay),{day:'numeric',month:'short',year:'numeric'});
 else $('weekLabel').textContent=fmtDate(parseKey(currentWeek),{day:'numeric',month:'short'})+' – '+fmtDate(dayDate(currentWeek,6),{day:'numeric',month:'short',year:'numeric'});
};
$('dashboardWeekPicker').addEventListener('change',function(){if(!$('dashboardWeekPicker').value)return;dashboardWeekKey=dateKey(sundayOf(parseKey($('dashboardWeekPicker').value)));renderStats();});
$('thisWeek').addEventListener('click',function(){monthAnchor=new Date(now.getFullYear(),now.getMonth(),1);agendaAnchor=dateOnly(now);calendarYear=now.getFullYear();});

$('thisWeek').addEventListener('click',weekwiseAnimateCalendar);
$('mobileDayPicker').addEventListener('click',function(e){if(e.target.closest('[data-mobile-day]'))weekwiseAnimateCalendar();});
$('daysGrid').addEventListener('click',function(e){if(e.target.closest('[data-month-day],[data-month-event]'))weekwiseAnimateCalendar();});

const BUILTIN_WORKSPACE_LISTS=[{id:'career',label:'Career',view:'list-career'},{id:'study',label:'Study',view:'list-study'},{id:'work',label:'Work',view:'list-work'},{id:'personal',label:'Personal',view:'list-personal'},{id:'language',label:'Languages',view:'list-language'},{id:'hobbies',label:'Hobbies',view:'list-hobbies'},{id:'other',label:'Other',view:'list-other'}];
let WORKSPACE_LISTS=BUILTIN_WORKSPACE_LISTS.slice();
function syncWorkspaceListOptions(){
 const customs=Array.isArray(store.customLists)?store.customLists:[];
 for(const select of [$('modalListId'),$('filterList')]){
  if(!select)continue;
  select.querySelectorAll('option[data-custom-list-option]').forEach(option=>option.remove());
  customs.forEach(item=>{if(!item||!item.id||!item.name)return;const option=document.createElement('option');option.value=item.id;option.textContent=item.name;option.dataset.customListOption='true';select.appendChild(option);});
 }
}
function renderWorkspaceCustomLists(){
 const nav=$('workspaceCustomListsNav');if(!nav)return;
 const customLists=Array.isArray(store.customLists)?store.customLists:[];
 if(!customLists.length){nav.innerHTML='';return;}
 const counts=new Map();workspaceRecords().forEach(record=>counts.set(record.listId,(counts.get(record.listId)||0)+1));
 nav.innerHTML=customLists.map(item=>{
  const view='list-'+item.id,active=workspaceView===view;
  return '<div class="workspace-custom-list-row"><button type="button" class="workspace-nav-btn '+(active?'active':'')+'" data-workspace-view="'+escapeHtml(view)+'" aria-current="'+(active?'page':'false')+'"><span class="list-colour-dot custom-list-dot"></span><span title="'+escapeHtml(item.name)+'">'+escapeHtml(item.name)+'</span><span class="workspace-nav-count">'+(counts.get(item.id)||0)+'</span></button><button type="button" class="workspace-list-action" data-custom-list-rename="'+escapeHtml(item.id)+'" title="Rename '+escapeHtml(item.name)+'" aria-label="Rename '+escapeHtml(item.name)+'">✎</button><button type="button" class="workspace-list-action" data-custom-list-delete="'+escapeHtml(item.id)+'" title="Delete '+escapeHtml(item.name)+'" aria-label="Delete '+escapeHtml(item.name)+'">×</button></div>';
 }).join('');
}
function syncWorkspaceLists(){
 if(!Array.isArray(store.customLists))store.customLists=[];
 WORKSPACE_LISTS=BUILTIN_WORKSPACE_LISTS.concat(store.customLists.filter(item=>item&&item.id&&item.name).map(item=>({id:item.id,label:item.name,view:'list-'+item.id,custom:true})));
 syncWorkspaceListOptions();renderWorkspaceCustomLists();
}
const WORKSPACE_VIEW_INFO={search:{title:'Search all tasks',description:'Search across lists, folders, tags, notes and deadlines.',emptyTitle:'Search your whole workspace',emptyText:'Enter a task name, note, tag, list, folder or deadline to find matching tasks.'},today:{title:'Today',description:'Focus on the tasks planned for today.',emptyTitle:'Nothing on your plan yet',emptyText:'Capture a task above, or add a scheduled activity from the calendar.'},tomorrow:{title:'Tomorrow',description:'Look ahead one day and prepare without mixing it into today.',emptyTitle:'Tomorrow is clear',emptyText:'Schedule a task or add a deadline for tomorrow. Tasks remain linked to your calendar.'},inbox:{title:'Inbox',description:'Capture first. Decide when to do it later.',emptyTitle:'Your inbox is clear',emptyText:'Use the quick-capture box to collect tasks before scheduling them.'},upcoming:{title:'Upcoming',description:'See scheduled activities across the next seven days.',emptyTitle:'No upcoming tasks',emptyText:'Tasks scheduled for the next seven days will appear here.'},calendar:{title:'Calendar',description:'Time-block your activities.'}};
function workspaceRecords(){
 const records=[],keys=new Set([...Object.keys(store.weeks||{}),currentWeek]);
 [...keys].sort().forEach(week=>{const rows=week===currentWeek?tasks:(Array.isArray(store.weeks[week]?.tasks)?store.weeks[week].tasks:[]);rows.forEach(task=>{if(!task)return;let date;try{date=dayDate(week,Number(task.day)||0);}catch(_){return;}records.push({task,week,date,listId:inferredListId(task)});});});
 return records.sort((a,b)=>a.date-b.date||(a.task.start==null?1:b.task.start==null?-1:Number(a.task.start)-Number(b.task.start)));
}

function workspaceFolderSummary(){
 const counts=new Map();
 workspaceRecords().forEach(record=>{
  const name=String(record.task.folderName||defaultFolderName(record.listId)||'Personal').trim()||'Personal';
  counts.set(name,(counts.get(name)||0)+1);
 });
 return [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function renderWorkspaceFolders(){
 const nav=$('workspaceFolderNav');if(!nav)return;
 const folders=workspaceFolderSummary();
 if(!folders.length){nav.innerHTML='<p class="workspace-folder-empty">Folders appear here when you assign them to a task.</p>';return;}
 nav.innerHTML=folders.map(([name,count])=>{
  const view='folder:'+name,active=workspaceView===view;
  return '<button type="button" class="workspace-nav-btn workspace-folder-btn '+(active?'active':'')+'" data-workspace-view="'+escapeHtml(view)+'" aria-current="'+(active?'page':'false')+'"><span class="workspace-nav-icon" aria-hidden="true">▰</span><span title="'+escapeHtml(name)+'">'+escapeHtml(name)+'</span><span class="workspace-nav-count">'+count+'</span></button>';
 }).join('');
}

function workspaceTagSummary(){
 const counts=new Map();
 workspaceRecords().forEach(record=>{
  (Array.isArray(record.task.tags)?record.task.tags:[]).forEach(raw=>{
   const name=String(raw||'').trim().replace(/^#/,'');if(!name)return;
   const key=name.toLowerCase(),existing=counts.get(key);
   if(existing)existing.count++;else counts.set(key,{name,count:1});
  });
 });
 return [...counts.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function renderWorkspaceTags(){
 const nav=$('workspaceTagNav');if(!nav)return;
 const tags=workspaceTagSummary();
 if(!tags.length){nav.innerHTML='<p class="workspace-tag-empty">Tags appear here when you add them to tasks.</p>';return;}
 nav.innerHTML=tags.map(item=>{
  const view='tag:'+item.name,active=workspaceView.toLowerCase()===view.toLowerCase();
  return '<button type="button" class="workspace-nav-btn workspace-tag-btn '+(active?'active':'')+'" data-workspace-view="'+escapeHtml(view)+'" aria-current="'+(active?'page':'false')+'"><span class="workspace-tag-hash">#</span><span title="'+escapeHtml(item.name)+'">'+escapeHtml(item.name)+'</span><span class="workspace-nav-count">'+item.count+'</span></button>';
 }).join('');
}
function workspaceRecordMatches(record,view){
 const t=record.task,day=dateOnly(now),todayKey=dateKey(day),end=new Date(day);end.setDate(end.getDate()+7);
 const recordDate=dateOnly(record.date),recordKey=dateKey(recordDate),listId=record.listId;
 if(view==='search')return true;
 if(view==='today')return ((listId!=='inbox'||!!t.allDay||(!t.unscheduled&&t.start!==null&&t.start!==undefined))&&recordKey===todayKey)||(!t.done&&!!t.dueDate&&t.dueDate<=todayKey);
 const tomorrowKey=dateKey(addDaysForView(day,1));
 if(view==='tomorrow')return (recordKey===tomorrowKey&&(!!t.allDay||(!t.unscheduled&&t.start!=null)))||(!t.done&&t.dueDate===tomorrowKey);
 if(view==='inbox')return listId==='inbox';
 if(view==='upcoming'){
  const scheduledSoon=recordDate>=day&&recordDate<end&&(!!t.allDay||(!t.unscheduled&&t.start!=null));
  const dueSoon=!!t.dueDate&&t.dueDate>todayKey&&t.dueDate<dateKey(end);
  return !t.done&&(scheduledSoon||dueSoon);
 }
 if(view.startsWith('list-'))return listId===view.slice(5);
 if(view.startsWith('folder:'))return (record.task.folderName||defaultFolderName(record.listId))===view.slice(7);
 if(view.startsWith('tag:'))return Array.isArray(t.tags)&&t.tags.some(tag=>String(tag).replace(/^#/,'').toLowerCase()===view.slice(4).toLowerCase());
 return false;
}
function workspacePriorityValue(priority){return ({high:3,medium:2,low:1})[priority]||0;}
function workspaceDateLabel(record){
 if(record.task.start==null||record.task.unscheduled)return 'Not scheduled';
 const todayKey=dateKey(now),tomorrow=new Date(dateOnly(now));tomorrow.setDate(tomorrow.getDate()+1);
 const dateLabel=dateKey(record.date)===todayKey?'Today':dateKey(record.date)===dateKey(tomorrow)?'Tomorrow':fmtDate(record.date,{weekday:'short',day:'numeric',month:'short'});
 return dateLabel+' · '+formatTime(record.task);
}
function workspaceTaskRow(record){
 const t=record.task,priority=t.priority||'none',tags=Array.isArray(t.tags)?t.tags.filter(Boolean):[],subtasks=Array.isArray(t.subtasks)?t.subtasks:[];
 const completedSubtasks=subtasks.filter(s=>typeof s==='object'&&s.done).length;
 const priorityHtml=priority!=='none'?'<span class="workspace-meta-pill priority-'+escapeHtml(priority)+'">'+({high:'↑ High',medium:'→ Medium',low:'↓ Low'}[priority]||'Priority')+'</span>':'';
 const dueHtml=t.dueDate?'<span class="workspace-meta-pill">Due '+escapeHtml(fmtDate(parseKey(t.dueDate),{day:'numeric',month:'short'}))+'</span>':'';
 const scheduleHtml=t.allDay?'<span class="workspace-meta-pill">All day</span>':(record.listId==='inbox'?'<span class="workspace-meta-pill">Inbox</span>':(t.unscheduled||t.start==null?'<span class="workspace-meta-pill">Not scheduled</span>':'<span>'+escapeHtml(workspaceDateLabel(record))+'</span>'));
 const status=taskBoardStatus(t),statusHtml=status==='in-progress'?'<span class="workspace-meta-pill">In progress</span>':'';
 const focusTarget=Number(t.focusEstimateMinutes)||0,focusLogged=taskLoggedFocusMinutes(t.id);
 const focusEstimateHtml=focusTarget?'<span class="workspace-meta-pill task-focus-estimate" title="Estimated focus '+focusTarget+' minutes">'+String(focusTarget)+'m focus target'+(focusLogged?' · '+focusLogged+'m logged':'')+'</span>':'';
 const tagsHtml=tags.length?'<div class="workspace-task-tags">'+tags.map(tag=>'<span>#'+escapeHtml(tag)+'</span>').join('')+'</div>':'';
 const attachmentsHtml=renderTaskAttachments(t.attachments);
 const reminderList=taskReminderTimes(t),pendingReminderList=reminderList.filter(value=>!((Array.isArray(t.reminderNotifiedTimes)&&t.reminderNotifiedTimes.includes(value))||t.reminderNotifiedAt===value));
 const reminderPreview=pendingReminderList[0]||reminderList[0]||'';
 const reminderLabel=reminderList.length>1?(pendingReminderList.length||reminderList.length)+' reminders':reminderPreview?new Date(reminderPreview).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
 const reminderHtml=reminderList.length?'<span class="workspace-meta-pill task-reminder-pill" title="'+escapeHtml(reminderList.map(value=>new Date(value).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})).join(' · '))+'">◷ '+escapeHtml(reminderLabel)+'</span>':'';
 const organizationHtml='<span class="workspace-meta-pill workspace-folder-pill">'+escapeHtml(t.folderName||defaultFolderName(record.listId))+'</span>'+(t.sectionName?'<span class="workspace-meta-pill workspace-section-pill">§ '+escapeHtml(t.sectionName)+'</span>':'');
 const label=WORKSPACE_LISTS.find(x=>x.id===record.listId)?.label||'Inbox',attrs=' data-workspace-week="'+escapeHtml(record.week)+'"';
 const subtasksHtml=subtasks.length?'<details class="workspace-subtasks"><summary>☷ '+completedSubtasks+'/'+subtasks.length+' subtasks</summary><div class="workspace-subtask-list">'+subtasks.map((sub,index)=>{const title=typeof sub==='string'?sub:(sub.title||'Untitled step'),checked=typeof sub==='object'&&!!sub.done;return '<label class="workspace-subtask-row"><input type="checkbox" data-workspace-subtask="'+escapeHtml(t.id)+'" data-workspace-subtask-index="'+index+'"'+attrs+' '+(checked?'checked':'')+' aria-label="Complete subtask '+escapeHtml(title)+'"><span class="'+(checked?'is-complete':'')+'">'+escapeHtml(title)+'</span></label>';}).join('')+'</div></details>':'';
 return '<article class="workspace-task-row '+(t.done?'is-done':'')+'" data-workspace-id="'+escapeHtml(t.id)+'"'+attrs+'>'+
  '<input class="workspace-task-check" type="checkbox" data-workspace-done="'+escapeHtml(t.id)+'"'+attrs+' aria-label="Mark '+escapeHtml(t.title)+' complete" '+(t.done?'checked':'')+'>'+
  '<div class="workspace-task-main"><button type="button" class="workspace-task-title" data-workspace-edit="'+escapeHtml(t.id)+'"'+attrs+'>'+escapeHtml(t.title)+'</button>'+
  '<div class="workspace-task-meta">'+scheduleHtml+'<span class="workspace-meta-pill">'+escapeHtml(label)+'</span>'+organizationHtml+statusHtml+priorityHtml+dueHtml+reminderHtml+focusEstimateHtml+'</div>'+tagsHtml+attachmentsHtml+subtasksHtml+(t.note?'<div class="workspace-task-subtasks">'+escapeHtml(t.note)+'</div>':'')+'</div>'+
  '<div class="workspace-task-actions"><button type="button" title="Edit task" aria-label="Edit '+escapeHtml(t.title)+'" data-workspace-edit="'+escapeHtml(t.id)+'"'+attrs+'>✎</button><button type="button" title="Delete task" aria-label="Delete '+escapeHtml(t.title)+'" data-workspace-delete="'+escapeHtml(t.id)+'"'+attrs+'>×</button></div></article>';
}
function updateWorkspaceCounts(){
 const all=workspaceRecords(),todayKey=dateKey(now),nextWeek=new Date(dateOnly(now));nextWeek.setDate(nextWeek.getDate()+7);const endKey=dateKey(nextWeek);
 const ids={Today:'navCountToday',Tomorrow:'navCountTomorrow',Inbox:'navCountInbox',Upcoming:'navCountUpcoming',Career:'navCountCareer',Study:'navCountStudy',Work:'navCountWork',Personal:'navCountPersonal',Languages:'navCountLanguage',Hobbies:'navCountHobbies',Other:'navCountOther'};
 const listIds={Career:'career',Study:'study',Work:'work',Personal:'personal',Languages:'language',Hobbies:'hobbies',Other:'other'};
 Object.entries(ids).forEach(([key,id])=>{
  const el=$(id);if(!el)return;
  const tomorrowKey=dateKey(addDaysForView(now,1));
  const count=key==='Today'
   ?all.filter(r=>((r.listId!=='inbox'||!!r.task.allDay||(!r.task.unscheduled&&r.task.start!==null&&r.task.start!==undefined))&&dateKey(r.date)===todayKey)||(!r.task.done&&!!r.task.dueDate&&r.task.dueDate<=todayKey)).length
   :key==='Tomorrow'
    ?all.filter(r=>(dateKey(r.date)===tomorrowKey&&(r.task.allDay||(!r.task.unscheduled&&r.task.start!=null)))||(!r.task.done&&r.task.dueDate===tomorrowKey)).length
   :key==='Inbox'
    ?all.filter(r=>r.listId==='inbox').length
    :key==='Upcoming'
     ?all.filter(r=>!r.task.done&&(((!r.task.unscheduled&&r.task.start!=null||r.task.allDay)&&dateKey(r.date)>=todayKey&&dateKey(r.date)<endKey)||(r.task.dueDate&&r.task.dueDate>todayKey&&r.task.dueDate<endKey))).length
     :all.filter(r=>r.listId===listIds[key]).length;
  el.textContent=String(count);
 });
}

function renderWorkspaceTaskGroups(items){
 const groups=new Map();
 items.forEach(record=>{
  const section=String(record.task.sectionName||'').trim()||'No section';
  if(!groups.has(section))groups.set(section,[]);
  groups.get(section).push(record);
 });
 return [...groups.entries()].sort((a,b)=>{
  if(a[0]==='No section')return -1;
  if(b[0]==='No section')return 1;
  return a[0].localeCompare(b[0]);
 }).map(([section,records])=>'<section class="workspace-section-group"><header><span>§ '+escapeHtml(section)+'</span><span>'+records.length+'</span></header>'+records.map(workspaceTaskRow).join('')+'</section>').join('');
}

function experienceData(){return {active:workspaceView==='insights',owner:currentDataOwner,week:dateKey(sundayOf(now)),today:dateKey(now),minute:now.getHours()*60+now.getMinutes(),store,records:workspaceRecords().map(r=>({...r,dateKey:dateKey(r.date)})),focusSessions,habits,signedIn:!!cloudUser,syncLabel:$('cloudMenuBadge').textContent};}
function renderExperience(){renderDraftNotice();renderZoneNotice();if(!window.WeekwiseExperience)return;const data=experienceData();WeekwiseExperience.renderInsights(data);WeekwiseExperience.renderSettings(data);}
function renderTodayOverview(){const panel=$('todayOverview');panel.hidden=workspaceView!=='today';if(!panel.hidden)WeekwiseExperience.renderToday({...experienceData(),active:true});}

function listPage(key,items){const scoped=currentDataOwner+'::'+key,page=WeekwiseListWindow.page(scoped,items);return {...page,key:scoped};}
function listPageFooter(page){return page.total>WeekwiseListWindow.SIZE?'<div class="list-page-footer" role="status"><span>Showing '+page.shown+' of '+page.total+' tasks</span>'+(page.hasMore?'<button class="btn" type="button" data-list-more="'+escapeHtml(page.key)+'">Show '+Math.min(WeekwiseListWindow.SIZE,page.total-page.shown)+' more</button>':'')+'</div>':'';}
function renderWorkspaceTasks(){
 const list=$('workspaceTaskList');if(!list)return;
 const search=String($('workspaceSearch')?.value||'').trim().toLowerCase(),sort=$('workspaceSort')?.value||'date';
 let items=workspaceRecords().filter(r=>workspaceRecordMatches(r,workspaceView));
 if(search)items=items.filter(r=>[r.task.title,r.task.note,r.task.folderName,r.task.sectionName,r.task.dueDate,r.task.priority,r.task.status,r.task.listId,WORKSPACE_LISTS.find(list=>list.id===r.listId)?.label,...(Array.isArray(r.task.tags)?r.task.tags:[]),...(Array.isArray(r.task.attachments)?r.task.attachments:[])].join(' ').toLowerCase().includes(search));
 if(sort==='priority')items.sort((a,b)=>workspacePriorityValue(b.task.priority)-workspacePriorityValue(a.task.priority)||a.date-b.date||(Number(a.task.start??9999)-Number(b.task.start??9999)));
 else if(sort==='title')items.sort((a,b)=>String(a.task.title).localeCompare(String(b.task.title)));
 else items.sort((a,b)=>a.date-b.date||(a.task.start==null?1:b.task.start==null?-1:Number(a.task.start)-Number(b.task.start)));
 const folderView=workspaceView.startsWith('folder:'),folderTitle=folderView?workspaceView.slice(7):'';
 const tagView=workspaceView.startsWith('tag:'),tagTitle=tagView?workspaceView.slice(4):'';
 const info=WORKSPACE_VIEW_INFO[workspaceView]||{title:tagView?'#'+tagTitle:folderView?folderTitle:(WORKSPACE_LISTS.find(x=>x.view===workspaceView)?.label||'Tasks'),description:tagView?'Tasks tagged #'+tagTitle:folderView?'Tasks organized in this folder.':'Tasks in this list.',emptyTitle:tagView?'No tasks with this tag':folderView?'This folder is empty':'No tasks in this list yet',emptyText:tagView?'Add this tag to a task to make it appear here.':folderView?'Edit any task to place it in this folder, or create a task with this folder name.':'Add a task to this list or edit an existing task to move it here.'};
 $('taskWorkspaceTitle').textContent=info.title;$('taskWorkspaceDescription').textContent=info.description||'';
 $('workspaceCaptureInput').placeholder=workspaceView==='inbox'?'Quick capture to Inbox…':workspaceView.startsWith('folder:')?'Add a task to '+workspaceView.slice(7)+'…':workspaceView.startsWith('tag:')?'Add a task tagged #'+workspaceView.slice(4)+'…':'Add a task to your inbox…';$('workspaceAddTaskBtn').textContent=workspaceView==='inbox'?'＋ Add to Inbox':'＋ Add task';
 $('workspaceSearch').placeholder=workspaceView==='search'?'Search every list, folder, tag and deadline…':'Search tasks in this view';
 const shouldGroupSections=(workspaceView.startsWith('list-')||workspaceView.startsWith('folder:')||workspaceView.startsWith('tag:'))&&items.some(record=>String(record.task.sectionName||'').trim());
 const page=listPage('workspace:'+workspaceView+'|'+search+'|'+sort,items);const renderedItems=(shouldGroupSections?renderWorkspaceTaskGroups(page.records):page.records.map(workspaceTaskRow).join(''))+listPageFooter(page);
 renderTodayOverview();
 list.innerHTML=items.length?renderedItems:'<div class="workspace-empty"><div><div class="workspace-empty-icon">✓</div><h3>'+escapeHtml(search?'No matching tasks':info.emptyTitle)+'</h3><p>'+escapeHtml(search?'Try another search term.':info.emptyText)+'</p></div></div>';
}
function renderWorkspaceView(){
 const isInsights=workspaceView==='insights',isSettings=workspaceView==='settings',isPlan=workspaceView==='plan',isCalendar=workspaceView==='calendar',isMatrix=workspaceView==='matrix',isBoard=workspaceView==='board',isFilters=workspaceView==='filters';
 const taskWorkspace=$('taskWorkspace'),matrix=$('priorityMatrix'),board=$('kanbanBoard'),filters=$('filtersWorkspace');
 if(taskWorkspace)taskWorkspace.hidden=isInsights||isSettings||isPlan||isCalendar||isMatrix||isBoard||isFilters;
 $('insightsWorkspace').hidden=!isInsights;$('settingsWorkspace').hidden=!isSettings;renderExperience();
 if($('planWorkspace'))$('planWorkspace').hidden=!isPlan;
 if(isPlan)window.WeekwisePlanUI?.render();
 if(matrix)matrix.hidden=!isMatrix;
 if(board)board.hidden=!isBoard;
 if(filters)filters.hidden=!isFilters;
 ['calendarToolbar','mobileDayPicker','mobileHelp','daysGrid','dashboard','unscheduledBox'].forEach(id=>{const el=$(id);if(el)el.hidden=!isCalendar;});
 document.querySelectorAll('[data-workspace-view]').forEach(button=>{const active=button.dataset.workspaceView===workspaceView;button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false');});
 syncWorkspaceLists();renderWorkspaceFolders();renderWorkspaceTags();renderWorkspaceTasks();updateWorkspaceCounts();
 if(isMatrix)renderPriorityMatrix();
 if(isBoard)renderKanbanBoard();
 if(isFilters)renderSavedFilters();
}
function setWorkspaceView(view){
 if(!['search','today','tomorrow','inbox','upcoming','board','filters','plan','insights','settings','calendar','matrix','list-career','list-study','list-work','list-personal','list-language','list-hobbies','list-other'].includes(view)&&!WORKSPACE_LISTS.some(list=>list.view===view)&&!(typeof view==='string'&&(view.startsWith('folder:')||view.startsWith('tag:'))))return;
 if(workspaceView!==view)saveCurrent();workspaceView=view;try{localStorage.setItem('weekwise-workspace-view-v1',view);}catch(_){}
 renderWorkspaceView();if(view==='calendar')renderAll();if(view==='search')setTimeout(()=>$('workspaceSearch')?.focus(),0);
}
function openWorkspaceRecord(id,week){
 if(week!==currentWeek){saveCurrent();loadWeek(week);}
 const t=tasks.find(x=>x.id===id);if(!t)return;if(t.fixed){openFixedSettings(id);return;}
 const viewDefault=workspaceView==='inbox'?'inbox':workspaceView.startsWith('list-')?workspaceView.slice(5):null;
 openTaskModal(id,t.day,t.start,viewDefault);
}
function updateWorkspaceRecord(id,week,action,subtaskIndex=null){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 let item=null;
 if(week!==currentWeek){const saved=store.weeks[week];item=Array.isArray(saved?.tasks)?saved.tasks.find(t=>t.id===id):null;}
 else item=tasks.find(t=>t.id===id);
 if(!item)return;
 if(action==='delete'){
  if(!confirm('Delete this task?'))return;
  if(item.seriesId){const template=(store.recurringTemplates||[]).find(x=>x.id===item.seriesId);if(template){template.excludedDates=Array.isArray(template.excludedDates)?template.excludedDates:[];template.excludedDates.push(item.occurrenceDate||dateKey(dayDate(week,item.day)));}}
  if(week!==currentWeek){store.weeks[week].tasks=store.weeks[week].tasks.filter(t=>t.id!==id);}else tasks=tasks.filter(t=>t.id!==id);
 }else if(action==='toggle'){
  item.done=!item.done;item.status=item.done?'done':(item.status==='done'?'todo':(item.status||'todo'));
 }else if(action==='toggle-subtask'){
  const index=Number(subtaskIndex),subs=Array.isArray(item.subtasks)?item.subtasks:[];
  if(!Number.isInteger(index)||index<0||index>=subs.length)return;
  const sub=subs[index];
  if(typeof sub==='string')subs[index]={id:uid(),title:sub,done:true};else sub.done=!sub.done;
  item.subtasks=subs;
  const allDone=subs.length>0&&subs.every(s=>typeof s==='object'&&!!s.done);
  item.done=allDone;item.status=allDone?'done':'todo';
 }
 if(action==='toggle-subtask'){const sub=item.subtasks?.[Number(subtaskIndex)];if(sub?.taskId){const child=workspaceRecords().find(r=>r.task.id===sub.taskId);if(child){child.task.done=!!sub.done;child.task.status=sub.done?'done':'todo';}}}reconcileSplitTasks();saveCurrent();
 renderAll();
}
function wireWorkspaceControls(){
 $('workspaceSidebar').addEventListener('click',e=>{
  const rename=e.target.closest('[data-custom-list-rename]');if(rename){renameCustomList(rename.dataset.customListRename);return;}
  const remove=e.target.closest('[data-custom-list-delete]');if(remove){deleteCustomList(remove.dataset.customListDelete);return;}
  const button=e.target.closest('[data-workspace-view]');if(button){setWorkspaceView(button.dataset.workspaceView);return;}
  const action=e.target.closest('[data-workspace-action]')?.dataset.workspaceAction;
  if(action==='create-list')createCustomList();
  if(action==='habits'){renderHabitTracker();openUtilityPanel('routineDetails','Habits & routines');}
  if(action==='focus'){renderFocusPanel();openUtilityPanel('focusPanel','Focus timer');}
  if(action==='countdowns'){renderCountdowns();openUtilityPanel('countdownsPanel','Countdowns');}
  if(action==='statistics')openDashboard();
 });
 $('workspaceCaptureForm').addEventListener('submit',e=>{e.preventDefault();quickCaptureWorkspaceTask();});
 $('workspaceExportListBtn').addEventListener('click',exportCurrentTaskList);
 $('workspaceImportListBtn').addEventListener('click',()=>$('workspaceImportListFile').click());
 $('workspaceImportListFile').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await importSharedTaskList(file);});
 $('copyTaskPlanningPromptBtn').addEventListener('click',copyTaskPlanningPrompt);
 $('voiceCaptureBtn').addEventListener('click',toggleVoiceCapture);
 $('workspaceAddTaskBtn').addEventListener('click',()=>{const def=workspaceView==='inbox'?'inbox':workspaceView.startsWith('list-')?workspaceView.slice(5):workspaceView.startsWith('folder:')?(workspaceRecords().find(r=>(r.task.folderName||defaultFolderName(r.listId))===workspaceView.slice(7))?.listId||'other'):workspaceView.startsWith('tag:')?(workspaceRecords().find(r=>(Array.isArray(r.task.tags)?r.task.tags:[]).some(tag=>String(tag).replace(/^#/,'').toLowerCase()===workspaceView.slice(4).toLowerCase()))?.listId||'other'):null;const tomorrow=workspaceView==='tomorrow';const targetDay=tomorrow?addDaysForView(now,1).getDay():workspaceView==='today'?now.getDay():mobileDay;const targetStart=workspaceView==='inbox'?null:tomorrow?10*60:nextQuarterHour();openTaskModal(null,targetDay,targetStart,def);});
 $('addCustomListBtn').addEventListener('click',createCustomList);
 $('workspaceSearch').addEventListener('input',renderWorkspaceTasks);$('workspaceSort').addEventListener('change',renderWorkspaceTasks);
 $('workspaceTaskList').addEventListener('change',e=>{const sub=e.target.closest('[data-workspace-subtask]');if(sub){updateWorkspaceRecord(sub.dataset.workspaceSubtask,sub.dataset.workspaceWeek,'toggle-subtask',Number(sub.dataset.workspaceSubtaskIndex));return;}const control=e.target.closest('[data-workspace-done]');if(control)updateWorkspaceRecord(control.dataset.workspaceDone,control.dataset.workspaceWeek,'toggle');});
 $('workspaceTaskList').addEventListener('click',e=>{const edit=e.target.closest('[data-workspace-edit]');if(edit){openWorkspaceRecord(edit.dataset.workspaceEdit,edit.dataset.workspaceWeek);return;}const del=e.target.closest('[data-workspace-delete]');if(del)updateWorkspaceRecord(del.dataset.workspaceDelete,del.dataset.workspaceWeek,'delete');});
$('kanbanBoard').addEventListener('change',e=>{const select=e.target.closest('[data-board-status]');if(select)updateBoardTaskStatus(select.dataset.boardStatus,select.dataset.boardWeek,select.value);});
$('kanbanBoard').addEventListener('click',e=>{const edit=e.target.closest('[data-board-edit]');if(edit)openWorkspaceRecord(edit.dataset.boardEdit,edit.dataset.boardWeek);});
$('kanbanAddTaskBtn').addEventListener('click',()=>openTaskModal(null,mobileDay,nextQuarterHour()));
$('savedFilterForm').addEventListener('submit',saveFilterForm);
$('savedFilterList').addEventListener('click',e=>{
 const open=e.target.closest('[data-filter-open]');
 if(open){activeSavedFilterId=open.dataset.filterOpen;renderSavedFilters();return;}
 const remove=e.target.closest('[data-filter-delete]');if(remove)deleteSavedFilter(remove.dataset.filterDelete);
});
$('savedFilterResults').addEventListener('click',e=>{
 const edit=e.target.closest('[data-workspace-edit]');if(edit){openWorkspaceRecord(edit.dataset.workspaceEdit,edit.dataset.workspaceWeek);return;}
 const del=e.target.closest('[data-workspace-delete]');if(del)updateWorkspaceRecord(del.dataset.workspaceDelete,del.dataset.workspaceWeek,'delete');
});
$('savedFilterResults').addEventListener('change',e=>{
 const sub=e.target.closest('[data-workspace-subtask]');if(sub){updateWorkspaceRecord(sub.dataset.workspaceSubtask,sub.dataset.workspaceWeek,'toggle-subtask',Number(sub.dataset.workspaceSubtaskIndex));return;}
 const control=e.target.closest('[data-workspace-done]');if(control)updateWorkspaceRecord(control.dataset.workspaceDone,control.dataset.workspaceWeek,'toggle');
});
$('priorityMatrix').addEventListener('change',e=>{const c=e.target.closest('[data-matrix-done]');if(c)updateWorkspaceRecord(c.dataset.matrixDone,c.dataset.matrixWeek,'toggle');});
$('priorityMatrix').addEventListener('click',e=>{const b=e.target.closest('[data-matrix-edit]');if(b)openWorkspaceRecord(b.dataset.matrixEdit,b.dataset.matrixWeek);});
$('matrixAddTaskBtn').addEventListener('click',()=>openTaskModal(null,mobileDay,nextQuarterHour()));
$('focusPreset').addEventListener('change',()=>{const state=ensureFocusState();if(state.runningSince===null&&state.activeMs===0){focusState=freshFocus('focus',Number($('focusPreset').value)*60);persistActiveFocus();renderFocusPanel();}});
$('focusTaskSelect').addEventListener('change',renderFocusPanel);
$('focusStartBtn').addEventListener('click',focusStartPause);
$('focusResetBtn').addEventListener('click',focusReset);
$('focusBreakBtn').addEventListener('click',()=>focusTakeBreak(false));
 $('focusLongBreakBtn')?.addEventListener('click',()=>focusTakeBreak(true));
 $('focusFinishBtn')?.addEventListener('click',focusComplete);
$('enableTaskNotificationsBtn').addEventListener('click',enableTaskNotifications);
renderTaskNotificationSettings();
$('habitForm').addEventListener('submit',saveHabitForm);
$('cancelHabitEdit').addEventListener('click',habitFormReset);
$('habitTrackerList').addEventListener('click',e=>{
 const skip=e.target.closest('[data-habit-skip]');if(skip){skipHabitToday(skip.dataset.habitSkip);return;}const check=e.target.closest('[data-habit-check]');if(check){toggleHabitCheck(check.dataset.habitCheck,check.dataset.habitDate);return;}
 const edit=e.target.closest('[data-habit-edit]');if(edit){editHabit(edit.dataset.habitEdit);return;}
 const del=e.target.closest('[data-habit-delete]');if(del)deleteHabit(del.dataset.habitDelete);
});
}


const FOCUS_SESSIONS_KEY='weekwise-focus-sessions-v1';
let focusSessions=WeekwiseData.readCollection(localStorage,FOCUS_SESSIONS_KEY);
let focusState=null,focusInterval=null;
function zoneNeedsReview(){return !!store.settings.timeZone&&store.settings.timeZone!==Intl.DateTimeFormat().resolvedOptions().timeZone;}
function renderZoneNotice(){let notice=$('timeZoneNotice');if(!zoneNeedsReview()){notice?.remove();return;}if(!notice){notice=document.createElement('aside');notice.id='timeZoneNotice';notice.className='zone-notice';notice.setAttribute('role','status');notice.innerHTML='<span></span><button class="btn" type="button">Use this device’s time zone</button>';document.querySelector('.topbar').after(notice);notice.querySelector('button').onclick=()=>{if(!confirm('Use '+Intl.DateTimeFormat().resolvedOptions().timeZone+' for this planner? Saved calendar times stay at the same clock time (09:00 stays 09:00). They are not converted between zones. Review reminder timestamps after changing.'))return;store.settings.timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;saveStore();renderAll();};}notice.querySelector('span').textContent='This planner was saved in '+store.settings.timeZone+'. This device uses '+Intl.DateTimeFormat().resolvedOptions().timeZone+'. Editing and reminder checks are paused until you review the time zone.';}
function dataCanWrite(){if(zoneNeedsReview()){renderZoneNotice();showToast('Review the time zone notice before changing your planner.');return false;}if(cloudUser&&currentDataOwner!==cloudUser.id){showToast('Your account is changing. Wait until its planner is ready.');return false;}if(plannerStorageBlocked||WeekwiseData.blockedKeys().length){showToast('Editing is paused to protect stored data. Restore a valid backup using the recovery notice.');return false;}return true;}
function focusOwner(){return currentDataOwner;}
function focusStateKey(){return 'weekwise-focus-active-v1:'+focusOwner();}
function freshFocus(mode='focus',seconds=1500,task=null){return WeekwiseFocus.create({id:uid(),owner:focusOwner(),mode,seconds,task});}
function restoreFocusState(){
 const saved=WeekwiseData.readJSON(localStorage,focusStateKey(),WeekwiseFocus.validate,null);
 focusState=saved&&saved.owner===focusOwner()?saved:freshFocus();
 if(focusInterval!==null)clearInterval(focusInterval);
 focusInterval=setInterval(focusTick,1000);renderFocusPanel();if(WeekwiseData.blockedKeys().length)showStorageRecoveryNotice();
}
function ensureFocusState(){if(!focusState||focusState.owner!==focusOwner())restoreFocusState();return focusState;}
function persistActiveFocus(){try{WeekwiseData.commitStorage(localStorage,[[focusStateKey(),JSON.stringify(focusState)]]);return true;}catch(_){showToast('Could not save this focus timer. Your previous session remains on this device.');return false;}}

function renderMatrixTask(record){
 const t=record.task,attrs=' data-matrix-week="'+escapeHtml(record.week)+'"';
 return '<article class="matrix-task"><input type="checkbox" data-matrix-done="'+escapeHtml(t.id)+'"'+attrs+' '+(t.done?'checked':'')+' aria-label="Complete '+escapeHtml(t.title)+'"><div><button type="button" class="matrix-task-title" data-matrix-edit="'+escapeHtml(t.id)+'"'+attrs+'>'+escapeHtml(t.title)+'</button><div class="matrix-task-meta">'+escapeHtml(record.listId==='inbox'?'Inbox':(WORKSPACE_LISTS.find(x=>x.id===record.listId)?.label||'Task'))+(t.dueDate?' · Due '+escapeHtml(fmtDate(parseKey(t.dueDate),{day:'numeric',month:'short'})):'')+'</div></div><button type="button" class="matrix-task-edit" title="Edit classification" aria-label="Edit '+escapeHtml(t.title)+'" data-matrix-edit="'+escapeHtml(t.id)+'"'+attrs+'>✎</button></article>';
}
function renderPriorityMatrix(){
 const lists={do:[],schedule:[],delegate:[],later:[],unclassified:[]};
 workspaceRecords().filter(r=>!r.task.done).forEach(r=>{
  const imp=r.task.importance,urg=r.task.urgency;
  if(!['important','not-important'].includes(imp)||!['urgent','not-urgent'].includes(urg)){lists.unclassified.push(r);return;}
  if(imp==='important'&&urg==='urgent')lists.do.push(r);
  else if(imp==='important'&&urg==='not-urgent')lists.schedule.push(r);
  else if(imp==='not-important'&&urg==='urgent')lists.delegate.push(r);
  else lists.later.push(r);
 });
 [['matrixDoList',lists.do],['matrixScheduleList',lists.schedule],['matrixDelegateList',lists.delegate],['matrixLaterList',lists.later],['matrixUnclassifiedList',lists.unclassified]].forEach(([id,items])=>{const el=$(id),page=listPage('matrix:'+id,items);if(el)el.innerHTML=items.length?page.records.map(renderMatrixTask).join('')+listPageFooter(page):'<div class="matrix-empty">No tasks here yet.</div>';});
 $('matrixUnclassifiedCount').textContent=String(lists.unclassified.length);
}
function taskLoggedFocusMinutes(taskId){return Math.round(focusSessions.filter(s=>s.taskId===taskId).reduce((total,s)=>total+Number(s.minutes||0),0));}
function renderFocusPanel(){
 const select=$('focusTaskSelect');if(!select)return;
 const state=ensureFocusState();
 const prior=state.task?(state.task.week+'::'+state.task.id):select.value,records=workspaceRecords().filter(r=>!r.task.done).sort((a,b)=>a.date-b.date);
 select.innerHTML='<option value="">No linked task</option>'+records.map(r=>'<option value="'+escapeHtml(r.week+'::'+r.task.id)+'">'+escapeHtml(r.task.title+' · '+fmtDate(r.date,{day:'numeric',month:'short'})+(r.task.focusEstimateMinutes?' · target '+r.task.focusEstimateMinutes+'m':''))+'</option>').join('');
 if([...select.options].some(o=>o.value===prior))select.value=prior;select.disabled=state.runningSince!==null||state.activeMs>0;
 const selected=select.value,split=selected.indexOf('::'),selectedWeek=split>=0?selected.slice(0,split):'',selectedId=split>=0?selected.slice(split+2):'';
 const selectedRecord=workspaceRecords().find(r=>r.week===selectedWeek&&r.task.id===selectedId);
 const targetHelp=$('focusTaskEstimateHelp');
 if(targetHelp){
  if(!selectedRecord)targetHelp.textContent='Choose a task to attach this focus session to.';
  else{
   const target=Number(selectedRecord.task.focusEstimateMinutes)||0,logged=taskLoggedFocusMinutes(selectedRecord.task.id);
   targetHelp.textContent=target?logged+' of '+target+' estimated focus minutes logged'+(logged>=target?' · estimate reached':''):'No focus estimate set. Edit the task to add one.';
  }
 }
 const totalFocus=focusSessions.reduce((n,s)=>n+Number(s.minutes||0),0),today=dateKey(now),todayFocus=focusSessions.filter(s=>dateKey(new Date(s.endedAt))===today).reduce((n,s)=>n+Number(s.minutes||0),0);
 const summary=$('focusSummary');if(summary)summary.innerHTML='<div class="focus-stat"><small>Focus time today</small><strong>'+durationText(todayFocus)+'</strong></div><div class="focus-stat"><small>Total focus time</small><strong>'+durationText(totalFocus)+'</strong></div><div class="focus-stat"><small>Completed sessions</small><strong>'+focusSessions.length+'</strong></div>';
 const history=$('focusHistory'),historyTotal=$('focusHistoryTotal');if(historyTotal)historyTotal.textContent=focusSessions.length+' session'+(focusSessions.length===1?'':'s');
 if(history)history.innerHTML=focusSessions.slice().reverse().slice(0,6).map(s=>'<div class="focus-history-row"><div><strong>'+escapeHtml(s.taskTitle||'Focus session')+'</strong><small>'+escapeHtml(new Date(s.endedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+'</small></div><span>'+Math.round(Number(s.minutes)||0)+' min</span></div>').join('')||'<div class="matrix-empty">Your completed focus sessions will appear here.</div>';
 updateFocusDisplay();
}
function persistFocusSessions(){checkedCollectionSave(FOCUS_SESSIONS_KEY,focusSessions,value=>focusSessions=value);}
function updateFocusDisplay(){
 const state=ensureFocusState(),seconds=WeekwiseFocus.remaining(state),clock=$('focusClock');if(!clock)return;
 clock.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
 $('focusModeLabel').textContent=state.mode==='focus'?'FOCUS TIME':state.mode==='long-break'?'LONG BREAK':'SHORT BREAK';
 $('focusProgressBar').style.width=(seconds/state.totalSeconds*100)+'%';
 $('focusStartBtn').textContent=state.runningSince!==null?'Pause':state.activeMs>0?'Resume':'Start '+(state.mode==='focus'?'focus':'break');
 $('focusTimerMessage').textContent=state.runningSince!==null?'Your timer continues across reloads. Paused time is excluded.':'Choose one task. Your timer is saved on this device.';
 $('focusTaskSelect').disabled=state.runningSince!==null||state.activeMs>0;
}
function focusComplete(){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const state=ensureFocusState();if(state.logged)return;
 const result=WeekwiseFocus.finish(state),next=focusSessions.slice();
 if(result.record&&!next.some(record=>record.id===result.record.id))next.push(result.record);
 const following=freshFocus(state.mode==='focus'?'break':'focus',state.mode==='focus'?300:Number($('focusPreset').value||25)*60);
 try{WeekwiseData.commitStorage(localStorage,[[FOCUS_SESSIONS_KEY,JSON.stringify(next)],[focusStateKey(),JSON.stringify(following)]]);}
 catch(error){focusState=WeekwiseFocus.pause(state);showToast(error.message);updateFocusDisplay();return;}
 focusSessions=next;focusState=following;queueCloudSave();renderFocusPanel();renderWorkspaceTasks();
 showToast(result.record?'Focus time recorded. Take a break when you are ready.':'Break finished. Ready for another focus session?');
}
function focusTick(){if(!focusState||focusState.owner!==focusOwner())return;if(focusState.runningSince!==null&&WeekwiseFocus.remaining(focusState)===0)focusComplete();else updateFocusDisplay();}
function focusStartPause(){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 let state=ensureFocusState();
 if(state.runningSince===null&&state.activeMs===0&&state.mode==='focus'){
  const ref=$('focusTaskSelect').value,split=ref.indexOf('::'),week=split<0?'':ref.slice(0,split),id=split<0?'':ref.slice(split+2),record=workspaceRecords().find(r=>r.week===week&&r.task.id===id);
  state={...state,totalSeconds:Number($('focusPreset').value||25)*60,task:record?{id,week,title:record.task.title}:null};
 }
 const prior=focusState;focusState=state.runningSince===null?WeekwiseFocus.resume(state):WeekwiseFocus.pause(state);
 if(!persistActiveFocus())focusState=prior;updateFocusDisplay();
}
function focusReset(){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}const state=ensureFocusState();if((state.runningSince!==null||state.activeMs>0)&&!confirm('Reset this timer? Unrecorded focus time will be discarded. Use Finish session to save it.'))return;focusState=freshFocus('focus',Number($('focusPreset').value||25)*60);persistActiveFocus();renderFocusPanel();}
function focusTakeBreak(long=false){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}const state=ensureFocusState();if(state.mode==='focus'&&WeekwiseFocus.elapsed(state)>0&&!state.logged){if(!confirm('Finish and record the current focus session before your break?'))return;focusComplete();}focusState=freshFocus(long?'long-break':'break',long?900:300);persistActiveFocus();renderFocusPanel();}


const HABITS_KEY='weekwise-habits-v1';
let habits=WeekwiseData.readCollection(localStorage,HABITS_KEY);
function habitWeekRange(){const start=sundayOf(now),end=new Date(start);end.setDate(end.getDate()+6);return fmtDate(start,{day:'numeric',month:'short'})+' – '+fmtDate(end,{day:'numeric',month:'short'});}
function habitWeekKeys(){const start=sundayOf(now);return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return dateKey(d);});}
function habitCountThisWeek(habit){const keys=new Set(habit.checkIns||[]);return habitWeekKeys().filter(k=>keys.has(k)).length;}
function habitStreak(habit){return WeekwiseHabits.streak(habit,dateKey(now));}
function habitHistoryDots(habit){const checks=new Set(habit.checkIns||[]);let markup='';for(let i=27;i>=0;i--){const d=dateOnly(now);d.setDate(d.getDate()-i);const key=dateKey(d);markup+='<span class="habit-history-dot '+(checks.has(key)?'checked':'')+'" title="'+escapeHtml(fmtDate(d,{weekday:'short',day:'numeric',month:'short'}))+(checks.has(key)?' · completed':'')+'"></span>';}return markup;}
function renderHabitTracker(){
 const list=$('habitTrackerList');if(!list)return;
 const range=$('habitWeekRange');if(range)range.textContent=habitWeekRange();
 const total=habits.length,completed=habits.filter(h=>habitCountThisWeek(h)>=Math.max(1,Number(h.targetPerWeek)||1)).length;
 const summary=$('habitTrackerSummary');if(summary)summary.innerHTML=total?'<span><strong>'+completed+'/'+total+'</strong> habits at weekly target</span><span>Last 28 days · check in on any day</span>':'<span>No habits yet. Add a habit to start your progress history.</span>';
 if(!total){list.innerHTML='<div class="habit-empty-state"><strong>Build consistency, one check-in at a time.</strong><p>Create a habit above, choose a weekly target, then tap each day you complete it. Your check-ins and 28-day history are saved.</p></div>';return;}
 const keys=habitWeekKeys(),todayKey=dateKey(now);
 list.innerHTML=habits.map(h=>{
  const checks=new Set(h.checkIns||[]),done=keys.filter(k=>checks.has(k)).length,target=Math.max(1,Math.min(7,Number(h.targetPerWeek)||5)),pct=Math.min(100,Math.round(done/target*100));
  const days=keys.map(k=>{const d=parseKey(k),checked=checks.has(k),isToday=k===todayKey,isFuture=k>todayKey,isRest=!WeekwiseHabits.due(h,k);return '<button type="button" class="habit-checkin-day '+(checked?'checked ':'')+(isToday?'today':'')+'" data-habit-check="'+escapeHtml(h.id)+'" data-habit-date="'+k+'" aria-pressed="'+(checked?'true':'false')+'" '+((isFuture||h.paused)?'disabled':'')+' title="'+escapeHtml(fmtDate(d,{weekday:'long',day:'numeric',month:'short'}))+(h.paused?' · paused':isRest?' · rest or skipped day':isFuture?' · future day':checked?' · done':' · mark done')+'"><span>'+DAY_SHORT[d.getDay()]+'</span><strong>'+(checked?'✓':isRest?'—':d.getDate())+'</strong></button>';}).join('');
  const targetText='Target '+target+' time'+(target===1?'':'s')+' per week';
  return '<article class="habit-track-card" data-habit-card="'+escapeHtml(h.id)+'"><header class="habit-track-head"><span class="habit-track-icon">'+escapeHtml(h.icon||'✦')+'</span><div class="habit-track-info"><h4>'+escapeHtml(h.title)+'</h4><p>'+escapeHtml(h.goal||targetText)+'</p></div><div class="habit-track-actions"><button type="button" data-habit-edit="'+escapeHtml(h.id)+'" aria-label="Edit '+escapeHtml(h.title)+'" title="Edit habit">✎</button><button type="button" data-habit-delete="'+escapeHtml(h.id)+'" aria-label="Delete '+escapeHtml(h.title)+'" title="Delete habit">×</button></div></header>'+
  '<div class="habit-track-progress"><div class="habit-track-progress-track"><span style="width:'+pct+'%"></span></div><strong>'+done+'/'+target+'</strong></div><div class="habit-checkin-days" aria-label="Daily habit check-ins">'+days+'</div>'+
  '<div class="plan-actions"><button class="btn" type="button" data-habit-skip="'+escapeHtml(h.id)+'">'+((h.skippedDates||[]).includes(todayKey)?'Restore today':'Skip today')+'</button></div><footer class="habit-track-foot"><span>'+(habitStreak(h)?'🔥 '+habitStreak(h)+' day streak':'28-day history')+'</span><div class="habit-history-dots"><span class="habit-history-label">History</span>'+habitHistoryDots(h)+'</div></footer></article>';
 }).join('');
}
function persistHabits(){checkedCollectionSave(HABITS_KEY,habits,value=>habits=value);}
function habitFormReset(){document.querySelectorAll('[name=habitDay]').forEach(el=>el.checked=true);$('habitPaused').checked=false;$('habitReminderTime').value='';$('habitEditId').value='';$('habitName').value='';$('habitIcon').value='';$('habitGoal').value='';$('habitTargetPerWeek').value='5';$('saveHabitBtn').textContent='＋ Add habit';$('cancelHabitEdit').hidden=true;}
function saveHabitForm(e){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 e.preventDefault();const title=$('habitName').value.trim();if(!title){$('habitName').focus();return;}
 const scheduledDays=[...document.querySelectorAll('[name=habitDay]:checked')].map(el=>Number(el.value)),paused=$('habitPaused').checked,reminderTime=$('habitReminderTime').value;if(!scheduledDays.length){showToast('Choose at least one scheduled day.');return;}
 const id=$('habitEditId').value,icon=$('habitIcon').value.trim()||'✦',goal=$('habitGoal').value.trim(),targetPerWeek=Math.max(1,Math.min(7,Number($('habitTargetPerWeek').value)||5));
 if(id){const habit=habits.find(h=>h.id===id);if(habit)Object.assign(habit,{title,icon,goal,targetPerWeek,scheduledDays,paused,reminderTime,updatedAt:new Date().toISOString()});}
 else habits.push({id:'h'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),title,icon,goal,targetPerWeek,scheduledDays,paused,reminderTime,skippedDates:[],checkIns:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 persistHabits();habitFormReset();renderHabitTracker();showToast(id?'Habit updated':'Habit added');
}
function editHabit(id){const habit=habits.find(h=>h.id===id);if(!habit)return;document.querySelectorAll('[name=habitDay]').forEach(el=>el.checked=(habit.scheduledDays||[0,1,2,3,4,5,6]).includes(Number(el.value)));$('habitPaused').checked=!!habit.paused;$('habitReminderTime').value=habit.reminderTime||'';$('habitEditId').value=habit.id;$('habitName').value=habit.title||'';$('habitIcon').value=habit.icon||'';$('habitGoal').value=habit.goal||'';$('habitTargetPerWeek').value=String(habit.targetPerWeek||5);$('saveHabitBtn').textContent='Save changes';$('cancelHabitEdit').hidden=false;$('habitName').focus();}
function toggleHabitCheck(id,date){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}const habit=habits.find(h=>h.id===id);if(!habit||habit.paused||date>dateKey(now))return;const checks=new Set(habit.checkIns||[]);if(checks.has(date))checks.delete(date);else checks.add(date);habit.checkIns=[...checks].sort();habit.updatedAt=new Date().toISOString();persistHabits();renderHabitTracker();}
function skipHabitToday(id){if(!dataCanWrite())return;const h=habits.find(h=>h.id===id),today=dateKey(now);if(!h||h.paused)return;if((h.checkIns||[]).includes(today)){showToast('Today is already completed. Its check-in is preserved.');return;}const dates=new Set(h.skippedDates||[]);if(dates.has(today))dates.delete(today);else dates.add(today);h.skippedDates=[...dates].sort();persistHabits();renderHabitTracker();}
function checkHabitReminders(){if(!dataCanWrite()||document.hidden)return;const today=dateKey(new Date()),d=new Date(),minute=d.getHours()*60+d.getMinutes();let changed=false;for(const h of habits){if(!h.reminderTime||!WeekwiseHabits.due(h,today)||(h.checkIns||[]).includes(today)||h.lastReminderDate===today||timeMins(h.reminderTime)>minute)continue;showToast('Habit reminder: '+h.title);h.lastReminderDate=today;changed=true;}if(changed)persistHabits();}
function deleteHabit(id){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}const habit=habits.find(h=>h.id===id);if(!habit)return;if(!confirm('Delete the habit "'+habit.title+'"? Its check-in history will also be removed.'))return;habits=habits.filter(h=>h.id!==id);persistHabits();renderHabitTracker();showToast('Habit deleted');}


function addDaysToKey(key,delta){const d=parseKey(key);d.setDate(d.getDate()+delta);return dateKey(d);}
function recurrenceDateMatches(template,date){
 const anchor=parseKey(template.startDate),key=dateKey(date);
 if(key<template.startDate||(template.endDate&&key>template.endDate))return false;
 if(template.frequency==='daily')return true;
 if(template.frequency==='weekly')return date.getDay()===anchor.getDay();
 if(template.frequency==='monthly'){const last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();return date.getDate()===Math.min(anchor.getDate(),last);}
 if(template.frequency==='yearly'){const last=new Date(date.getFullYear(),anchor.getMonth()+1,0).getDate();return date.getMonth()===anchor.getMonth()&&date.getDate()===Math.min(anchor.getDate(),last);}
 return false;
}
function stopRecurringSeries(task,fromDate,scope='future'){
 const seriesId=task?.seriesId;if(!seriesId)return;
 const rule=store.recurringTemplates.find(t=>t.id===seriesId);if(rule){rule.endDate=scope==='series'?addDaysToKey(rule.startDate,-1):addDaysToKey(fromDate,-1);rule.updatedAt=new Date().toISOString();}
 task.recurrence='none';task.recurrenceOverride=true;
 // Keep every materialized occurrence, including completed and edited history.
}
function upsertRecurringTemplate(id,occurrenceDate,fields){
 if(!Array.isArray(store.recurringTemplates))store.recurringTemplates=[];
 const dueOffsetDays=fields.dueDate?Math.round((parseKey(fields.dueDate)-parseKey(occurrenceDate))/86400000):null;
 const reminderValues=Array.isArray(fields.reminderTimes)&&fields.reminderTimes.length?fields.reminderTimes:(fields.reminderAt?[fields.reminderAt]:[]);
 const reminderRules=reminderValues.map(value=>({offsetDays:Math.round((parseKey(value.slice(0,10))-parseKey(occurrenceDate))/86400000),time:value.slice(11,16)})).filter(rule=>/^\d{2}:\d{2}$/.test(rule.time));
 const reminderOffsetDays=reminderRules[0]?.offsetDays??null,reminderTime=reminderRules[0]?.time??null;
 let template=store.recurringTemplates.find(item=>item.id===id);
 const value={id,startDate:occurrenceDate,frequency:fields.recurrence,schedulingMode:fields.schedulingMode||'flexible',estimatedDurationMinutes:fields.estimatedDurationMinutes??null,requiresCompletion:fields.requiresCompletion!==false,title:fields.title,type:fields.type,duration:fields.duration,start:fields.start,allDay:!!fields.allDay,note:fields.note,listId:fields.listId,folderName:fields.folderName,sectionName:fields.sectionName,priority:fields.priority,status:'todo',focusEstimateMinutes:fields.focusEstimateMinutes??null,importance:fields.importance,urgency:fields.urgency,dueOffsetDays,reminderOffsetDays,reminderTime,reminderRules,tags:[...(fields.tags||[])],attachments:[...(fields.attachments||[])],subtasks:(fields.subtasks||[]).map(s=>({...s,done:false})),excludedDates:template?.excludedDates||[],createdAt:template?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(template)Object.assign(template,value);else{template=value;store.recurringTemplates.push(template);}
 return template;
}
function materializeRecurringRange(rangeStart,rangeEnd){
 const templates=Array.isArray(store.recurringTemplates)?store.recurringTemplates.slice():[];
 if(!templates.length||!rangeStart||!rangeEnd)return;
 const start=new Date(rangeStart),end=new Date(rangeEnd);
 const occurrences=new Map();for(const record of workspaceRecords()){const t=record.task;if(t.seriesId&&t.occurrenceDate)occurrences.set(t.seriesId+'::'+t.occurrenceDate,t);}
 for(let date=new Date(start);date<=end;date.setDate(date.getDate()+1)){
  const occurrenceDate=dateKey(date),day=date.getDay(),weekKey=dateKey(sundayOf(date));
  for(const template of templates){
   if(!template||!template.id||!recurrenceDateMatches(template,date)||(template.excludedDates||[]).includes(occurrenceDate))continue;
   let rows;
   if(weekKey===currentWeek)rows=tasks;
   else{
    if(!store.weeks[weekKey]||!Array.isArray(store.weeks[weekKey].tasks))store.weeks[weekKey]={...(store.weeks[weekKey]||{}),tasks:[]};
    rows=store.weeks[weekKey].tasks;
   }
   let existing=occurrences.get(template.id+'::'+occurrenceDate);
   // Saved occurrences include edits, completion history and reminder exceptions.
   if(existing)continue;
   const duration=Math.max(10,Number(template.duration)||30),preferred=template.start===null||template.start===undefined?null:Number(template.start);
   let startTime=null;
   if(preferred!==null){
    const blockers=rows.filter(item=>item!==existing&&Number(item.day)===day&&item.start!==null&&item.start!==undefined&&!item.unscheduled&&Number(item.duration)>0);
    startTime=findSlot(day,duration,preferred,0,1440,blockers);
   }
   const dueDate=template.dueOffsetDays===null||template.dueOffsetDays===undefined?null:addDaysToKey(occurrenceDate,Number(template.dueOffsetDays)||0);
   const reminderRules=Array.isArray(template.reminderRules)?template.reminderRules:(template.reminderTime?[{offsetDays:template.reminderOffsetDays||0,time:template.reminderTime}]:[]);
   const reminderTimes=reminderRules.map(rule=>addDaysToKey(occurrenceDate,Number(rule.offsetDays)||0)+'T'+rule.time).filter(Boolean);
   const reminderAt=reminderTimes[0]||null;
   const priorNotified=[...(Array.isArray(existing?.reminderNotifiedTimes)?existing.reminderNotifiedTimes:[])];if(existing?.reminderNotifiedAt)priorNotified.push(existing.reminderNotifiedAt);
   const reminderNotifiedTimes=[...new Set(priorNotified.filter(value=>reminderTimes.includes(value)))];
   const values={day,title:template.title,type:template.type||'other',duration,start:startTime,allDay:!!template.allDay,allDayDate:template.allDay?occurrenceDate:null,folderName:template.folderName||defaultFolderName(template.listId||'other'),sectionName:template.sectionName||'',done:!!existing?.done,status:existing?.done?'done':(existing?.status==='in-progress'?'in-progress':'todo'),focusEstimateMinutes:template.focusEstimateMinutes??null,estimatedDurationMinutes:template.estimatedDurationMinutes??null,requiresCompletion:template.requiresCompletion!==false,custom:true,fixed:false,schedulingMode:template.schedulingMode||'flexible',note:template.note||'',unscheduled:!template.allDay&&startTime===null,seriesId:template.id,occurrenceDate,recurrence:template.frequency,listId:template.listId||'other',priority:template.priority||'none',importance:template.importance||'unclassified',urgency:template.urgency||'unclassified',dueDate,reminderAt,reminderTimes,reminderNotifiedTimes,reminderNotifiedAt:reminderNotifiedTimes.includes(reminderAt)?reminderAt:null,tags:[...(template.tags||[])],attachments:[...(template.attachments||[])],subtasks:(template.subtasks||[]).map(s=>({...s,done:!!(existing?.subtasks||[]).find(old=>old.id===s.id)?.done}))};
   if(existing)Object.assign(existing,values);
   else {const created={id:'rec_'+template.id+'_'+occurrenceDate.replace(/-/g,''),...values};rows.push(created);occurrences.set(template.id+'::'+occurrenceDate,created);}
  }
 }
}
function materializeCurrentAndUpcoming(){
 materializeRecurringRange(parseKey(currentWeek),parseKey(addDaysToKey(currentWeek,89)));
 saveCurrent();
}


function updateCalendarPeriodLabel(){
 const label=$('weekLabel');if(!label)return;
 if(calendarView==='year')label.textContent=String(calendarYear);
 else if(calendarView==='agenda'){const end=new Date(agendaAnchor);end.setDate(end.getDate()+29);label.textContent='Agenda · '+fmtDate(agendaAnchor,{day:'numeric',month:'short'})+' – '+fmtDate(end,{day:'numeric',month:'short'});}
 else if(calendarView==='month')label.textContent=monthAnchor.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
 else if(calendarView==='day')label.textContent=DAY_NAMES[mobileDay]+', '+fmtDate(dayDate(currentWeek,mobileDay),{day:'numeric',month:'short',year:'numeric'});
 else label.textContent=fmtDate(parseKey(currentWeek),{day:'numeric',month:'short'})+' – '+fmtDate(dayDate(currentWeek,6),{day:'numeric',month:'short',year:'numeric'});
}
function weekwiseRenderAgenda(){
 const grid=$('daysGrid');grid.classList.add('agenda-mode');grid.setAttribute('aria-label','Agenda view');
 const picker=$('mobileDayPicker'),help=$('mobileHelp');if(picker)picker.hidden=true;if(help)help.hidden=true;
 updateViewControls();
 const anchor=dateOnly(agendaAnchor||now),end=new Date(anchor);end.setDate(end.getDate()+30);
 const records=workspaceRecords().filter(r=>dateOnly(r.date)>=anchor&&dateOnly(r.date)<end).sort((a,b)=>a.date-b.date||(a.task.start==null?1:b.task.start==null?-1:Number(a.task.start)-Number(b.task.start)));
 const groups=new Map();records.forEach(r=>{const key=dateKey(r.date);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});
 const label=fmtDate(anchor,{day:'numeric',month:'short'})+' – '+fmtDate(new Date(end.getTime()-86400000),{day:'numeric',month:'short'});
 let markup='<div class="agenda-calendar"><div class="agenda-topline"><div><h3>Upcoming agenda</h3><p>'+escapeHtml(label)+' · grouped by day</p></div><span class="agenda-topline-badge">'+records.length+' tasks</span></div>';
 if(!groups.size)markup+='<div class="agenda-empty"><strong>Your upcoming agenda is clear.</strong><p>Add a task to Inbox or schedule an activity. Future recurring tasks appear here automatically.</p></div>';
 groups.forEach((items,key)=>{
  const date=parseKey(key),label=dateKey(date)===dateKey(now)?'Today':dateKey(date)===dateKey(addDaysForView(now,1))?'Tomorrow':fmtDate(date,{weekday:'long',day:'numeric',month:'short'});
  markup+='<section class="agenda-day-group"><header class="agenda-day-head"><div><h4>'+escapeHtml(label)+'</h4><small>'+escapeHtml(fmtDate(date,{day:'numeric',month:'long',year:'numeric'}))+'</small></div><span class="agenda-day-count">'+items.length+'</span></header>';
  items.forEach(r=>{
   const t=r.task,priority=t.priority||'none',listLabel=WORKSPACE_LISTS.find(x=>x.id===r.listId)?.label||'Inbox';
   const when=t.allDay?'All day':(t.start==null||t.unscheduled?'Not scheduled':minsTime(Number(t.start))+(Number(t.duration)>0?' · '+durationText(Number(t.duration)):''));
   const due=t.dueDate?'<span class="agenda-task-pill">Due '+escapeHtml(fmtDate(parseKey(t.dueDate),{day:'numeric',month:'short'}))+'</span>':'';
   const pr=priority!=='none'?'<span class="agenda-task-pill '+(priority==='high'?'high':priority==='medium'?'medium':'')+'">'+escapeHtml(({high:'↑ High',medium:'→ Medium',low:'↓ Low'})[priority]||priority)+'</span>':'';
   markup+='<article class="agenda-task-row '+(t.done?'is-done':'')+'"><span class="agenda-task-time">'+escapeHtml(when)+'</span><input class="agenda-task-check" type="checkbox" data-agenda-check="'+escapeHtml(t.id)+'" data-agenda-week="'+escapeHtml(r.week)+'" '+(t.done?'checked':'')+' aria-label="Complete '+escapeHtml(t.title)+'"><div><button type="button" class="agenda-task-title" data-agenda-edit="'+escapeHtml(t.id)+'" data-agenda-week="'+escapeHtml(r.week)+'">'+escapeHtml(t.title)+'</button><div class="agenda-task-meta"><span class="agenda-task-pill">'+escapeHtml(listLabel)+'</span>'+pr+due+'</div></div><button type="button" class="agenda-task-edit" title="Edit task" aria-label="Edit '+escapeHtml(t.title)+'" data-agenda-edit="'+escapeHtml(t.id)+'" data-agenda-week="'+escapeHtml(r.week)+'">✎</button></article>';
  });
  markup+='</section>';
 });
 markup+='</div>';
 grid.innerHTML=markup;grid.scrollTop=0;grid.scrollLeft=0;grid.dataset.hasRendered='true';
 grid.onclick=e=>{const b=e.target.closest('[data-agenda-edit]');if(b)openWorkspaceRecord(b.dataset.agendaEdit,b.dataset.agendaWeek);};
 grid.onchange=e=>{const b=e.target.closest('[data-agenda-check]');if(b)updateWorkspaceRecord(b.dataset.agendaCheck,b.dataset.agendaWeek,'toggle');};
}
function addDaysForView(value,days){const d=dateOnly(value);d.setDate(d.getDate()+days);return d;}
function weekwiseRenderYear(){
 const grid=$('daysGrid');grid.classList.add('year-mode');grid.setAttribute('aria-label','Year overview');
 const picker=$('mobileDayPicker'),help=$('mobileHelp');if(picker)picker.hidden=true;if(help)help.hidden=true;
 updateViewControls();
 const countByDate=new Map();workspaceRecords().forEach(r=>{const key=dateKey(r.date);countByDate.set(key,(countByDate.get(key)||0)+1);});
 let markup='<div class="agenda-calendar"><div class="agenda-topline"><div><h3>'+calendarYear+' at a glance</h3><p>Choose any date to open its Day view.</p></div><span class="agenda-topline-badge">12 months</span></div><div class="year-calendar">';
 for(let month=0;month<12;month++){
  const first=new Date(calendarYear,month,1),layout=WeekwiseCalendarLayout.month(calendarYear,month,store.settings.calendarGridStartDay),firstDay=layout.start,total=layout.count;
  markup+='<section class="year-month"><header class="year-month-head"><h3>'+first.toLocaleDateString('en-GB',{month:'long'})+'</h3><span>'+Array.from(countByDate.entries()).filter(([key])=>{const d=parseKey(key);return d.getFullYear()===calendarYear&&d.getMonth()===month;}).reduce((n,[,v])=>n+v,0)+' tasks</span></header><div class="year-month-grid">'+layout.weekdays.map(i=>'<span class="year-weekday">'+WeekwiseCalendarLayout.DAY_LETTER[i]+'</span>').join('');
  for(let i=0;i<total;i++){
   const date=new Date(firstDay);date.setDate(firstDay.getDate()+i);
   const key=dateKey(date),inMonth=date.getMonth()===month,n=countByDate.get(key)||0,today=key===dateKey(now);
   markup+='<button type="button" class="year-day '+(!inMonth?'outside ':'')+(today?'today ':'')+(n?'has-items':'')+'" data-year-date="'+key+'" title="'+escapeHtml(fmtDate(date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+(n?' · '+n+' tasks':'')+'">'+date.getDate()+'</button>';
  }
  markup+='</div></section>';
 }
 markup+='</div></div>';
 grid.innerHTML=markup;grid.scrollTop=0;grid.scrollLeft=0;grid.dataset.hasRendered='true';
 grid.onclick=e=>{const b=e.target.closest('[data-year-date]');if(!b)return;const date=parseKey(b.dataset.yearDate);saveCurrent();mobileDay=date.getDay();monthAnchor=new Date(date.getFullYear(),date.getMonth(),1);currentWeek=dateKey(sundayOf(date));loadWeek(currentWeek);calendarView='day';try{localStorage.setItem('weekwise-calendar-view-v1','day');}catch(_){}renderAll();};
}


const COUNTDOWNS_KEY='weekwise-countdowns-v1';
let countdowns=WeekwiseData.readCollection(localStorage,COUNTDOWNS_KEY);
function countdownDays(dateKeyValue){return Math.round((parseKey(dateKeyValue)-dateOnly(now))/86400000);}
function countdownWords(days){if(days===0)return {number:'TODAY',label:'It is happening today'};if(days===1)return {number:'1',label:'day to go'};if(days>1)return {number:String(days),label:'days to go'};if(days===-1)return {number:'1',label:'day ago'};return {number:String(Math.abs(days)),label:'days ago'};}
function renderCountdowns(){
 const list=$('countdownList');if(!list)return;
 const sorted=countdowns.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const future=sorted.filter(c=>c.date>=dateKey(now)).length,summary=$('countdownSummary');
 if(summary)summary.innerHTML='<span><strong>'+future+'</strong> upcoming · '+countdowns.length+' total</span><span>Dates are calculated in your local timezone.</span>';
 if(!sorted.length){list.innerHTML='<div class="countdown-empty"><strong>Give an important date a place in your plan.</strong><p>Add an exam, deadline, trip or personal milestone. Weekwise will keep the remaining days visible here.</p></div>';return;}
 const nearest=sorted.find(c=>c.date>=dateKey(now));
 list.innerHTML=sorted.map(c=>{
  const days=countdownDays(c.date),d=countdownWords(days),past=days<0;
  return '<article class="countdown-card '+(past?'past ':'')+(nearest?.id===c.id?'nearest':'')+'" data-countdown-card="'+escapeHtml(c.id)+'"><header class="countdown-card-head"><span class="countdown-card-icon">'+escapeHtml(c.icon||'⌛')+'</span><div class="countdown-card-info"><h4>'+escapeHtml(c.title)+'</h4><p>'+escapeHtml(fmtDate(parseKey(c.date),{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</p></div><div class="countdown-card-actions"><button type="button" data-countdown-edit="'+escapeHtml(c.id)+'" aria-label="Edit '+escapeHtml(c.title)+'" title="Edit">✎</button><button type="button" data-countdown-delete="'+escapeHtml(c.id)+'" aria-label="Delete '+escapeHtml(c.title)+'" title="Delete">×</button></div></header><div class="countdown-card-number">'+escapeHtml(d.number)+'</div><div class="countdown-card-label">'+escapeHtml(d.label)+'</div>'+(c.note?'<div class="countdown-card-note">'+escapeHtml(c.note)+'</div>':'')+'</article>';
 }).join('');
}
function persistCountdowns(){checkedCollectionSave(COUNTDOWNS_KEY,countdowns,value=>countdowns=value);}
function resetCountdownForm(){$('countdownEditId').value='';$('countdownTitle').value='';$('countdownDate').value='';$('countdownIcon').value='';$('countdownNote').value='';$('saveCountdownBtn').textContent='＋ Add countdown';$('cancelCountdownEdit').hidden=true;}
function saveCountdownForm(e){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 e.preventDefault();const title=$('countdownTitle').value.trim(),date=$('countdownDate').value;if(!title||!date){$('countdownForm').reportValidity();return;}
 const id=$('countdownEditId').value,fields={title,date,icon:$('countdownIcon').value.trim()||'⌛',note:$('countdownNote').value.trim(),updatedAt:new Date().toISOString()};
 if(id){const item=countdowns.find(c=>c.id===id);if(item)Object.assign(item,fields);}
 else countdowns.push({id:'cd'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),...fields,createdAt:new Date().toISOString()});
 persistCountdowns();resetCountdownForm();renderCountdowns();showToast(id?'Countdown updated':'Countdown added');
}
function editCountdown(id){const item=countdowns.find(c=>c.id===id);if(!item)return;$('countdownEditId').value=id;$('countdownTitle').value=item.title||'';$('countdownDate').value=item.date||'';$('countdownIcon').value=item.icon||'';$('countdownNote').value=item.note||'';$('saveCountdownBtn').textContent='Save changes';$('cancelCountdownEdit').hidden=false;$('countdownTitle').focus();}
function deleteCountdown(id){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}const item=countdowns.find(c=>c.id===id);if(!item)return;if(!confirm('Delete countdown "'+item.title+'"?'))return;countdowns=countdowns.filter(c=>c.id!==id);persistCountdowns();renderCountdowns();showToast('Countdown deleted');}
function wireCountdownControls(){
 $('countdownForm').addEventListener('submit',saveCountdownForm);$('cancelCountdownEdit').addEventListener('click',resetCountdownForm);
 $('countdownList').addEventListener('click',e=>{const edit=e.target.closest('[data-countdown-edit]');if(edit){editCountdown(edit.dataset.countdownEdit);return;}const del=e.target.closest('[data-countdown-delete]');if(del)deleteCountdown(del.dataset.countdownDelete);});
}


function taskBoardStatus(task){return task?.done||task?.status==='done'?'done':task?.status==='in-progress'?'in-progress':'todo';}
function renderKanbanCard(record){
 const t=record.task,status=taskBoardStatus(t),priority=t.priority||'none',due=t.dueDate?'<span class="kanban-chip">Due '+escapeHtml(fmtDate(parseKey(t.dueDate),{day:'numeric',month:'short'}))+'</span>':'';
 const priorityChip=priority!=='none'?'<span class="kanban-chip priority-'+escapeHtml(priority)+'">'+escapeHtml(({high:'↑ High',medium:'→ Medium',low:'↓ Low'})[priority]||priority)+'</span>':'';
 const listLabel=WORKSPACE_LISTS.find(x=>x.id===record.listId)?.label||'Inbox',focusTarget=Number(t.focusEstimateMinutes)||0,focusLogged=taskLoggedFocusMinutes(t.id);
 const focusHtml=focusTarget?'<span class="kanban-chip">'+focusTarget+'m focus'+(focusLogged?' · '+focusLogged+'m logged':'')+'</span>':'';
 return '<article class="kanban-card" data-board-task="'+escapeHtml(t.id)+'" data-board-week="'+escapeHtml(record.week)+'"><div class="kanban-card-top"><button type="button" class="kanban-card-title" data-board-edit="'+escapeHtml(t.id)+'" data-board-week="'+escapeHtml(record.week)+'">'+escapeHtml(t.title)+'</button></div>'+(t.note?'<div class="kanban-card-note">'+escapeHtml(t.note)+'</div>':'')+'<div class="kanban-card-meta"><span class="kanban-chip">'+escapeHtml(listLabel)+'</span>'+priorityChip+due+focusHtml+'</div><footer class="kanban-card-footer"><select data-board-status="'+escapeHtml(t.id)+'" data-board-week="'+escapeHtml(record.week)+'" aria-label="Change status of '+escapeHtml(t.title)+'"><option value="todo" '+(status==='todo'?'selected':'')+'>To do</option><option value="in-progress" '+(status==='in-progress'?'selected':'')+'>In progress</option><option value="done" '+(status==='done'?'selected':'')+'>Completed</option></select><button type="button" class="kanban-card-edit" title="Edit task" aria-label="Edit '+escapeHtml(t.title)+'" data-board-edit="'+escapeHtml(t.id)+'" data-board-week="'+escapeHtml(record.week)+'">✎</button></footer></article>';
}
function renderKanbanBoard(){
 const board=$('kanbanBoard');if(!board)return;
 const groups={'todo':[],'in-progress':[],'done':[]};
 workspaceRecords().forEach(record=>groups[taskBoardStatus(record.task)].push(record));
 [['todo','kanbanListTodo','kanbanCountTodo'],['in-progress','kanbanListProgress','kanbanCountProgress'],['done','kanbanListDone','kanbanCountDone']].forEach(([status,listId,countId])=>{
  const list=$(listId),count=$(countId),items=groups[status].sort((a,b)=>a.date-b.date||(a.task.start==null?1:b.task.start==null?-1:Number(a.task.start)-Number(b.task.start)));
  if(count)count.textContent=String(items.length);
  const page=listPage('board:'+status,items);if(list)list.innerHTML=items.length?page.records.map(renderKanbanCard).join('')+listPageFooter(page):'<div class="kanban-empty">No tasks in this column.</div>';
 });
}
function updateBoardTaskStatus(id,week,status){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 if(!['todo','in-progress','done'].includes(status))return;
 let item=null;
 if(week!==currentWeek){const saved=store.weeks[week];item=Array.isArray(saved?.tasks)?saved.tasks.find(t=>t.id===id):null;if(!item)return;item.status=status;item.done=status==='done';saveStore();}
 else{item=tasks.find(t=>t.id===id);if(!item)return;item.status=status;item.done=status==='done';saveCurrent();}
 renderAll();
}


const TASK_FILTERS_KEY='weekwise-saved-filters-v1';
let savedTaskFilters=[];
savedTaskFilters=WeekwiseData.readCollection(localStorage,TASK_FILTERS_KEY);
let activeSavedFilterId='';
function savedFilterMatches(record,filter){
 const t=record.task;
 if(filter.listId&&filter.listId!=='all'&&record.listId!==filter.listId)return false;
 const priority=t.priority||'none';
 if(filter.priority&&filter.priority!=='all'&&priority!==filter.priority)return false;
 const status=t.done||t.status==='done'?'done':(t.status==='in-progress'?'in-progress':'todo');
 if(filter.status&&filter.status!=='all'&&status!==filter.status)return false;
 const today=dateKey(now),due=t.dueDate||'';
 if(filter.due==='overdue'&&(!due||due>=today||status==='done'))return false;
 if(filter.due==='7days'&&(!due||due<today||due>addDaysToKey(today,7)))return false;
 if(filter.due==='30days'&&(!due||due<today||due>addDaysToKey(today,30)))return false;
 if(filter.due==='no-date'&&due)return false;
 if(filter.tag){
  const tags=Array.isArray(t.tags)?t.tags:[];
  if(!tags.some(tag=>String(tag).toLowerCase().includes(String(filter.tag).toLowerCase())))return false;
 }
 return true;
}
function renderSavedFilters(){
 const list=$('savedFilterList'),results=$('savedFilterResults');
 if(!list||!results)return;
 const active=savedTaskFilters.find(filter=>filter.id===activeSavedFilterId)||null;
 $('savedFilterCount').textContent=String(savedTaskFilters.length);
 list.innerHTML=savedTaskFilters.length?savedTaskFilters.map(filter=>{
  const count=workspaceRecords().filter(record=>savedFilterMatches(record,filter)).length;
  return '<div class="saved-filter-choice-wrap"><button type="button" class="saved-filter-choice '+(active&&active.id===filter.id?'active':'')+'" data-filter-open="'+escapeHtml(filter.id)+'"><span>'+escapeHtml(filter.title)+'</span><span>'+count+'</span></button><button type="button" class="saved-filter-delete" data-filter-delete="'+escapeHtml(filter.id)+'" aria-label="Delete '+escapeHtml(filter.title)+'">×</button></div>';
 }).join(''):'<div class="saved-filter-empty">Build your first filter above.</div>';
 if(!active){
  $('activeFilterTitle').textContent='Choose a filter';
  $('activeFilterDescription').textContent='Save a filter above, then select it to see matching tasks.';
  $('activeFilterResultCount').textContent='0 tasks';
  results.innerHTML='<div class="workspace-empty"><div><div class="workspace-empty-icon">⏷</div><h3>No filter selected</h3><p>Combine due dates, status, priority, list and tags.</p></div></div>';
  return;
 }
 const records=workspaceRecords().filter(record=>savedFilterMatches(record,active)).sort((a,b)=>a.date-b.date||(a.task.start==null?1:b.task.start==null?-1:Number(a.task.start)-Number(b.task.start)));
 const description=[];
 if(active.listId!=='all')description.push(active.listId);
 if(active.priority!=='all')description.push(active.priority+' priority');
 if(active.status!=='all')description.push(active.status.replace('-',' '));
 if(active.due!=='all')description.push(active.due);
 if(active.tag)description.push('#'+active.tag);
 $('activeFilterTitle').textContent=active.title;
 $('activeFilterDescription').textContent=description.length?description.join(' · '):'All tasks';
 $('activeFilterResultCount').textContent=records.length+' task'+(records.length===1?'':'s');
 const page=listPage('filter:'+active.id,records);results.innerHTML=records.length?page.records.map(workspaceTaskRow).join('')+listPageFooter(page):'<div class="workspace-empty"><div><div class="workspace-empty-icon">✓</div><h3>No matching tasks</h3><p>Try changing the criteria or update a task’s details.</p></div></div>';
}
function saveFilterForm(e){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 e.preventDefault();
 const title=$('filterName').value.trim();
 if(!title){$('filterName').focus();return;}
 const filter={id:'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:title,listId:$('filterList').value,priority:$('filterPriority').value,status:$('filterStatus').value,due:$('filterDue').value,tag:$('filterTag').value.trim().replace(/^#/,'').toLowerCase(),createdAt:new Date().toISOString()};
 savedTaskFilters.push(filter);activeSavedFilterId=filter.id;
 checkedCollectionSave(TASK_FILTERS_KEY,savedTaskFilters,value=>savedTaskFilters=value);
 if(!cloudApplyingRemote)queueCloudSave();
 $('filterName').value='';$('filterList').value='all';$('filterPriority').value='all';$('filterStatus').value='all';$('filterDue').value='all';$('filterTag').value='';
 renderSavedFilters();showToast('Filter saved');
}
function deleteSavedFilter(id){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const filter=savedTaskFilters.find(item=>item.id===id);if(!filter)return;
 if(!confirm('Delete saved filter "'+filter.title+'"?'))return;
 savedTaskFilters=savedTaskFilters.filter(item=>item.id!==id);
 if(activeSavedFilterId===id)activeSavedFilterId='';
 checkedCollectionSave(TASK_FILTERS_KEY,savedTaskFilters,value=>savedTaskFilters=value);
 if(!cloudApplyingRemote)queueCloudSave();
 renderSavedFilters();showToast('Filter deleted');
}


function renderTaskNotificationSettings(){
 const button=$('enableTaskNotificationsBtn'),status=$('taskNotificationStatus');if(!button||!status)return;
 if(!('Notification' in window)){button.disabled=true;button.textContent='Not supported';status.textContent='This browser does not support desktop notifications. In-app task alerts still appear while Weekwise is open.';return;}
 const permission=Notification.permission;
 if(permission==='granted'){button.disabled=true;button.textContent='Browser alerts enabled';status.textContent='Browser notifications are enabled. Scheduled task reminders can show a system alert while Weekwise is running.';}
 else if(permission==='denied'){button.disabled=true;button.textContent='Permission blocked';status.textContent='Browser alerts are blocked by this site. Change Weekwise notification permissions in browser settings; in-app alerts still work while it is open.';}
 else{button.disabled=false;button.textContent='Enable browser alerts';status.textContent='Task alerts can appear while Weekwise is open. Allow browser notifications for system-level alerts.';}
}
async function enableTaskNotifications(){
 if(!('Notification' in window)){showToast('This browser does not support notifications.');renderTaskNotificationSettings();return;}
 try{const permission=await Notification.requestPermission();renderTaskNotificationSettings();if(permission==='granted'){showToast('Browser alerts enabled.');checkTaskReminders();}else showToast(permission==='denied'?'Browser alerts are blocked; in-app alerts still work.':'Browser alert permission was not granted.');}
 catch(_){showToast('Could not request notification permission.');}
}
function openReminderTask(record){
 try{window.focus();}catch(_){}
 setWorkspaceView('calendar');
 saveCurrent();
 mobileDay=record.date.getDay();
 currentWeek=dateKey(sundayOf(record.date));
 monthAnchor=new Date(record.date.getFullYear(),record.date.getMonth(),1);
 calendarView='day';try{localStorage.setItem('weekwise-calendar-view-v1','day');}catch(_){}
 loadWeek(currentWeek);
 const t=tasks.find(x=>x.id===record.task.id);if(t)openTaskModal(t.id,t.day,t.start);
}
function checkTaskReminders(){if(zoneNeedsReview())return;
 const currentTime=Date.now(),due=[];
 workspaceRecords().forEach(record=>{
  const task=record.task;if(!task||task.done)return;
  const notified=new Set(Array.isArray(task.reminderNotifiedTimes)?task.reminderNotifiedTimes:[]);
  if(task.reminderAt&&task.reminderNotifiedAt===task.reminderAt)notified.add(task.reminderAt);
  taskReminderTimes(task).forEach(value=>{
   if(notified.has(value))return;
   const at=new Date(value).getTime();if(Number.isFinite(at)&&at<=currentTime)due.push({record,value});
  });
 });
 if(!due.length)return;
 let changedCurrent=false,changedOther=false,fallbackCount=0;
 due.forEach(({record,value})=>{
  const task=record.task;
  task.reminderNotifiedTimes=Array.isArray(task.reminderNotifiedTimes)?task.reminderNotifiedTimes:[];
  if(!task.reminderNotifiedTimes.includes(value))task.reminderNotifiedTimes.push(value);
  if(task.reminderAt===value)task.reminderNotifiedAt=value;
  let sent=false;
  if('Notification' in window&&Notification.permission==='granted'){
   try{
    const notification=new Notification('Weekwise · '+task.title,{body:'Your task reminder is due now.',tag:'weekwise-task-'+task.id+'-'+value});
    notification.onclick=()=>{try{notification.close();}catch(_){}openReminderTask(record);};
    sent=true;
   }catch(_){}
  }
  if(!sent)fallbackCount++;
  if(record.week===currentWeek)changedCurrent=true;else changedOther=true;
 });
 if(changedCurrent)saveCurrent();
 if(changedOther)saveStore();
 renderAll();
 if(fallbackCount===1)showToast('Task reminder: '+due[0].record.task.title);
 else if(fallbackCount>1)showToast(fallbackCount+' task reminders are due. Open Today or Upcoming to review them.');
}

function parseWeekwiseNaturalCapture(raw,baseDate=new Date()){
 let text=String(raw||'').trim(),targetDate=null,timeMinutes=null,dateMatched=false,recurrence='none';
 const base=dateOnly(baseDate);
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
  targetDate=dateOnly(candidate);dateMatched=true;text=text.replace(match[0],' ');
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
    targetDate=dateOnly(candidate);dateMatched=true;text=text.replace(weekday[0],' ');
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
 if(!targetDate&&timeMinutes!==null)targetDate=dateOnly(baseDate);
 return {title:text,date:targetDate,timeMinutes,dateMatched,timeMatched:timeMinutes!==null,recurrence};
}
function defaultCaptureList(){
 if(workspaceView.startsWith('list-'))return workspaceView.slice(5);
 if(workspaceView.startsWith('folder:')){
  const folder=workspaceView.slice(7),existing=workspaceRecords().find(r=>(r.task.folderName||defaultFolderName(r.listId))===folder);
  return existing?.listId||'other';
 }
 if(workspaceView.startsWith('tag:')){
  const tag=workspaceView.slice(4).toLowerCase(),existing=workspaceRecords().find(r=>(Array.isArray(r.task.tags)?r.task.tags:[]).some(value=>String(value).replace(/^#/,'').toLowerCase()===tag));
  return existing?.listId||'other';
 }
 return 'inbox';
}
function addCapturedTaskForDate(title,targetDate,startMinutes,dueDate,listId,folderNameOverride=null,recurrence='none',tagsOverride=[]){
 const day=targetDate.getDay(),weekKey=dateKey(sundayOf(targetDate)),duration=30,occurrenceDate=dateKey(targetDate);
 let rows,actualStart=null;
 if(weekKey===currentWeek)rows=tasks;
 else{
  if(!store.weeks[weekKey]||!Array.isArray(store.weeks[weekKey].tasks))store.weeks[weekKey]={...(store.weeks[weekKey]||{}),tasks:[]};
  rows=store.weeks[weekKey].tasks;
 }
 if(startMinutes!==null&&startMinutes!==undefined){
  const blockers=rows.filter(t=>t&&t.custom===true&&Number(t.day)===day&&t.start!==null&&t.start!==undefined&&!t.unscheduled&&Number(t.duration)>0);
  actualStart=findSlot(day,duration,startMinutes,0,1440,blockers);
 }
 const type=({career:'job',study:'study',work:'job',personal:'life',language:'language',hobbies:'hobby',other:'other',inbox:'other'})[listId]||'other';
 const task={id:uid(),day,title,type,duration,start:actualStart,done:false,status:'todo',custom:true,fixed:false,note:'',unscheduled:actualStart===null,listId,folderName:folderNameOverride||defaultFolderName(listId),sectionName:'',priority:'none',importance:'unclassified',urgency:'unclassified',dueDate:dueDate||null,reminderAt:null,reminderNotifiedAt:null,tags:Array.isArray(tagsOverride)?tagsOverride:[],subtasks:[],recurrence:recurrence||'none'};
 rows.push(task);
 if(recurrence&&recurrence!=='none'){
  task.seriesId=uid();task.occurrenceDate=occurrenceDate;
  const fields={title,type,duration,start:startMinutes,allDay:false,note:'',recurrence,listId,folderName:task.folderName,sectionName:'',priority:'none',status:'todo',importance:'unclassified',urgency:'unclassified',dueDate:dueDate||null,reminderAt:null,tags:Array.isArray(tagsOverride)?tagsOverride:[],subtasks:[]};
  upsertRecurringTemplate(task.seriesId,occurrenceDate,fields);
  materializeRecurringRange(parseKey(weekKey),parseKey(addDaysToKey(weekKey,89)));
 }
 if(weekKey===currentWeek)saveCurrent();else saveStore();
 renderAll();renderWorkspaceView();
 return {task,weekKey,actualStart};
}
function quickCaptureWorkspaceTask(keepRaw=false,approved=false){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const input=$('workspaceCaptureInput'),raw=String(input?.value||'').trim();if(!raw)return;
 const parsed=keepRaw?{title:raw}:parseWeekwiseNaturalCapture(raw,now),title=parsed.title;
 if(!keepRaw&&!approved&&(parsed.date||parsed.timeMatched||(parsed.recurrence&&parsed.recurrence!=='none'))){$('captureInterpretation').textContent=title+' · '+(parsed.date?'Date '+dateKey(parsed.date)+' · ':'')+(parsed.timeMatched?'Start '+minsTime(parsed.timeMinutes)+' · ':'')+(parsed.recurrence&&parsed.recurrence!=='none'?'Repeats '+parsed.recurrence:'');$('captureOriginal').textContent='Original: '+raw;$('captureConfirmDialog').showModal();return;}
 if(!title){showToast('Add a task name before the date or time.');return;}
 const date=parsed.date||dateOnly(now),dueDate=parsed.date?dateKey(parsed.date):null;
 const listId=defaultCaptureList();
 const start=parsed.timeMatched?parsed.timeMinutes:null;
 const selectedFolder=workspaceView.startsWith('folder:')?workspaceView.slice(7):null;
 const selectedTags=workspaceView.startsWith('tag:')?[workspaceView.slice(4)]:[];
 const result=addCapturedTaskForDate(title,date,start,dueDate,listId,selectedFolder,parsed.recurrence||'none',selectedTags);
 input.value='';
 if(parsed.recurrence&&parsed.recurrence!=='none')showToast('Added repeating task · '+parsed.recurrence+'.');
 else if(parsed.timeMatched&&result.actualStart===null)showToast('Task captured, but there was no free slot at that time. It needs scheduling.');
 else if(parsed.timeMatched&&result.actualStart!==start)showToast('Task scheduled at '+minsTime(result.actualStart)+' instead because that time was busy.');
 else if(parsed.timeMatched)showToast('Task scheduled · '+fmtDate(date,{weekday:'short',day:'numeric',month:'short'})+' at '+minsTime(result.actualStart)+'.');
 else if(dueDate)showToast('Task added · due '+fmtDate(date,{day:'numeric',month:'short'})+'.');
 else showToast(listId==='inbox'?'Added to Inbox':'Task added to '+listId+'.');
}


function escapeICSText(value){
 return String(value??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}
function icsUtcDateTime(date){
 return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}
function exportCalendarICS(){
 const records=workspaceRecords().filter(r=>{
  const t=r.task;return !!(t&&(t.allDay||(t.start!==null&&t.start!==undefined&&!t.unscheduled&&Number(t.duration)>0)||t.dueDate));
 });
 if(!records.length){showToast('Nothing scheduled or due to export yet.');return;}
 const stamp=icsUtcDateTime(new Date()),lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Weekwise//Personal Planner//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Weekwise'];
 records.forEach(record=>{
  const t=record.task,allDay=!!t.allDay||((t.start===null||t.start===undefined||t.unscheduled)&&!!t.dueDate);
  let startLine='',endLine='';
  if(allDay){
   const allDayKey=t.allDayDate||t.dueDate;
   startLine='DTSTART;VALUE=DATE:'+allDayKey.replace(/-/g,'');
   const next=new Date(parseKey(allDayKey));next.setDate(next.getDate()+1);
   endLine='DTEND;VALUE=DATE:'+dateKey(next).replace(/-/g,'');
  }else{
   const start=new Date(record.date.getFullYear(),record.date.getMonth(),record.date.getDate(),Math.floor(Number(t.start)/60),Number(t.start)%60,0);
   const end=new Date(record.date.getFullYear(),record.date.getMonth(),record.date.getDate(),Math.floor((Number(t.start)+Number(t.duration))/60),(Number(t.start)+Number(t.duration))%60,0);
   startLine='DTSTART:'+icsUtcDateTime(start);endLine='DTEND:'+icsUtcDateTime(end);
  }
  const listLabel=WORKSPACE_LISTS.find(x=>x.id===record.listId)?.label||'Inbox';
  const descriptions=[t.note||'', 'List: '+listLabel, 'Status: '+(t.done?'Completed':taskBoardStatus(t)), t.dueDate?'Deadline: '+t.dueDate:'', Array.isArray(t.tags)&&t.tags.length?'Tags: '+t.tags.join(', '):'',Array.isArray(t.attachments)&&t.attachments.length?'Links: '+t.attachments.join(', '):''].filter(Boolean).join('\n');
  lines.push('BEGIN:VEVENT','UID:'+escapeICSText(t.id+'@weekwise.local'),'DTSTAMP:'+stamp,startLine,endLine,'SUMMARY:'+escapeICSText(t.title),'DESCRIPTION:'+escapeICSText(descriptions),'X-WEEKWISE-STATUS:'+(t.done?'DONE':'OPEN'),'END:VEVENT');
 });
 lines.push('END:VCALENDAR');
 const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='weekwise-calendar-'+dateKey(now)+'.ics';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 showToast('Exported '+records.length+' events to .ics. Import the file into your calendar; it will not sync changes automatically.');
}


function unescapeICSText(value){
 return String(value||'').replace(/\\[nN]/g,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\');
}
function parseICSDateProperty(prop){
 if(!prop||!prop.value)return null;
 const value=String(prop.value).trim();
 if(/^\d{8}$/.test(value)){
  const y=Number(value.slice(0,4)),m=Number(value.slice(4,6)),d=Number(value.slice(6,8));
  const date=new Date(y,m-1,d);if(date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d)return null;
  return {date,allDay:true};
 }
 const match=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
 if(!match)return null;
 const y=Number(match[1]),month=Number(match[2])-1,day=Number(match[3]),hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]||0);
 const date=match[7]?new Date(Date.UTC(y,month,day,hour,minute,second)):new Date(y,month,day,hour,minute,second);
 return Number.isFinite(date.getTime())?{date,allDay:false}:null;
}
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
async function importCalendarICS(file){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 if(file.size>WeekwiseData.MAX_BACKUP_BYTES)throw new Error('Calendar file must be smaller than 10 MB.');
 const raw=await file.text(),events=parseICSProperties(raw);if(events.length>10000)throw new Error('Import up to 10,000 events at a time.');
 if(!events.length){showToast('No calendar events were found in that .ics file.');return;}
 let added=0,skipped=0,invalid=0,changedCurrent=false,changedOther=false;
 for(const event of events){
  if(event.DTSTART?.params?.TZID&&event.DTSTART.params.TZID!==Intl.DateTimeFormat().resolvedOptions().timeZone){invalid++;continue;}
  const start=parseICSDateProperty(event.DTSTART),end=parseICSDateProperty(event.DTEND);
  const title=unescapeICSText(event.SUMMARY?.value)||'Imported calendar event';
  if(!start){invalid++;continue;}
  const externalUid=unescapeICSText(event.UID?.value)||('weekwise-import:'+title+'|'+String(event.DTSTART.value));
  if(workspaceRecords().some(record=>record.task.externalUid===externalUid||externalUid===String(record.task.id)+'@weekwise.local')){skipped++;continue;}
  const date=dateOnly(start.date),weekKey=dateKey(sundayOf(date)),day=date.getDay(),isAllDay=start.allDay;
  let startMinutes=null,duration=0,unscheduled=true;
  if(!isAllDay){
   startMinutes=start.date.getHours()*60+start.date.getMinutes();
   const calculated=end&&!end.allDay?Math.round((end.date.getTime()-start.date.getTime())/60000):30;
   duration=Math.max(10,Math.min(1440,calculated>0?calculated:30));unscheduled=false;
  }
  const dueDate=null;
  const description=unescapeICSText(event.DESCRIPTION?.value);
  const task={id:uid(),externalUid,calendarImportSource:'ics',day,title,type:'other',duration,start:startMinutes,done:false,status:'todo',custom:true,fixed:false,note:description,unscheduled:isAllDay?false:unscheduled,allDay:isAllDay,allDayDate:isAllDay?dateKey(date):null,listId:'other',folderName:defaultFolderName('other'),sectionName:'',priority:'none',importance:'unclassified',urgency:'unclassified',dueDate,reminderAt:null,reminderNotifiedAt:null,tags:[],subtasks:[],recurrence:'none'};
  if(!store.weeks[weekKey]||!Array.isArray(store.weeks[weekKey].tasks))store.weeks[weekKey]={...(store.weeks[weekKey]||{}),tasks:[]};
  const rows=weekKey===currentWeek?tasks:store.weeks[weekKey].tasks;
  rows.push(task);added++;
  if(weekKey===currentWeek)changedCurrent=true;else changedOther=true;
 }
 if(!added){showToast(skipped?'No new events imported; '+skipped+' already existed.':'No usable calendar events were found.');return;}
 if(changedCurrent)saveCurrent();
 if(changedOther)saveStore();
 renderAll();renderWorkspaceView();
 showToast('Imported '+added+' events'+(skipped?' · skipped '+skipped+' duplicates':'')+(invalid?' · ignored '+invalid+' unsupported entries':'')+'.');
}

let activeVoiceRecognition=null;
function toggleVoiceCapture(){
 const button=$('voiceCaptureBtn'),input=$('workspaceCaptureInput');
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){showToast('Voice capture is not supported by this browser. You can still type or use the keyboard shortcut.');return;}
 if(activeVoiceRecognition){try{activeVoiceRecognition.stop();}catch(_){}return;}
 try{
  const recognition=new Recognition();
  recognition.lang=navigator.language||'en-US';
  recognition.interimResults=false;
  recognition.maxAlternatives=1;
  activeVoiceRecognition=recognition;
  button.setAttribute('aria-pressed','true');button.title='Stop voice capture';button.textContent='■';
  recognition.onresult=event=>{
   const transcript=String(event.results?.[0]?.[0]?.transcript||'').trim();
   if(transcript){const existing=String(input.value||'').trim();input.value=[existing,transcript].filter(Boolean).join(' ');input.focus();try{input.setSelectionRange(input.value.length,input.value.length);}catch(_){}}
  };
  recognition.onerror=event=>{if(event.error!=='no-speech'&&event.error!=='aborted')showToast('Voice capture stopped. Type your task if the browser cannot recognize speech.');};
  recognition.onend=()=>{activeVoiceRecognition=null;button.setAttribute('aria-pressed','false');button.title='Capture by voice where supported';button.textContent='🎙';};
  recognition.start();showToast('Listening. Say the task and any date or time, then review before adding.');
 }catch(error){
  activeVoiceRecognition=null;button.setAttribute('aria-pressed','false');button.title='Capture by voice where supported';button.textContent='🎙';
  showToast('Could not start voice capture in this browser.');
 }
}
document.addEventListener('keydown',e=>{
 if(!(e.metaKey||e.ctrlKey)||String(e.key).toLowerCase()!=='k'||e.altKey)return;
 if(document.body.classList.contains('signin-required')||$('taskModal')?.classList.contains('show'))return;
 const target=e.target;
 if(target&&target.closest('input,textarea,select,[contenteditable="true"]'))return;
 e.preventDefault();setWorkspaceView('inbox');
 setTimeout(()=>{$('workspaceCaptureInput')?.focus();},0);
});

function createCustomList(){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const raw=prompt('Name your new list:');if(raw===null)return;
 const name=raw.trim().slice(0,60);if(!name){showToast('Enter a list name first.');return;}
 if(WORKSPACE_LISTS.some(list=>list.label.toLowerCase()===name.toLowerCase())){showToast('A list with that name already exists.');return;}
 const list={id:'custom_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,createdAt:new Date().toISOString()};
 store.customLists.push(list);syncWorkspaceLists();saveStore();renderAll();renderWorkspaceView();setWorkspaceView('list-'+list.id);showToast('List created.');
}
function renameCustomList(id){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const list=(store.customLists||[]).find(item=>item.id===id);if(!list)return;
 const raw=prompt('Rename list:',list.name);if(raw===null)return;
 const name=raw.trim().slice(0,60);if(!name){showToast('List name cannot be empty.');return;}
 if(WORKSPACE_LISTS.some(item=>item.id!==id&&item.label.toLowerCase()===name.toLowerCase())){showToast('A list with that name already exists.');return;}
 const oldName=list.name;list.name=name;
 workspaceRecords().forEach(record=>{if(record.task.listId===id&&record.task.folderName===oldName)record.task.folderName=name;});
 (store.recurringTemplates||[]).forEach(template=>{if(template.listId===id&&template.folderName===oldName)template.folderName=name;});
 syncWorkspaceLists();saveCurrent();saveStore();renderAll();renderWorkspaceView();showToast('List renamed.');
}
function deleteCustomList(id){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const list=(store.customLists||[]).find(item=>item.id===id);if(!list)return;
 if(!confirm('Delete the list "'+list.name+'"? Its tasks will be moved to Inbox, not deleted.'))return;
 workspaceRecords().forEach(record=>{
  if(record.task.listId===id){record.task.listId='inbox';if(record.task.folderName===list.name)record.task.folderName='Inbox';record.task.sectionName='';}
 });
 (store.recurringTemplates||[]).forEach(template=>{if(template.listId===id){template.listId='inbox';if(template.folderName===list.name)template.folderName='Inbox';template.sectionName='';}});
 if(Array.isArray(savedTaskFilters))savedTaskFilters.forEach(filter=>{if(filter.listId===id)filter.listId='inbox';});
 store.customLists=store.customLists.filter(item=>item.id!==id);
 if(workspaceView==='list-'+id){workspaceView='inbox';try{localStorage.setItem('weekwise-workspace-view-v1','inbox');}catch(_){}}
 syncWorkspaceLists();saveCurrent();saveStore();
 try{localStorage.setItem(TASK_FILTERS_KEY,JSON.stringify(savedTaskFilters||[]));}catch(_){}
 if(!cloudApplyingRemote)queueCloudSave();
 renderAll();renderWorkspaceView();showToast('List deleted. Its tasks are in Inbox.');
}


const TASK_TEMPLATES_KEY='weekwise-task-templates-v1';
let taskTemplates=WeekwiseData.readCollection(localStorage,TASK_TEMPLATES_KEY);
function renderTaskTemplateOptions(){
 const select=$('taskTemplateSelect');if(!select)return;
 const prior=select.value;
 select.innerHTML='<option value="">Choose a saved template…</option>'+taskTemplates.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(t=>'<option value="'+escapeHtml(t.id)+'">'+escapeHtml(t.name)+'</option>').join('');
 if(taskTemplates.some(t=>t.id===prior))select.value=prior;
 $('taskTemplateCount').textContent=taskTemplates.length+' saved';
 $('deleteTaskTemplateBtn').disabled=!select.value;
}
function readModalTaskTemplate(){
 return {title:$('modalTitleInput').value.trim(),type:$('modalCategory').value,listId:$('modalListId').value,
  folderName:$('modalFolder').value.trim(),sectionName:$('modalSection').value.trim(),priority:$('modalPriority').value,status:$('modalStatus').value,
  schedulingMode:$('modalSchedulingMode').value,importance:$('modalImportance').value,urgency:$('modalUrgency').value,duration:Math.max(10,Number($('modalDuration').value)||30),focusEstimateMinutes:$('modalFocusEstimate').value.trim()?Math.max(5,Math.min(1440,Math.round(Number($('modalFocusEstimate').value)/5)*5)):null,note:$('modalNote').value.trim(),
  recurrence:$('modalRecurrence').value,tags:[...new Set($('modalTags').value.split(',').map(x=>x.trim().replace(/^#/,'')).filter(Boolean).slice(0,20))],
  subtasks:$('modalSubtasks').value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,40).map(title=>({id:uid(),title,done:false})),
  attachments:parseTaskAttachmentInput($('modalAttachments').value).valid,
  noSchedule:!!$('modalNoSchedule').checked,allDay:!!$('modalAllDay').checked,createdAt:new Date().toISOString()};
}
function persistTaskTemplates(){checkedCollectionSave(TASK_TEMPLATES_KEY,taskTemplates,value=>taskTemplates=value);renderTaskTemplateOptions();}

function saveModalAsTaskTemplate(){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const attachmentParse=parseTaskAttachmentInput($('modalAttachments').value);if(attachmentParse.invalid.length){$('modalAttachments').focus();showToast('Use complete http:// or https:// URLs for attachments.');return;}
 const fields=readModalTaskTemplate();if(!fields.title){$('modalTitleInput').focus();showToast('Enter a task name before saving a template.');return;}
 const raw=prompt('Name this task template:',fields.title);if(raw===null)return;
 const name=raw.trim().slice(0,70);if(!name){showToast('Template name cannot be empty.');return;}
 const existing=taskTemplates.find(t=>String(t.name).toLowerCase()===name.toLowerCase());
 if(existing&&!confirm('A template with this name already exists. Replace it?'))return;
 const nowIso=new Date().toISOString(),template={id:existing?.id||'tpl'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),name,...fields,updatedAt:nowIso};
 if(existing)taskTemplates=taskTemplates.map(t=>t.id===existing.id?template:t);else taskTemplates.push(template);
 persistTaskTemplates();$('taskTemplateSelect').value=template.id;$('deleteTaskTemplateBtn').disabled=false;showToast(existing?'Template updated':'Template saved');
}
function applySelectedTaskTemplate(){
 const template=taskTemplates.find(t=>t.id===$('taskTemplateSelect').value);if(!template){showToast('Choose a task template first.');return;}
 $('modalTitleInput').value=template.title||'';$('modalCategory').value=template.type||'other';
 const listId=template.listId||'inbox';$('modalListId').value=[...$('modalListId').options].some(o=>o.value===listId)?listId:'other';
 $('modalFolder').value=template.folderName||defaultFolderName($('modalListId').value);$('modalSection').value=template.sectionName||'';
 $('modalPriority').value=template.priority||'none';$('modalStatus').value=template.status||'todo';
 $('modalSchedulingMode').value=template.schedulingMode||'flexible';
 $('modalImportance').value=template.importance||'unclassified';$('modalUrgency').value=template.urgency||'unclassified';$('modalFocusEstimate').value=template.focusEstimateMinutes?String(template.focusEstimateMinutes):'';
 $('modalRecurrence').value=['none','daily','weekly','monthly','yearly'].includes(template.recurrence)?template.recurrence:'none';
 const duration=String(template.duration||30);
 if(![...$('modalDuration').options].some(o=>o.value===duration)){const option=document.createElement('option');option.value=duration;option.textContent=durationLabel(Number(duration));$('modalDuration').add(option);}
 $('modalDuration').value=duration;updateEndTimeFromDuration();$('modalNote').value=template.note||'';
 $('modalTags').value=Array.isArray(template.tags)?template.tags.join(', '):'';
 $('modalSubtasks').value=Array.isArray(template.subtasks)?template.subtasks.map(s=>typeof s==='string'?s:s.title||'').join('\n'):'';
 $('modalAttachments').value=Array.isArray(template.attachments)?template.attachments.join('\n'):'';
 $('modalNoSchedule').checked=!!template.noSchedule;$('modalAllDay').checked=!!template.allDay&&!template.noSchedule;
 $('modalDueDate').value='';[1,2,3,4,5].forEach(n=>{const el=$('modalReminderAt'+(n===1?'':n));if(el)el.value='';});
 updateModalScheduleVisibility();clearActivityTemplateSelection();hideActivitySuggestions();$('modalTitleInput').focus();
 showToast('Template applied. Choose the date and time, then save.');
}
function deleteSelectedTaskTemplate(){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const id=$('taskTemplateSelect').value,template=taskTemplates.find(t=>t.id===id);if(!template)return;
 if(!confirm('Delete task template "'+template.name+'"?'))return;
 taskTemplates=taskTemplates.filter(t=>t.id!==id);persistTaskTemplates();showToast('Template deleted');
}


function parseTaskAttachmentInput(value){
 const valid=[],invalid=[];
 String(value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).forEach(line=>{
  try{const url=new URL(line);if(url.protocol!=='https:'&&url.protocol!=='http:'){invalid.push(line);return;}if(!valid.includes(url.href))valid.push(url.href);}
  catch(_){invalid.push(line);}
 });
 return {valid:valid.slice(0,10),invalid};
}
function renderTaskAttachments(attachments){
 const links=Array.isArray(attachments)?attachments.filter(Boolean).slice(0,10):[];
 if(!links.length)return '';
 return '<div class="workspace-task-links">'+links.map((link,index)=>{
  let label='Attachment '+(index+1);try{const url=new URL(link);label=url.hostname+((url.pathname&&url.pathname!=='/')?url.pathname:'');}catch(_){}
  return '<a href="'+escapeHtml(link)+'" target="_blank" rel="noopener noreferrer" title="Open link in a new tab">↗ '+escapeHtml(label)+'</a>';
 }).join('')+'</div>';
}


function shareViewTitle(){
 const known={today:'Today',tomorrow:'Tomorrow',inbox:'Inbox',upcoming:'Upcoming',board:'Board',filters:'Saved filters',calendar:'Calendar',matrix:'Priority matrix',search:'Search results'};
 if(known[workspaceView])return workspaceView==='filters'?(savedTaskFilters.find(f=>f.id===activeSavedFilterId)?.title||'Saved filters'):known[workspaceView];
 return $('taskWorkspaceTitle')?.textContent||'Weekwise tasks';
}
function recordsForListTransfer(){
 const all=workspaceRecords();
 if(workspaceView==='board'||workspaceView==='calendar'||workspaceView==='matrix')return all;
 if(workspaceView==='filters'){
  const active=savedTaskFilters.find(f=>f.id===activeSavedFilterId);
  return active?all.filter(record=>savedFilterMatches(record,active)):[];
 }
 let records=all.filter(record=>workspaceRecordMatches(record,workspaceView));
 if(workspaceView==='search'||$('workspaceSearch').value.trim()){
  const query=String($('workspaceSearch').value||'').trim().toLowerCase();
  if(query)records=records.filter(r=>[
   r.task.title,r.task.note,r.task.folderName,r.task.sectionName,r.task.dueDate,r.task.priority,r.task.status,r.task.listId,
   WORKSPACE_LISTS.find(list=>list.id===r.listId)?.label,
   ...(Array.isArray(r.task.tags)?r.task.tags:[]),
   ...(Array.isArray(r.task.attachments)?r.task.attachments:[])
  ].join(' ').toLowerCase().includes(query));
 }
 return records;
}
function exportCurrentTaskList(){
 const records=recordsForListTransfer();
 if(!records.length){showToast(workspaceView==='filters'?'Choose a saved filter before exporting it.':'There are no tasks in this view to export.');return;}
 const seriesIds=new Set(records.map(r=>r.task.seriesId).filter(Boolean));
 const templates=(store.recurringTemplates||[]).filter(template=>seriesIds.has(template.id)).map(template=>({...template,reminderRules:[],reminderOffsetDays:null,reminderTime:null}));
 const listIds=new Set(records.map(r=>r.listId));
 const customLists=(store.customLists||[]).filter(list=>listIds.has(list.id));
 const data={
  app:'Weekwise',
  kind:'shared-task-list',
  schemaVersion:1,
  title:shareViewTitle(),
  sourceView:workspaceView,
  exportedAt:new Date().toISOString(),
  note:'This is a portable list file. Import it into another Weekwise workspace to copy these tasks; it does not create live collaboration.',
  customLists,
  recurringTemplates:templates,
  tasks:records.map(record=>{
   const t=record.task;
   return {
    sourceDate:dateKey(record.date),title:String(t.title||''),type:t.type||'other',listId:record.listId,
    folderName:t.folderName||defaultFolderName(record.listId),sectionName:t.sectionName||'',
    note:t.note||'',start:t.start??null,duration:Number(t.duration)||30,allDay:!!t.allDay,allDayDate:t.allDayDate||null,
    unscheduled:!!t.unscheduled,done:!!t.done,status:taskBoardStatus(t),
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
 a.href=url;a.download='weekwise-'+slug+'-'+dateKey(now)+'.json';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 showToast('Exported '+records.length+' task'+(records.length===1?'':'s')+'. Review the file before sharing it.');
}
function validTransferDate(value,fallback){
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){
  const d=parseKey(value);if(Number.isFinite(d.getTime())&&dateKey(d)===value)return d;
 }
 return dateOnly(fallback||now);
}
function transferDestinationList(){
 if(workspaceView.startsWith('list-')||workspaceView.startsWith('folder:')||workspaceView.startsWith('tag:'))return defaultCaptureList();
 return null;
}
async function importSharedTaskList(file){if(!dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 if(!file)return;
 try{
  if(file.size>12*1024*1024){showToast('This list file is larger than 12 MB. Ask for a smaller export.');return;}
  const data=JSON.parse(await file.text());
  if(data?.app!=='Weekwise'||data?.kind!=='shared-task-list'||data?.schemaVersion!==1||!Array.isArray(data.tasks)){
   showToast('That file is not a supported Weekwise list export.');return;
  }
  if(data.tasks.length>1000){showToast('This list contains more than 1,000 tasks. Export a smaller list first.');return;}
  const destination=transferDestinationList();
  const destinationName=destination?(WORKSPACE_LISTS.find(list=>list.id===destination)?.label||destination):'the original lists';
  const taskCount=data.tasks.length;
  if(!taskCount){showToast('This list export contains no tasks.');return;}
  if(!confirm('Import '+taskCount+' task'+(taskCount===1?'':'s')+' from "'+String(data.title||'Shared list').slice(0,90)+'" into '+destinationName+'? This copies the tasks; it does not enable live shared editing.'))return;

  if(!Array.isArray(store.customLists))store.customLists=[];
  const incomingLists=Array.isArray(data.customLists)?data.customLists:[];
  const listIdMap=new Map();
  for(const sourceList of incomingLists){
   if(!sourceList||typeof sourceList.name!=='string'||!sourceList.name.trim())continue;
   const existing=store.customLists.find(list=>String(list.name||'').trim().toLowerCase()===sourceList.name.trim().toLowerCase());
   if(existing)listIdMap.set(sourceList.id,existing.id);
   else{
    let newId='custom_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    while(WORKSPACE_LISTS.some(list=>list.id===newId)||listIdMap.has(newId))newId='custom_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    const copy={id:newId,name:sourceList.name.trim().slice(0,60),createdAt:new Date().toISOString()};
    store.customLists.push(copy);listIdMap.set(sourceList.id,newId);
   }
  }
  syncWorkspaceLists();
  const sourceSeriesIds=new Set((Array.isArray(data.recurringTemplates)?data.recurringTemplates:[]).map(template=>template?.id).filter(Boolean));
  const seriesIdMap=new Map([...sourceSeriesIds].map(id=>[id,uid()]));
  if(!Array.isArray(store.recurringTemplates))store.recurringTemplates=[];
  (Array.isArray(data.recurringTemplates)?data.recurringTemplates:[]).forEach(template=>{
   if(!template||!sourceSeriesIds.has(template.id))return;
   const copy={...template,id:seriesIdMap.get(template.id),
    listId:destination||listIdMap.get(template.listId)||template.listId||'inbox',
    tags:Array.isArray(template.tags)?[...template.tags]:[],
    subtasks:Array.isArray(template.subtasks)?template.subtasks.map(sub=>({...sub})):[],
    attachments:Array.isArray(template.attachments)?template.attachments.map(item=>({...item})):[],
    excludedDates:Array.isArray(template.excludedDates)?[...template.excludedDates]:[],
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
   store.recurringTemplates.push(copy);
  });
  let imported=0,failed=0,shifted=0;
  const seriesWithTemplate=new Set(sourceSeriesIds);
  for(const source of data.tasks){
   if(!source||typeof source.title!=='string'||!source.title.trim()){failed++;continue;}
   const date=validTransferDate(source.sourceDate,now),weekKey=dateKey(sundayOf(date)),day=date.getDay();
   let rows;
   if(weekKey===currentWeek)rows=tasks;
   else{
    if(!store.weeks[weekKey]||!Array.isArray(store.weeks[weekKey].tasks))store.weeks[weekKey]={...(store.weeks[weekKey]||{}),tasks:[]};
    rows=store.weeks[weekKey].tasks;
   }
   const duration=Math.max(5,Math.min(1440,Number(source.duration)||30));
   let start=null,unscheduled=source.unscheduled!==false;
   if(source.allDay){unscheduled=false;}
   else if(!unscheduled&&source.start!==null&&source.start!==undefined&&Number.isFinite(Number(source.start))){
    const preferred=Math.max(0,Math.min(1439,Math.round(Number(source.start))));
    const blockers=rows.filter(item=>item&&item.custom===true&&Number(item.day)===day&&item.start!==null&&item.start!==undefined&&!item.unscheduled&&Number(item.duration)>0);
    start=findSlot(day,duration,preferred,0,1440,blockers);
    unscheduled=start===null;if(unscheduled||start!==preferred)shifted++;
   }
   const sourceListId=String(source.listId||'inbox');
   const listId=destination||listIdMap.get(sourceListId)||(WORKSPACE_LISTS.some(list=>list.id===sourceListId)?sourceListId:'inbox');
   const seriesId=source.seriesId&&seriesIdMap.has(source.seriesId)?seriesIdMap.get(source.seriesId):null;
   const recurrence=seriesId?(source.recurrence||'none'):'none';
   const task={
    id:uid(),day,title:source.title.trim().slice(0,180),type:source.type||'other',duration,
    start:source.allDay?null:start,allDay:!!source.allDay,allDayDate:source.allDay?(source.allDayDate||dateKey(date)):null,
    done:!!source.done||source.status==='done',status:(source.done||source.status==='done')?'done':(['todo','in-progress'].includes(source.status)?source.status:'todo'),
    custom:true,fixed:false,note:String(source.note||'').slice(0,4000),unscheduled:source.allDay?false:unscheduled,
    listId,folderName:destination?(workspaceView.startsWith('folder:')?workspaceView.slice(7):defaultFolderName(destination)):(String(source.folderName||'').slice(0,100)||defaultFolderName(listId)),
    sectionName:String(source.sectionName||'').slice(0,100),priority:['none','low','medium','high'].includes(source.priority)?source.priority:'none',
    importance:['unclassified','important','not-important'].includes(source.importance)?source.importance:'unclassified',
    urgency:['unclassified','urgent','not-urgent'].includes(source.urgency)?source.urgency:'unclassified',
    dueDate:typeof source.dueDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(source.dueDate)&&dateKey(parseKey(source.dueDate))===source.dueDate?source.dueDate:null,
    focusEstimateMinutes:Math.max(0,Math.min(1440,Number(source.focusEstimateMinutes)||0))||null,
    tags:Array.isArray(source.tags)?source.tags.map(tag=>String(tag).slice(0,80)).filter(Boolean).slice(0,30):[],
    subtasks:Array.isArray(source.subtasks)?source.subtasks.slice(0,100).map(sub=>typeof sub==='string'?{id:uid(),title:sub.slice(0,500),done:false}:{id:uid(),title:String(sub?.title||'').slice(0,500),done:!!sub?.done}):[],
    attachments:Array.isArray(source.attachments)?source.attachments.slice(0,30).map(item=>typeof item==='string'?item.slice(0,1000):({...item})):[],
    recurrence,seriesId,occurrenceDate:seriesId?(source.occurrenceDate||dateKey(date)):null,
    reminderAt:null,reminderTimes:[],reminderNotifiedAt:null,reminderNotifiedTimes:[],
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
   };
   rows.push(task);imported++;
  }
  saveCurrent();saveStore();
  materializeRecurringRange(parseKey(currentWeek),parseKey(addDaysToKey(currentWeek,89)));
  renderAll();renderWorkspaceView();
  const notes=(shifted?', '+shifted+' scheduled task'+(shifted===1?' was':'s were')+' moved to the nearest available time':'')+(failed?', '+failed+' invalid entr'+(failed===1?'y was':'ies were')+' skipped':'');
  showToast('Imported '+imported+' task'+(imported===1?'':'s')+notes+'.');
 }catch(error){
  console.error('Weekwise list import failed',error);
  showToast('Could not import that list file. Check that it is a valid Weekwise export.');
 }
}


async function copyTaskPlanningPrompt(){
 const title=String($('modalTitleInput').value||'').trim();
 if(!title){showToast('Enter a task title first, then copy the planning prompt.');$('modalTitleInput').focus();return;}
 const note=String($('modalNote').value||'').trim();
 const listId=$('modalListId').value,listName=WORKSPACE_LISTS.find(list=>list.id===listId)?.label||listId;
 const category=$('modalCategory').selectedOptions[0]?.textContent||$('modalCategory').value;
 const priority=$('modalPriority').value,focusEstimate=$('modalFocusEstimate').value.trim();
 const dueDate=$('modalDueDate').value,recurrence=$('modalRecurrence').value;
 const existing=String($('modalSubtasks').value||'').trim();
 const links=String($('modalAttachments').value||'').trim();
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
  showToast('Planning prompt copied. Paste it into your chosen AI tool; no task data was sent.');
 }catch(_){
  const area=document.createElement('textarea');area.value=prompt;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();
  let copied=false;try{copied=document.execCommand('copy');}catch(__){}
  area.remove();
  if(copied)showToast('Planning prompt copied. Paste it into your chosen AI tool; no task data was sent.');
  else window.prompt('Copy this planning prompt into your chosen AI tool:',prompt);
 }
}


window.weekwiseCalendarBridge = {
  isReady() { return !!(cloudClient && cloudUser && cloudReady && !cloudConflict && !plannerStorageBlocked && !WeekwiseData.blockedKeys().length && !zoneNeedsReview()); },
  async prepareSync() {
    const owner=cloudUser?.id,epoch=cloudSessionEpoch;if(!dataCanWrite())throw new Error("Planner changes are paused; resolve recovery or time-zone review first.");
    if (!cloudClient || !cloudUser) throw new Error("Sign in to Weekwise before synchronizing a calendar.");
    if (cloudConflict) throw new Error("Resolve the Weekwise cloud conflict before calendar synchronization.");
    if (!cloudReady) throw new Error("Wait for Weekwise cloud sync to finish before synchronizing a calendar.");
    if (cloudBusy) throw new Error("Weekwise is already saving cloud changes. Wait a moment and retry.");
    if (cloudSyncTimer) { clearTimeout(cloudSyncTimer); cloudSyncTimer = null; }
    const current = cloudFingerprint(buildCloudPayload());
    const meta = readCloudMeta();
    if (meta?.userId !== cloudUser.id || meta?.fingerprint !== current) await saveCloudSnapshot();
    if(epoch!==cloudSessionEpoch||cloudUser?.id!==owner)throw new Error("Your account changed during calendar preparation. Try again after its planner loads.");
    const fresh = cloudFingerprint(buildCloudPayload());
    const after = readCloudMeta();
    if (cloudConflict) throw new Error("Resolve the Weekwise cloud conflict before calendar synchronization.");
    if (after?.userId !== cloudUser.id || after?.fingerprint !== fresh) {
      throw new Error("Weekwise could not confirm that your latest changes reached the cloud. Open Cloud sync and retry.");
    }
    return { userId: cloudUser.id };
  },
  openPanel() { openUtilityPanel("calendarConnectionsPanel", "Calendar connections"); },
  async reloadAfterSync() {
    if (!cloudUser) throw new Error("Sign in to Weekwise before reloading synchronized calendar events.");
    await startCloudForUser(cloudUser, true);
    if (cloudConflict) throw new Error("Calendar data was saved, but Weekwise detected a concurrent edit. Resolve the cloud conflict before further sync.");
    renderAll();
    renderWorkspaceView();
    renderReminders();
  },
  toast(message) { showToast(String(message || "")); }
};

WeekwiseExperience.init({edit:openWorkspaceRecord,focus(id,week){const record=workspaceRecords().find(r=>r.task.id===id&&r.week===week);if(!record)return;const state=ensureFocusState();if(state.runningSince!==null||state.activeMs>0){openUtilityPanel('focusPanel','Focus timer');showToast('Finish or reset your current session before choosing another task.');return;}focusState=freshFocus('focus',state.totalSeconds,{id,week,title:record.task.title});persistActiveFocus();openUtilityPanel('focusPanel','Focus timer');renderFocusPanel();focusStartPause();},navigate:setWorkspaceView,panel:openUtilityPanel,render:renderExperience,review(week,review){if(!WeekwiseData.validDate(week))throw new Error('Choose a valid week.');if(!dataCanWrite())throw new Error('Editing is paused for data recovery.');store.settings.weeklyReviews={...(store.settings.weeklyReviews||{}),[week]:{...review,updatedAt:new Date().toISOString()}};if(!saveStore())throw new Error('Could not save your review.');}});
$('captureConfirmApply').onclick=()=>{$('captureConfirmDialog').close();quickCaptureWorkspaceTask(false,true);};$('captureKeepRaw').onclick=()=>{$('captureConfirmDialog').close();quickCaptureWorkspaceTask(true,true);};$('captureCancel').onclick=()=>$('captureConfirmDialog').close();
$('restoreEditorDraft').onclick=restoreEditorDraft;$('downloadEditorDraft').onclick=()=>{const result=WeekwiseDrafts.read(localStorage,currentDataOwner);if(!result)return;const url=URL.createObjectURL(new Blob([result.raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='weekwise-editor-draft.json';a.click();URL.revokeObjectURL(url);};$('discardEditorDraft').onclick=()=>{const result=WeekwiseDrafts.read(localStorage,currentDataOwner);if(!result||!confirm('Discard the saved editor draft? Download it first if you need a copy.'))return;try{WeekwiseDrafts.discard(localStorage,currentDataOwner,result.raw);renderDraftNotice();}catch(error){showToast(error.message);}};$('taskForm').addEventListener('input',()=>{clearTimeout(editorDraftTimer);editorDraftTimer=setTimeout(()=>{try{checkpointEditorDraft();}catch(error){showToast(error.message);}},500);});window.addEventListener('beforeunload',()=>{try{checkpointEditorDraft();}catch(_){}});document.addEventListener('click',e=>{const button=e.target.closest('[data-list-more]');if(!button)return;WeekwiseListWindow.more(button.dataset.listMore);if(workspaceView==='board')renderKanbanBoard();else if(workspaceView==='matrix')renderPriorityMatrix();else if(workspaceView==='filters')renderSavedFilters();else renderWorkspaceTasks();const next=[...document.querySelectorAll('[data-list-more]')].find(el=>el.dataset.listMore===button.dataset.listMore);next?.focus();});
$('globalCaptureBtn').onclick=()=>openTaskModal(null,now.getDay(),null,'inbox');$('mobileNavigationToggle').onclick=()=>{const open=document.body.classList.toggle('navigation-expanded');$('mobileNavigationToggle').setAttribute('aria-expanded',String(open));};
$('workspaceSidebar').addEventListener('click',e=>{if(e.target.closest('[data-workspace-view]')||e.target.closest('[data-workspace-action]')){document.body.classList.remove('navigation-expanded');$('mobileNavigationToggle').setAttribute('aria-expanded','false');}});
$('signinLocalContinue').onclick=()=>{try{isolatePlannerOwner('local');cloudUser=null;cloudReady=false;localStorage.setItem('weekwise-local-mode-v1','true');finishSignInLanding();setCloudStatus('Device-only planning. Your changes are saved locally.');}catch(error){setCloudStatus('Could not open the device planner: '+error.message);}};
setup();

window.WeekwisePlanUI.init({
 snapshot(){const snapshot=JSON.parse(JSON.stringify(store));snapshot.weeks[currentWeek]={...snapshot.weeks[currentWeek],tasks:JSON.parse(JSON.stringify(tasks))};return {store:snapshot,currentWeek};},
 account(){return cloudUser?.id||'local';},
 currentWeek(){return currentWeek;},
 todayKey(){return dateKey(new Date());},
 edit(id,week){openWorkspaceRecord(id,week);},
 commit(expected,account,next,checkpointKey){
  if(plannerStorageBlocked||WeekwiseData.blockedKeys().length)throw new Error('Stored planner data needs recovery before planning changes can be saved.');
  if(zoneNeedsReview())throw new Error('Review the time zone notice before applying a plan.');
  if(cloudConflict)throw new Error('Resolve the cloud conflict before applying a plan.');
  if(localStorage.getItem(STORE_KEY)!==lastSavedDisk)throw new Error('Another tab changed the saved planner. Reload and build a fresh preview.');
  if(account!==(cloudUser?.id||'local'))throw new Error('Your account changed. Build a fresh preview.');
  const snapshot=JSON.parse(JSON.stringify(store));snapshot.weeks[currentWeek]={...snapshot.weeks[currentWeek],tasks:JSON.parse(JSON.stringify(tasks))};
  if(JSON.stringify({store:snapshot,currentWeek})!==expected)throw new Error('Your planner changed. Build a fresh preview.');
  WeekwiseData.validateStore(next);
  WeekwiseData.commitStorage(localStorage,[[STORE_KEY,JSON.stringify(next)]],checkpointKey);
  store=next;lastSavedStore=JSON.stringify(store);lastSavedDisk=localStorage.getItem(STORE_KEY);tasks=JSON.parse(JSON.stringify(store.weeks[currentWeek]?.tasks||[]));
  syncSettingsForm();renderAll();queueCloudSave();
 }
});

showStorageRecoveryNotice();
renderWorkspaceView();renderReminders();nudgeDueReminders();renderTaskNotificationSettings();checkTaskReminders();setInterval(()=>{checkTaskReminders();checkHabitReminders();},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkTaskReminders();});window.addEventListener('focus',checkTaskReminders);
function refreshClock(){const fresh=new Date();if(fresh.getMinutes()===now.getMinutes()&&dateKey(fresh)===dateKey(now))return;const dateChanged=dateKey(fresh)!==dateKey(now);now=fresh;renderDays();renderStats();renderTodayOverview();renderExperience();if(dateChanged){renderReminders();nudgeDueReminders();}}
setInterval(refreshClock,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshClock();});window.addEventListener('focus',refreshClock);
})();
