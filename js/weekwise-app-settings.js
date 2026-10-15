/* settings controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function showToast(msg){const el=weekwiseRuntime.$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(weekwiseRuntime.toastTimer);weekwiseRuntime.toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}

function populateDaySelects(){['quickDay','modalDay'].forEach(id=>{const el=weekwiseRuntime.$(id);el.innerHTML=weekwiseRuntime.DAY_NAMES.map((n,i)=>`<option value="${i}">${n}</option>`).join('')});}


function applyThemePreference(mode){
 const selected=['system','light','dark','ocean','lavender','sunset'].includes(mode)?mode:'system';
 if(weekwiseRuntime.store&&weekwiseRuntime.store.settings)weekwiseRuntime.store.settings.theme=selected;
 let systemDark=false;try{systemDark=!!window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;}catch(_){}
 const dark=selected==='dark'||(selected==='system'&&systemDark);
 document.body.setAttribute('data-theme',dark?'dark':'light');document.body.dataset.palette=selected==='system'?(dark?'dark':'light'):selected;
 document.documentElement.style.colorScheme=dark?'dark':'light';
}

function setupSystemThemeListener(){
 try{
  if(!window.matchMedia)return;
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const changed=()=>{if((weekwiseRuntime.store.settings?.theme||'system')==='system')weekwiseRuntime.applyThemePreference('system');};
  if(media.addEventListener)media.addEventListener('change',changed);else if(media.addListener)media.addListener(changed);
 }catch(_){}
}

function syncSettingsForm(){weekwiseRuntime.store.settings.weekStartsOn=1;weekwiseRuntime.store.settings.calendarGridStartDay=1;weekwiseRuntime.applyThemePreference(weekwiseRuntime.store.settings.theme||'system');}


function overlap(a,b){return a.start < b.start+b.duration && b.start < a.start+a.duration;}

function canPlace(dayTasks,start,duration){const candidate={start,duration};return !dayTasks.some(t=>t.start!=null && weekwiseRuntime.overlap(candidate,{...t,duration:(t.duration||0)+WeekwiseTaskOptions.breakAfter(t.breakAfter)}));}

function findSlot(dayIndex,duration,preferred=600,min=420,max=1320,dayTasks=null){const occupied=dayTasks||weekwiseRuntime.tasks.filter(t=>t.day===dayIndex);const candidates=[];for(let start=min;start+duration<=max;start+=15)candidates.push(start);candidates.sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred));return candidates.find(start=>weekwiseRuntime.canPlace(occupied,start,duration))??null;}

function createTask(day,title,type,duration,preferred,opts={}){let start=null;if(preferred!==null&&preferred!==undefined){start=weekwiseRuntime.findSlot(day,duration,preferred,opts.min??420,opts.max??1320,weekwiseRuntime.tasks.filter(t=>t.day===day));}const t={id:weekwiseRuntime.uid(),day,title,type,duration,start,done:false,custom:!!opts.custom,fixed:!!opts.fixed,note:opts.note||'',unscheduled:start===null};weekwiseRuntime.tasks.push(t);return t;}

function addFlexible(day,title,type,duration,preferred,opts={}){return weekwiseRuntime.createTask(day,title,type,duration,preferred,opts);}

function hasShift(i){return !!weekwiseRuntime.store.settings.shifts[i]?.enabled;}

function loadWeek(week){
  weekwiseRuntime.currentWeek=week;
  const saved=weekwiseRuntime.store.weeks[weekwiseRuntime.currentWeek];
  if(saved&&Array.isArray(saved.tasks)){
    // Loading is never permission to remove or rename a user's records.
    weekwiseRuntime.tasks=JSON.parse(JSON.stringify(saved.tasks));
  }else{weekwiseRuntime.tasks=[];if(!weekwiseRuntime.zoneNeedsReview())weekwiseRuntime.saveCurrent();}
  weekwiseRuntime.materializeCurrentAndUpcoming();
  weekwiseRuntime.syncSettingsForm();weekwiseRuntime.renderAll();
}


function formatTime(t){if(t.start===null||t.start===undefined)return 'Needs a time';const start=Number(t.start),end=start+Number(t.duration||0);const endLabel=end===1440?'24:00':weekwiseRuntime.minsTime(end);return end<1440?`${weekwiseRuntime.minsTime(start)}–${endLabel}`:end===1440?`${weekwiseRuntime.minsTime(start)}–24:00`:`${weekwiseRuntime.minsTime(start)}–${weekwiseRuntime.minsTime(end)} (+${Math.floor(end/1440)} day${Math.floor(end/1440)===1?'':'s'})`;}

function categoryClass(type){return ['job','study','language','life','hobby','fixed','other'].includes(type)?`t-${type}`:'t-life';}
return Object.freeze({showToast,populateDaySelects,applyThemePreference,setupSystemThemeListener,syncSettingsForm,overlap,canPlace,findSlot,createTask,addFlexible,hasShift,loadWeek,formatTime,categoryClass});
}
root.WeekwiseAppSettings=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
