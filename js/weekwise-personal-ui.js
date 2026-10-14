/* Appearance, calendar copies and weekly review use guarded app transactions. */
(function(root){
 'use strict';let app=null,copySession=null,lastOwner=null;
 const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const duration=value=>{const n=Math.max(0,Math.round(value)),h=Math.floor(n/60),m=n%60;return h?h+'h'+(m?' '+m+'m':''):m+'m';};
 const dayLabel=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'});
 function renderThemes(){if(!app)return;if(lastOwner!==app.account()){lastOwner=app.account();if(copySession)$('copyScheduleDialog').close();$('calendarViewZoneForm').dataset.dirty='false';$('calendarViewZone').value=app.snapshot().store.settings.calendarTimeZone||'';$('calendarViewZoneStatus').textContent='';$('themeStatus').textContent='';}const mode=app.snapshot().store.settings.theme||'system';document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(mode===button.dataset.themeChoice)));$('themeSystem').checked=mode==='system';}
 function saveTheme(mode){try{const snapshot=app.snapshot(),next=JSON.parse(JSON.stringify(snapshot.store));next.settings.theme=mode;app.commit(JSON.stringify(snapshot),app.account(),next);renderThemes();$('themeStatus').textContent='Appearance saved.';}catch(error){$('themeStatus').textContent=error.message;renderThemes();}}
 function openCopy(ref){
  try{
   const snapshot=app.snapshot(),zone=snapshot.store.settings.calendarTimeZone||snapshot.store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
   const record=root.WeekwiseCalendarRange.project(snapshot.store,zone).find(r=>r.week===ref.week&&r.task.id===ref.id);
   if(!record)throw new Error('This activity is no longer available.');
   if(record.zoneError)throw new Error('Review this activity’s clock time first.');
   copySession={ref,owner:app.account(),fingerprint:JSON.stringify(snapshot),zone,allDay:record.allDay};
   $('copyScheduleSource').textContent=record.task.title+' · '+dayLabel(record.date)+(record.allDay?' · all day':'');
   $('copyScheduleDate').value=root.WeekwisePlanning.dateAt(record.date,1);const minute=record.start??540;
   $('copyScheduleTime').value=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(Math.floor(minute%60)).padStart(2,'0');
   $('copyScheduleTimeField').hidden=record.allDay;$('copyScheduleTime').required=!record.allDay;
   $('copyScheduleZone').textContent=record.allDay?'The date stays an all-day date.':'Choose the clock time in '+zone+'.';
   $('copyScheduleStatus').textContent='';$('copyScheduleDialog').showModal();
  }catch(error){app.announce(error.message);}
 }
 function init(bridge){
  app=bridge;renderThemes();
  document.addEventListener('click',event=>{
   const theme=event.target.closest('[data-theme-choice]');if(theme)saveTheme(theme.dataset.themeChoice);
   const copy=event.target.closest('[data-calendar-copy]');if(copy)openCopy({id:copy.dataset.rangeId,week:copy.dataset.rangeWeek});
   if(event.target.closest('#copyScheduleBtn')){const ref=app.source();app.closeEditor();if(!$('taskModal').classList.contains('show'))openCopy(ref);}
   if(event.target.closest('[data-settings-panel="appearancePanel"]'))renderThemes();
  });
  $('themeSystem').onchange=()=>saveTheme($('themeSystem').checked?'system':document.body.dataset.palette||'light');
  $('calendarViewZone').addEventListener('input',()=>$('calendarViewZoneForm').dataset.dirty='true');
  $('calendarViewZoneForm').onsubmit=event=>{event.preventDefault();try{const snapshot=app.snapshot(),next=JSON.parse(JSON.stringify(snapshot.store)),zone=$('calendarViewZone').value.trim();if(zone){new Intl.DateTimeFormat('en-GB',{timeZone:zone});next.settings.calendarTimeZone=zone;}else delete next.settings.calendarTimeZone;app.commit(JSON.stringify(snapshot),app.account(),next);$('calendarViewZoneForm').dataset.dirty='false';$('calendarViewZoneStatus').textContent='Calendar display zone saved.';}catch(error){$('calendarViewZoneStatus').textContent=error.message;}};
  $('copyScheduleCancel').onclick=()=>$('copyScheduleDialog').close();
  $('copyScheduleDialog').addEventListener('close',()=>{copySession=null;$('copyScheduleSource').textContent='';$('copyScheduleStatus').textContent='';});
  $('copyScheduleForm').onsubmit=event=>{event.preventDefault();try{
   if(!copySession||copySession.owner!==app.account()||copySession.fingerprint!==JSON.stringify(app.snapshot()))throw new Error('Your planner or account changed. Close this dialog and choose the activity again.');
   const raw=$('copyScheduleTime').value;if(!copySession.allDay&&!/^\d{2}:\d{2}$/.test(raw))throw new Error('Choose a valid time.');
   const [h,m]=raw.split(':').map(Number),next=root.WeekwisePersonal.duplicate(app.snapshot().store,copySession.ref,{date:$('copyScheduleDate').value,start:h*60+m,zone:copySession.zone,id:root.crypto.randomUUID()});
   app.commit(copySession.fingerprint,copySession.owner,next,'weekwise-pre-calendar-copy-v1');$('copyScheduleDialog').close();app.announce('Copied to '+dayLabel($('copyScheduleDate').value)+'. The original is kept.');
  }catch(error){$('copyScheduleStatus').textContent=error.message;}};
  const shift=delta=>{const date=$('dashboardWeekPicker').value||app.currentWeek();app.summaryWeek(root.WeekwisePlanning.dateAt(root.WeekwiseCalendarRange.range(date,1)[0],delta));};
  $('summaryPrevious').onclick=()=>shift(-7);$('summaryNext').onclick=()=>shift(7);$('summaryCurrent').onclick=()=>app.summaryWeek(root.WeekwiseCalendarRange.range(app.todayKey(),1)[0]);
  $('summaryReflect').onclick=()=>app.reflect(root.WeekwiseCalendarRange.range($('dashboardWeekPicker').value||app.currentWeek(),1)[0]);
  $('summaryExport').onclick=()=>{const data=app.collections(),s=root.WeekwisePersonal.summary(app.snapshot().store,$('dashboardWeekPicker').value||app.currentWeek(),data.focusSessions,data.habits);const report=['Weekwise · '+s.week+' to '+root.WeekwisePlanning.dateAt(s.week,6),'','Planned durations: '+duration(s.planned),'Completed planned durations: '+duration(s.completed),'Occupied calendar time (overlaps counted once): '+duration(s.occupied),'Recorded focus: '+duration(s.focus)+' across '+s.sessions+' sessions','Activities completed: '+s.done.length+' / '+s.timed.length,'Activities needing a time: '+s.backlog,'',...s.days.map(day=>dayLabel(day.date)+': '+duration(day.minutes)+' occupied'),'',...s.habits.map(h=>h.title+': '+h.count+' check-ins / '+h.target+' weekly target'),'', 'Completed planned duration is not measured work. Recorded focus contains only timer-recorded sessions.'].join('\n');const url=URL.createObjectURL(new Blob([report],{type:'text/plain'})),link=document.createElement('a');link.href=url;link.download='weekwise-summary-'+s.week+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 }
 function renderSummary(runtime,anchor){
  const s=root.WeekwisePersonal.summary(runtime.plannerSnapshot().store,anchor,runtime.focusSessions,runtime.habits,runtime.now.getTime());
  $('dashboardWeekPicker').value=s.week;$('dashboardPeriod').textContent=dayLabel(s.week)+' – '+dayLabel(root.WeekwisePlanning.dateAt(s.week,6));
  for(const [id,value] of [['effortLogged',s.completed],['plannedTotal',s.planned],['overdueTotal',s.past],['upcomingTotal',s.ahead]])$(id).textContent=duration(value);
  const elapsed=s.timed.filter(record=>{try{return root.WeekwiseCalendarRange.instant(record,runtime.store.settings.timeZone||'UTC').end<=runtime.now.getTime();}catch(_){return false;}}),elapsedMinutes=elapsed.reduce((n,r)=>n+(r.task.duration||0),0),elapsedDone=elapsed.filter(r=>r.task.done||r.task.status==='done').reduce((n,r)=>n+(r.task.duration||0),0);
  $('completionRate').textContent=elapsedMinutes?Math.round(elapsedDone/elapsedMinutes*100)+'%':'—';
  const difference=s.occupied-s.previousOccupied;
  $('summaryHighlights').innerHTML=[['Recorded focus',duration(s.focus),s.sessions+' saved sessions'],['Occupied time',duration(s.occupied),'Overlaps counted once'],['Against previous week',(difference>0?'+':'')+duration(Math.abs(difference)),difference<0?'Less occupied time':difference>0?'More occupied time':'Same occupied time'],['Needs a time',String(s.backlog),'Activities in this week']].map(([title,value,note])=>'<article><small>'+title+'</small><strong>'+value+'</strong><span>'+note+'</span></article>').join('');
  const labels={workday:'Work day',job:'Career',study:'Study',language:'Languages',life:'Personal',hobby:'Hobbies',other:'Other'};
  $('categoryBreakdown').innerHTML=s.categories.filter(group=>group.planned).map(group=>'<div class="breakdown-row"><div class="breakdown-top"><span>'+labels[group.type]+'</span><span>'+duration(group.done)+' completed / '+duration(group.planned)+' planned</span></div><div class="breakdown-track" aria-hidden="true"><div class="breakdown-fill" style="width:'+Math.min(100,group.done/group.planned*100)+'%;--bar-color:var(--ww-brand)"></div></div></div>').join('')||'<p>No scheduled durations in this week.</p>';
  $('dailyBreakdown').innerHTML=s.days.map(day=>'<div class="daily-row"><span class="daily-name">'+esc(dayLabel(day.date))+'</span><div class="daily-track" aria-hidden="true"><div class="daily-fill" style="width:'+Math.min(100,day.planned?day.done/day.planned*100:0)+'%"></div></div><span class="daily-hours">'+duration(day.done)+' / '+duration(day.planned)+'</span></div>').join('');
  $('summaryHabitList').innerHTML=s.habits.length?s.habits.map(h=>'<article><strong>'+esc(h.title)+(h.paused?' · paused':'')+'</strong><span>'+h.count+' / '+h.target+' check-ins</span><progress max="'+h.target+'" value="'+Math.min(h.count,h.target)+'" aria-label="'+esc(h.title)+' weekly target"></progress></article>').join(''):'<p>No habits saved yet. Add one when you want to build a routine.</p>';
  $('dashboardInsight').textContent=s.done.length+' of '+s.timed.length+' timed activities marked complete. '+s.reviews+' saved clock times need review.';
  $('dashboardNote').textContent='Planned and completed durations describe your calendar, not measured work. Recorded focus is timer-recorded time. Occupied time counts overlaps once. Week runs Monday to Sunday in '+(runtime.store.settings.timeZone||'UTC')+'.';
  renderThemes();
 }
 root.WeekwisePersonalUI=Object.freeze({init,renderSummary});
})(window);
