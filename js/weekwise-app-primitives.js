/* primitives controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function nextQuarterHour(){const minutes=weekwiseRuntime.now.getHours()*60+weekwiseRuntime.now.getMinutes();return Math.min(23*60+45,Math.ceil(minutes/15)*15);}

function dateOnly(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}

function sundayOf(d){const x=weekwiseRuntime.dateOnly(d);x.setDate(x.getDate()-x.getDay());return x;}

function mondayOf(d){const x=weekwiseRuntime.dateOnly(d);const mon=(x.getDay()+6)%7;x.setDate(x.getDate()-mon);return x;}

function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}

function parseKey(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);}

function fmtDate(d,opts={day:'numeric',month:'short'}){return d.toLocaleDateString('en-GB',opts);}

function dayDate(week,idx){const d=weekwiseRuntime.parseKey(week);d.setDate(d.getDate()+idx);return d;}

function normalizeTimeField(el){
 if(!el)return true;
 const input=String(el.value||'').trim();
 if(!input){el.setCustomValidity(el.required?'Enter a start time, for example 9, 930 or 17:30.':'');return !el.required;}
 const value=root.WeekwiseTimeEntry.parse(input);
 if(value!==null)el.value=value;
 el.setCustomValidity(value!==null?'':'Enter a valid start time, such as 9, 930 or 17:30.');
 return value!==null;
}

function validateTimeFields(ids){
  for(const id of ids){const el=weekwiseRuntime.$(id);if(!weekwiseRuntime.normalizeTimeField(el)){el.reportValidity?.();el.focus();return false;}}
  return true;
}

function wireTime24Fields(){
  document.querySelectorAll('[data-time24]').forEach(el=>{
    if(el.dataset.time24Wired==='true')return;el.dataset.time24Wired='true';
    el.addEventListener('input',()=>el.setCustomValidity(''));
    el.addEventListener('blur',()=>{if(String(el.value||'').trim())weekwiseRuntime.normalizeTimeField(el);});
  });
}

function timeMins(s){if(!s)return 600;const [h,m]=s.split(':').map(Number);return h*60+m;}

function minsTime(n){n=((Math.trunc(Number(n)||0)%1440)+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}

function durationLabel(n){if(n<60)return n+' min';const h=Math.floor(n/60),m=n%60;return m?h+'h '+m+'m':h+'h'}

function normalizeEndTimeField(el){
 if(!el)return false;
 const value=root.WeekwiseTimeEntry.parse(el.value,{end:true});
 if(value!==null)el.value=value;
 el.setCustomValidity(value!==null?'':'Enter a valid end time, such as 11, 1130, 18:00 or 24:00.');
 return value!==null;
}

function updateEndTimeFromDuration(){
  const startEl=weekwiseRuntime.$('modalTime'),endEl=weekwiseRuntime.$('modalEndTime'),durationEl=weekwiseRuntime.$('modalDuration');
  if(!startEl||!endEl||!durationEl)return;
  if(!weekwiseRuntime.normalizeTimeField(startEl)){endEl.value='';endEl.setCustomValidity('Enter a valid start time first.');return;}
  const end=weekwiseRuntime.timeMins(startEl.value)+Number(durationEl.value||30);
  weekwiseRuntime.$('modalEndNextDay').checked=end>1440;
  endEl.value=end===1440?'24:00':weekwiseRuntime.minsTime(end);endEl.setCustomValidity('');
}

function updateDurationFromEnd(){
  const startEl=weekwiseRuntime.$('modalTime'),endEl=weekwiseRuntime.$('modalEndTime'),durationEl=weekwiseRuntime.$('modalDuration');
  if(!weekwiseRuntime.normalizeTimeField(startEl)||!weekwiseRuntime.normalizeEndTimeField(endEl))return false;
  const start=weekwiseRuntime.timeMins(startEl.value),end=weekwiseRuntime.timeMins(endEl.value);
  let duration;try{duration=WeekwiseTaskSchedule.duration(start,end,weekwiseRuntime.$('modalEndNextDay').checked);}catch(error){endEl.setCustomValidity(error.message);return false;}
  let option=Array.from(durationEl.options).find(o=>Number(o.value)===duration);
  if(!option){option=document.createElement('option');option.value=String(duration);option.textContent=weekwiseRuntime.durationLabel(duration);durationEl.add(option);}
  durationEl.value=String(duration);endEl.setCustomValidity('');return true;
}

function uid(){return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

function escapeHtml(str){return String(str??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function defaultClassTemplate(){return {title:'Master’s coursework self-study',days:[1,3,5,0],duration:75,start:'13:00'};}

function defaultSettings(){return {timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,weekStartsOn:1,calendarGridStartDay:1,travelDay:6,travelStart:'09:00',destination:'',cookStartDay:1,showBreaks:true,theme:'system',shifts:weekwiseRuntime.DAY_NAMES.map(()=>({enabled:false,start:'09:00',end:'17:00'})),classTemplate:weekwiseRuntime.defaultClassTemplate()};}
return Object.freeze({nextQuarterHour,dateOnly,sundayOf,mondayOf,dateKey,parseKey,fmtDate,dayDate,normalizeTimeField,validateTimeFields,wireTime24Fields,timeMins,minsTime,durationLabel,normalizeEndTimeField,updateEndTimeFromDuration,updateDurationFromEnd,uid,escapeHtml,defaultClassTemplate,defaultSettings});
}
root.WeekwiseAppPrimitives=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
