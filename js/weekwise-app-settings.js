/* settings controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function showToast(msg){const el=weekwiseRuntime.$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(weekwiseRuntime.toastTimer);weekwiseRuntime.toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}

function populateDaySelects(){['tripDay','cookDay','quickDay','modalDay'].forEach(id=>{const el=weekwiseRuntime.$(id);el.innerHTML=weekwiseRuntime.DAY_NAMES.map((n,i)=>`<option value="${i}">${n}</option>`).join('')});}

function renderShiftFields(){const grid=weekwiseRuntime.$('shiftGrid');grid.innerHTML=weekwiseRuntime.DAY_NAMES.map((d,i)=>{const s=weekwiseRuntime.store.settings.shifts[i]||{enabled:false,start:'09:00',end:'17:00'};return `<div class="shiftrow"><label class="daycheck"><input type="checkbox" data-shift-enabled="${i}" ${s.enabled?'checked':''}> <span>${d}</span></label><div><label class="sr-only" for="shiftstart${i}">Shift start ${d}</label><input class="time24" data-time24 type="text" inputmode="numeric" maxlength="5" placeholder="09:00" id="shiftstart${i}" data-shift-start="${i}" value="${weekwiseRuntime.escapeHtml(s.start||'09:00')}" title="24-hour HH:MM, e.g. 09:00 or type 0900" aria-label="${d} shift start"></div><div><label class="sr-only" for="shiftend${i}">Shift end ${d}</label><input class="time24" data-time24 type="text" inputmode="numeric" maxlength="5" placeholder="17:00" id="shiftend${i}" data-shift-end="${i}" value="${weekwiseRuntime.escapeHtml(s.end||'17:00')}" title="24-hour HH:MM, e.g. 17:00 or type 1700" aria-label="${d} shift end"></div></div>`}).join('');}

function applyThemePreference(mode){
 const selected=['system','light','dark'].includes(mode)?mode:'system';
 if(weekwiseRuntime.store&&weekwiseRuntime.store.settings)weekwiseRuntime.store.settings.theme=selected;
 let systemDark=false;try{systemDark=!!window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;}catch(_){}
 const dark=selected==='dark'||(selected==='system'&&systemDark);
 document.body.setAttribute('data-theme',dark?'dark':'light');
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

function syncSettingsForm(){ weekwiseRuntime.$('weekStart').value=weekwiseRuntime.currentWeek;weekwiseRuntime.$('planningWeekStart').value=weekwiseRuntime.store.settings.weekStartsOn===1?'1':'0';weekwiseRuntime.$('calendarTimeZone').value=weekwiseRuntime.store.settings.calendarTimeZone||'';const calendarGridStartDay=weekwiseRuntime.$('calendarGridStartDay');if(calendarGridStartDay)calendarGridStartDay.value=String(WeekwiseCalendarLayout.firstDay(weekwiseRuntime.store.settings.calendarGridStartDay)); weekwiseRuntime.$('tripDay').value=weekwiseRuntime.store.settings.travelDay; weekwiseRuntime.$('tripStart').value=weekwiseRuntime.store.settings.travelStart||'09:00'; weekwiseRuntime.$('cookDay').value=weekwiseRuntime.store.settings.cookStartDay; weekwiseRuntime.$('tripDestination').value=weekwiseRuntime.store.settings.destination||'';const breakToggle=weekwiseRuntime.$('showBreaks');if(breakToggle)breakToggle.checked=weekwiseRuntime.store.settings.showBreaks!==false;const themeSelect=weekwiseRuntime.$('themeMode');if(themeSelect){themeSelect.value=weekwiseRuntime.store.settings.theme||'system';weekwiseRuntime.applyThemePreference(themeSelect.value);}weekwiseRuntime.renderShiftFields();}

function settingsFromForm(){const shifts=weekwiseRuntime.DAY_NAMES.map((_,i)=>({enabled:!!document.querySelector(`[data-shift-enabled="${i}"]`)?.checked,start:document.querySelector(`[data-shift-start="${i}"]`)?.value||'09:00',end:document.querySelector(`[data-shift-end="${i}"]`)?.value||'17:00'}));return {...weekwiseRuntime.store.settings,weekStartsOn:Number(weekwiseRuntime.$('planningWeekStart').value),calendarTimeZone:weekwiseRuntime.$('calendarTimeZone').value.trim()||undefined,travelDay:Number(weekwiseRuntime.$('tripDay').value),travelStart:weekwiseRuntime.$('tripStart').value||'09:00',destination:weekwiseRuntime.$('tripDestination').value.trim(),cookStartDay:Number(weekwiseRuntime.$('cookDay').value),showBreaks:!!weekwiseRuntime.$('showBreaks')?.checked,calendarGridStartDay:WeekwiseCalendarLayout.firstDay(weekwiseRuntime.$('calendarGridStartDay')?.value),theme:weekwiseRuntime.$('themeMode')?.value||weekwiseRuntime.store.settings.theme||'system',shifts,classTemplate:weekwiseRuntime.store.settings.classTemplate||weekwiseRuntime.defaultClassTemplate()};}

function overlap(a,b){return a.start < b.start+b.duration && b.start < a.start+a.duration;}

function canPlace(dayTasks,start,duration){const candidate={start,duration};return !dayTasks.some(t=>t.start!=null && weekwiseRuntime.overlap(candidate,t));}

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

function setWeekFromInput(){let chosen=weekwiseRuntime.$('weekStart').value;if(!chosen)return;chosen=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(weekwiseRuntime.parseKey(chosen)));weekwiseRuntime.saveCurrent();weekwiseRuntime.loadWeek(chosen);}

function formatTime(t){if(t.start===null||t.start===undefined)return 'Needs a time';const start=Number(t.start),end=start+Number(t.duration||0);const endLabel=end===1440?'24:00':weekwiseRuntime.minsTime(end);return end<1440?`${weekwiseRuntime.minsTime(start)}–${endLabel}`:end===1440?`${weekwiseRuntime.minsTime(start)}–24:00`:`${weekwiseRuntime.minsTime(start)}–${weekwiseRuntime.minsTime(end)} (+${Math.floor(end/1440)} day${Math.floor(end/1440)===1?'':'s'})`;}

function categoryClass(type){return ['job','study','language','life','hobby','fixed','other'].includes(type)?`t-${type}`:'t-life';}
return Object.freeze({showToast,populateDaySelects,renderShiftFields,applyThemePreference,setupSystemThemeListener,syncSettingsForm,settingsFromForm,overlap,canPlace,findSlot,createTask,addFlexible,hasShift,loadWeek,setWeekFromInput,formatTime,categoryClass});
}
root.WeekwiseAppSettings=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
