/* calendar controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function sortedTasks(day){return weekwiseRuntime.tasks.filter(t=>t.day===day).sort((a,b)=>{if(a.start==null&&b.start==null)return 0;if(a.start==null)return 1;if(b.start==null)return -1;return a.start-b.start;});}

function taskHTML(t){
  const cls=weekwiseRuntime.categoryClass(t.type)+(t.done?' done':'');
  const type=t.workday?'Work day':(weekwiseRuntime.TYPE_LABELS[t.type]||'Other');
  const note=t.note?`<div class="task-note">${weekwiseRuntime.escapeHtml(t.note)}</div>`:'';
  const moveOptions=weekwiseRuntime.DAY_NAMES.map((d,i)=>`<option value="${i}" ${i===t.day?'selected':''}>${weekwiseRuntime.DAY_SHORT[i]}</option>`).join('');
  const dragHandle=!t.fixed?`<span class="drag-handle" draggable="true" data-drag-handle="${weekwiseRuntime.escapeHtml(t.id)}" title="Drag to move or swap" aria-label="Drag ${weekwiseRuntime.escapeHtml(t.title)} to another day or activity">⠿</span>`:'';
  return `<div class="task ${cls}" data-task-id="${weekwiseRuntime.escapeHtml(t.id)}"${WeekwiseTaskOptions.attributes(t)}>
    <div class="tasktop">${dragHandle}<input class="taskcheck" type="checkbox" aria-label="Mark ${weekwiseRuntime.escapeHtml(t.title)} complete" data-done="${weekwiseRuntime.escapeHtml(t.id)}" ${t.done?'checked':''}><div class="taskmain"><div class="task-title">${weekwiseRuntime.escapeHtml(t.title)}</div><div class="taskmeta">${weekwiseRuntime.escapeHtml(weekwiseRuntime.formatTime(t))} · ${weekwiseRuntime.escapeHtml(weekwiseRuntime.durationLabel(t.duration))}${WeekwiseTaskOptions.breakAfter(t.breakAfter)?' · '+WeekwiseTaskOptions.breakAfter(t.breakAfter)+'m break after':''}</div><span class="pill">${weekwiseRuntime.escapeHtml(type)}</span>${t.unscheduled||t.start==null?'<span class="pill" style="background:var(--gold-soft);color:#8b6527">Needs time</span>':''}${t.conflict?'<span class="pill" style="background:var(--red-soft);color:#a3453b">Shift conflict</span>':''}${note}</div></div>
    ${t.fixed?`<div class="tasktools"><span style="font-size:9px;color:var(--muted)">Fixed block · edit in Plan settings</span></div>`:`<div class="tasktools"><select aria-label="Move ${weekwiseRuntime.escapeHtml(t.title)} to another day" title="Move to another day" data-move="${weekwiseRuntime.escapeHtml(t.id)}">${moveOptions}</select><button class="iconbtn" aria-label="Edit ${weekwiseRuntime.escapeHtml(t.title)}" title="Edit activity and time (24-hour clock)" data-edit="${weekwiseRuntime.escapeHtml(t.id)}">✎</button><button class="iconbtn" aria-label="Delete ${weekwiseRuntime.escapeHtml(t.title)}" title="Delete activity" data-delete="${weekwiseRuntime.escapeHtml(t.id)}">×</button></div>`}
  </div>`;
}

function renderMobileDayPicker(){
  const picker=weekwiseRuntime.$('mobileDayPicker');if(!picker)return;
  picker.classList.toggle('is-visible',weekwiseRuntime.calendarView==='day');
  const help=weekwiseRuntime.$('mobileHelp');if(help)help.classList.toggle('is-visible',weekwiseRuntime.calendarView==='day');
  picker.innerHTML=weekwiseRuntime.DAY_NAMES.map((day,i)=>{
    const d=weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,i),count=weekwiseRuntime.tasks.filter(t=>t.day===i).length;
    return `<button type="button" class="day-tab ${i===weekwiseRuntime.mobileDay?'active':''}" data-mobile-day="${i}" aria-pressed="${i===weekwiseRuntime.mobileDay?'true':'false'}"><span>${weekwiseRuntime.DAY_SHORT[i]}</span><strong>${String(d.getDate()).padStart(2,'0')}</strong><small>${count} ${count===1?'event':'events'}</small></button>`;
  }).join('');
  picker.querySelectorAll('[data-mobile-day]').forEach(btn=>btn.addEventListener('click',()=>{weekwiseRuntime.mobileDay=Number(btn.dataset.mobileDay);weekwiseRuntime.renderDays();weekwiseRuntime.renderStats();}));
}

function openFixedSettings(id){const task=weekwiseRuntime.tasks.find(t=>t.id===id);if(task?.workday)weekwiseRuntime.openTemplateEditor('workday');else weekwiseRuntime.openTaskModal(id);
}

function renderDays(){
  const grid=weekwiseRuntime.$('daysGrid');
  const previousScrollTop=grid.scrollTop,previousScrollLeft=grid.scrollLeft;
  const alreadyRendered=grid.dataset.hasRendered==='true';
  const mobileMode=window.matchMedia('(max-width: 650px)').matches;
  const singleDay=weekwiseRuntime.calendarView==='day';
  const instruction=weekwiseRuntime.$('calendarInstruction');if(instruction){instruction.textContent='';instruction.hidden=true;}
  const hourHeight=56;
  grid.setAttribute('aria-label',singleDay?'Daily calendar':'Weekly calendar');
  weekwiseRuntime.updateViewControls();
  weekwiseRuntime.renderMobileDayPicker();
  const dayEvents=[];
  for(let day=0;day<7;day++){
    const arranged=weekwiseRuntime.tasks.filter(t=>t.day===day&&t.start!==null&&t.start!==undefined).map(t=>({...t})).sort((a,b)=>a.start-b.start||b.duration-a.duration);
    // Greedy interval lanes keep overlapping fixed blocks visible side-by-side.
    const clusters=[];let cluster=[],clusterEnd=-1;
    arranged.forEach(t=>{const st=Number(t.start),en=st+Math.max(1,Number(t.duration)||1);if(cluster.length&&st>=clusterEnd){clusters.push(cluster);cluster=[];clusterEnd=-1;}cluster.push(t);clusterEnd=Math.max(clusterEnd,en);});if(cluster.length)clusters.push(cluster);
    clusters.forEach(items=>{const laneEnds=[];items.forEach(t=>{const st=Number(t.start);let lane=laneEnds.findIndex(end=>end<=st);if(lane<0)lane=laneEnds.length;laneEnds[lane]=st+Math.max(1,Number(t.duration)||1);t._lane=lane;});const lanes=laneEnds.length;items.forEach(t=>{t._laneCount=lanes;dayEvents.push(t);});});
  }
  const allDayTasks=weekwiseRuntime.tasks.filter(t=>!!t.allDay&&(t.allDayDate||t.dueDate)&&(!singleDay||Number(t.day)===Number(weekwiseRuntime.mobileDay)));
  const backlog=weekwiseRuntime.tasks.filter(t=>(t.start===null||t.start===undefined||t.unscheduled)&&!t.allDay);
  const hours=Array.from({length:24},(_,h)=>`<span class="hour-label ${h===0?'first':''}" style="top:${h*hourHeight}px">${String(h).padStart(2,'0')}:00</span>`).join('')+`<span class="hour-label end" style="top:${24*hourHeight}px">24:00</span>`;
  const headers=weekwiseRuntime.DAY_NAMES.map((day,i)=>{const d=weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,i),isToday=weekwiseRuntime.dateKey(d)===weekwiseRuntime.dateKey(weekwiseRuntime.now),dayTasks=weekwiseRuntime.tasks.filter(t=>t.day===i),completed=dayTasks.filter(t=>t.done).length;return `<div class="calendar-day-header ${isToday?'is-today':''} ${singleDay&&i===weekwiseRuntime.mobileDay?'mobile-selected':''}" data-header-day="${i}" style="grid-column:${i+2};grid-row:1"><span class="day-number">${String(d.getDate()).padStart(2,'0')}</span><span class="day-name">${day}</span><span class="day-count">${completed}/${dayTasks.length} done</span></div>`;}).join('');
  const columns=weekwiseRuntime.DAY_NAMES.map((day,i)=>{
    const d=weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,i),isToday=weekwiseRuntime.dateKey(d)===weekwiseRuntime.dateKey(weekwiseRuntime.now);
    const evs=dayEvents.filter(t=>t.day===i).map(t=>{
      const start=Math.max(0,Math.min(1439,Number(t.start)||0)),duration=Math.max(1,Number(t.duration)||1),visibleDuration=Math.max(0,Math.min(duration,1440-start));
      const top=start/60*hourHeight,height=Math.max(18,visibleDuration/60*hourHeight);
      const lane=Number(t._lane)||0,laneCount=Math.max(1,Number(t._laneCount)||1),left=(lane/laneCount*100),width=(100/laneCount);
      const end=start+duration,endLabel=end===1440?'24:00':weekwiseRuntime.minsTime(end),spill=Math.floor(end/1440),timeLabel=`${weekwiseRuntime.minsTime(start)}–${endLabel}${spill>0&&end!==1440?` (+${spill} day${spill===1?'':'s'})`:''}`;
      const colour=WeekwiseTaskOptions.accent(t.taskColor),colourName=WeekwiseTaskOptions.colour(t.taskColor);const compact=duration<40||height<32,cls=`cal-event ${weekwiseRuntime.categoryClass(t.type)} ${t.done?'done':''} ${compact?'compact':''} ${t.conflict?'event-conflict':''}`;
      const grip=!t.fixed?`<span class="event-grip" data-drag-handle="${weekwiseRuntime.escapeHtml(t.id)}" title="Drag to another day and time" aria-label="Move ${weekwiseRuntime.escapeHtml(t.title)}">⠿</span>`:'<span class="event-grip fixed-grip" aria-hidden="true">•</span>';
      const doneControl=(!t.fixed||t.workday||t.cityday)?`<input class="event-check" type="checkbox" data-done="${weekwiseRuntime.escapeHtml(t.id)}" ${t.done?'checked':''} aria-label="Mark ${weekwiseRuntime.escapeHtml(t.title)} complete">`:'';
      const actionButtons=!t.fixed?`<div class="event-tools"><button class="event-tool" data-edit="${weekwiseRuntime.escapeHtml(t.id)}" title="Edit event" aria-label="Edit ${weekwiseRuntime.escapeHtml(t.title)}">✎</button><button class="event-tool" data-delete="${weekwiseRuntime.escapeHtml(t.id)}" title="Delete event" aria-label="Delete ${weekwiseRuntime.escapeHtml(t.title)}">×</button></div>`:`<div class="event-tools"><button class="event-tool" data-fixed-open="${weekwiseRuntime.escapeHtml(t.id)}" title="Edit activity" aria-label="Edit ${weekwiseRuntime.escapeHtml(t.title)}">⚙</button></div>`;
      return `<article class="${cls}" data-task-id="${weekwiseRuntime.escapeHtml(t.id)}" data-day-index="${i}" ${colour?`data-task-color="${colourName}"`:``} style="${colour?`--ww-task-accent:${colour};`:``}top:${top}px;height:${height}px;left:calc(${left}% + 2px);width:calc(${width}% - 4px);z-index:${3+lane}" title="${weekwiseRuntime.escapeHtml(t.title+' · '+timeLabel)}"><div class="event-head">${grip}${doneControl}<button class="event-title" ${!t.fixed?`data-edit="${weekwiseRuntime.escapeHtml(t.id)}"`:`data-fixed-open="${weekwiseRuntime.escapeHtml(t.id)}"`} type="button">${weekwiseRuntime.escapeHtml(t.title)}</button></div><div class="event-time">${weekwiseRuntime.escapeHtml(timeLabel)}</div>${duration>=90&&t.note?`<div class="event-note">${weekwiseRuntime.escapeHtml(t.note)}</div>`:''}${actionButtons}</article>`;
    }).join('');
    const nowTop=(weekwiseRuntime.now.getHours()*60+weekwiseRuntime.now.getMinutes())/60*hourHeight;
    const nowLine=''; // The current-time line is drawn once across the calendar below.
    return `<div class="day-column ${isToday?'is-today':''} ${singleDay&&i===weekwiseRuntime.mobileDay?'mobile-selected':''}" data-day-index="${i}" style="grid-column:${i+2};grid-row:2"><div class="hour-lines"></div><div class="half-hour-lines"></div><div class="drop-surface" data-day-surface="${i}" data-day-index="${i}" role="button" tabindex="0" aria-label="Add event on ${day}"></div><div class="event-layer">${evs}${nowLine}</div>${dayEvents.filter(t=>t.day===i&&t.start!=null&&WeekwiseTaskOptions.breakAfter(t.breakAfter)>0).map(t=>{const from=Number(t.start)+Number(t.duration),length=Math.min(1440-from,WeekwiseTaskOptions.breakAfter(t.breakAfter));return length>0?'<div class="task-break-reservation" title="'+length+' minute recovery after '+weekwiseRuntime.escapeHtml(t.title)+'" style="top:'+(from/60*hourHeight)+'px;height:'+Math.max(6,length/60*hourHeight)+'px;--ww-task-accent:'+(WeekwiseTaskOptions.accent(t.taskColor)||'var(--ww-brand)')+'"><span>'+length+'m rest</span></div>':'';}).join('')}</div>`;
  }).join('');
  const allDayHTML=allDayTasks.length?'<div class="backlog-strip all-day-strip"><span class="backlog-label">ALL DAY</span>'+allDayTasks.map(t=>'<button class="backlog-event all-day-event" data-edit="'+weekwiseRuntime.escapeHtml(t.id)+'" title="All-day event">'+weekwiseRuntime.escapeHtml(t.title)+' · '+weekwiseRuntime.DAY_NAMES[t.day]+'</button>').join('')+'</div>':'';
  const backlogHTML=backlog.length?'<div class="backlog-strip"><span class="backlog-label">NEEDS A TIME</span>'+backlog.map(t=>'<button class="backlog-event" data-edit="'+weekwiseRuntime.escapeHtml(t.id)+'"><span class="event-grip" data-drag-handle="'+weekwiseRuntime.escapeHtml(t.id)+'">⠿</span>'+weekwiseRuntime.escapeHtml(t.title)+' · '+weekwiseRuntime.DAY_NAMES[t.day]+'</button>').join('')+'<span class="drop-hint">Drag a grip to a day and time</span></div>':'';
  grid.innerHTML=`${allDayHTML}${backlogHTML}<div class="calendar-grid ${singleDay?'single-day-view':''} ${singleDay&&mobileMode?'mobile-single-day':''}" style="--hour-height:${hourHeight}px"><div class="calendar-corner" aria-hidden="true"></div>${headers}<div class="time-axis">${hours}</div>${columns}</div>`;
  // Draw one Outlook-like time indicator above the calendar grid. The dashed
  // part crosses earlier days; the solid part spans today's column, with a dot
  // exactly where the current day begins.
  const todayColumn=grid.querySelector('.day-column.is-today');
  const selectedDateIsToday=weekwiseRuntime.dateKey(weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,weekwiseRuntime.mobileDay))===weekwiseRuntime.dateKey(weekwiseRuntime.now);
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
      const y=todayRect.top-gridRect.top+grid.scrollTop+(weekwiseRuntime.now.getHours()*60+weekwiseRuntime.now.getMinutes())/60*hourHeight;
      const leadWidth=Math.max(0,todayLeft-firstLeft);
      const indicator=document.createElement('div');
      indicator.className='now-week-indicator';
      indicator.setAttribute('role','img');
      indicator.setAttribute('aria-label',`Current time ${weekwiseRuntime.minsTime(weekwiseRuntime.now.getHours()*60+weekwiseRuntime.now.getMinutes())}`);
      indicator.title=`Current time · ${weekwiseRuntime.minsTime(weekwiseRuntime.now.getHours()*60+weekwiseRuntime.now.getMinutes())}`;
      indicator.style.cssText=`top:${y}px;left:${firstLeft}px;width:${Math.max(0,todayLeft+todayWidth-firstLeft)}px;--now-lead-width:${leadWidth}px;`;
      indicator.innerHTML='<span class="now-dot" aria-hidden="true"></span>';
      grid.appendChild(indicator);
    }
  }
  if(!alreadyRendered||weekwiseRuntime.lastRenderedCalendarView!==weekwiseRuntime.calendarView){const firstHour=Math.max(6,Math.min(20,weekwiseRuntime.now.getHours()-2));grid.scrollTop=Math.max(0,firstHour*hourHeight-18);grid.scrollLeft=0;grid.dataset.hasRendered='true';weekwiseRuntime.lastRenderedCalendarView=weekwiseRuntime.calendarView;}
  else{grid.scrollTop=previousScrollTop;grid.scrollLeft=previousScrollLeft;}
  grid.querySelectorAll('[data-done]').forEach(el=>el.addEventListener('change',()=>{const t=weekwiseRuntime.tasks.find(t=>t.id===el.dataset.done);if(t){t.done=el.checked;t.status=t.done?'done':(t.status==='done'?'todo':(t.status||'todo'));weekwiseRuntime.saveCurrent();weekwiseRuntime.renderAll();}}));
  grid.querySelectorAll('[data-delete]').forEach(el=>el.addEventListener('click',event=>{event.stopPropagation();WeekwiseTaskHistoryUI.remove(el.dataset.delete,weekwiseRuntime.currentWeek);}));
  grid.querySelectorAll('[data-edit]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();weekwiseRuntime.openTaskModal(el.dataset.edit);}));
  // Make the entire event card a tap target; the title-only click was too subtle on phones.
  grid.querySelectorAll('.cal-event').forEach(card=>card.addEventListener('click',e=>{
    if(e.target.closest('button,input,[data-drag-handle]'))return;
    const t=weekwiseRuntime.tasks.find(x=>x.id===card.dataset.taskId);if(!t)return;
    if(t.fixed){weekwiseRuntime.openFixedSettings(t.id);}else weekwiseRuntime.openTaskModal(t.id);
  }));
  grid.querySelectorAll('[data-fixed-open]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();weekwiseRuntime.openFixedSettings(el.dataset.fixedOpen);}));
  grid.querySelectorAll('[data-day-surface]').forEach(surface=>surface.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();weekwiseRuntime.openTaskModal(null,Number(surface.dataset.daySurface),9*60);}}));
  grid.querySelectorAll('[data-day-surface]').forEach(surface=>surface.addEventListener('click',e=>{if(e.target.closest('.cal-event'))return;const rect=surface.getBoundingClientRect();const px=Math.max(0,Math.min(rect.height,e.clientY-rect.top));let preferred=Math.round((px/hourHeight*60)/15)*15;preferred=Math.max(0,Math.min(1440-15,preferred));weekwiseRuntime.openTaskModal(null,Number(surface.dataset.daySurface),preferred);}));
}

function openUtilityPanel(id,title){
  const panel=weekwiseRuntime.$(id);if(!panel)return;
  if(weekwiseRuntime.activeUtilityPanel)weekwiseRuntime.closeUtilityPanel(false);
  if(!weekwiseRuntime.utilityOrigins.has(panel))weekwiseRuntime.utilityOrigins.set(panel,{parent:panel.parentNode,next:panel.nextSibling});
  weekwiseRuntime.$('moreActions').open=false;
  if(panel instanceof HTMLDetailsElement)panel.open=true;
  weekwiseRuntime.$('utilityModalTitle').textContent=title;
  weekwiseRuntime.$('utilityModalContent').appendChild(panel);
  weekwiseRuntime.$('utilityModal').hidden=false;weekwiseRuntime.$('utilityModal').classList.add('show');
  weekwiseRuntime.activeUtilityPanel=panel;
  setTimeout(()=>{weekwiseRuntime.$('closeUtility').focus();},20);
}

function closeUtilityPanel(restoreFocus=true){
  const panel=weekwiseRuntime.activeUtilityPanel;
  if(panel){
    if(panel instanceof HTMLDetailsElement)panel.open=false;
    const origin=weekwiseRuntime.utilityOrigins.get(panel);
    if(origin&&origin.parent){if(origin.next&&origin.next.parentNode===origin.parent)origin.parent.insertBefore(panel,origin.next);else origin.parent.appendChild(panel);}
  }
  weekwiseRuntime.activeUtilityPanel=null;
  weekwiseRuntime.$('utilityModal').classList.remove('show');weekwiseRuntime.$('utilityModal').hidden=true;
  if(restoreFocus)weekwiseRuntime.$('moreActions').querySelector('summary')?.focus();
  if(!weekwiseRuntime.cloudUser&&window.signinGateInFlow){const gate=weekwiseRuntime.$('signinLanding');if(gate){gate.hidden=false;document.body.classList.add('signin-required');}window.signinGateInFlow=false;}
}

function openDashboard(){weekwiseRuntime.openUtilityPanel('dashboard','Weekly effort dashboard');}

function durationText(minutes){minutes=Math.max(0,Math.round(minutes||0));const h=Math.floor(minutes/60),m=minutes%60;if(h&&m)return `${h}h ${m}m`;if(h)return `${h}h`;return `${m}m`;}

function analyticsGroup(t){if(t.workday||/^Picnic work shift$/i.test(t.title||''))return 'workday';if(t.cityday||(t.fixed&&Number(t.duration)===540))return 'hobby';if(['job','study','language','life','hobby','other'].includes(t.type))return t.type;return 'other';}

function taskEndDate(t){
 const zone=weekwiseRuntime.store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone,saved=t.scheduleInstant,anchor=saved?.anchor,signature=JSON.stringify([weekwiseRuntime.currentWeek,t.day,t.start,t.duration,zone,saved?.start,saved?.end,anchor?.week,anchor?.day,anchor?.start,anchor?.duration,anchor?.zone]),prior=weekwiseRuntime.taskEndCache.get(t);
 if(prior?.signature===signature)return new Date(prior.end);
 let end=NaN;try{end=WeekwiseCalendarRange.instant({week:weekwiseRuntime.currentWeek,task:t},zone).end;}catch(_){}
 weekwiseRuntime.taskEndCache.set(t,{signature,end});return new Date(end);
}

function renderStats(){
  const scheduled=weekwiseRuntime.tasks.filter(t=>t.start!==null&&t.start!==undefined&&!t.unscheduled&&Number(t.duration)>0);
  const planned=scheduled.reduce((sum,t)=>sum+Number(t.duration||0),0);
  const logged=scheduled.filter(t=>t.done).reduce((sum,t)=>sum+Number(t.duration||0),0);
  const overdue=scheduled.filter(t=>!t.done&&t.requiresCompletion!==false&&weekwiseRuntime.taskEndDate(t)<=weekwiseRuntime.now).reduce((sum,t)=>sum+Number(t.duration||0),0);
  const upcoming=scheduled.filter(t=>!t.done&&weekwiseRuntime.taskEndDate(t)>weekwiseRuntime.now).reduce((sum,t)=>sum+Number(t.duration||0),0);
  const elapsed=scheduled.filter(t=>weekwiseRuntime.taskEndDate(t)<=weekwiseRuntime.now);
  const elapsedPlan=elapsed.reduce((sum,t)=>sum+Number(t.duration||0),0);
  const elapsedDone=elapsed.filter(t=>t.done).reduce((sum,t)=>sum+Number(t.duration||0),0);
  const completion=elapsedPlan?Math.round(elapsedDone/elapsedPlan*100):0;
  weekwiseRuntime.$('effortLogged').textContent=weekwiseRuntime.durationText(logged);
  weekwiseRuntime.$('plannedTotal').textContent=weekwiseRuntime.durationText(planned);
  weekwiseRuntime.$('overdueTotal').textContent=weekwiseRuntime.durationText(overdue);
  weekwiseRuntime.$('upcomingTotal').textContent=weekwiseRuntime.durationText(upcoming);
  weekwiseRuntime.$('completionRate').textContent=`${completion}%`;
  const d=weekwiseRuntime.parseKey(weekwiseRuntime.currentWeek);
  weekwiseRuntime.$('dashboardPeriod').textContent=`${weekwiseRuntime.fmtDate(d,{day:'numeric',month:'short'})} – ${weekwiseRuntime.fmtDate(weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,6),{day:'numeric',month:'short'})}`;
  const labels=[
    {key:'job',label:'Career',color:'#3159e8'},
    {key:'study',label:'Coursework & communication',color:'#7841d5'},
    {key:'language',label:'Languages',color:'#bd8200'},
    {key:'life',label:'Home & routines',color:'#16845d'},
    {key:'hobby',label:'Hobbies & city trips',color:'#dc6a2c'},
    {key:'workday',label:'Work day',color:'#566590'},
    {key:'other',label:'Other',color:'#2879ad'}
  ];
  const maxCategory=Math.max(1,...labels.map(g=>scheduled.filter(t=>weekwiseRuntime.analyticsGroup(t)===g.key).reduce((n,t)=>n+Number(t.duration||0),0)));
  weekwiseRuntime.$('categoryBreakdown').innerHTML=labels.map(g=>{
    const items=scheduled.filter(t=>weekwiseRuntime.analyticsGroup(t)===g.key),total=items.reduce((n,t)=>n+Number(t.duration||0),0),done=items.filter(t=>t.done).reduce((n,t)=>n+Number(t.duration||0),0);
    return `<div class="breakdown-row"><div class="breakdown-top"><span class="breakdown-label">${g.label}</span><span class="breakdown-hours">${weekwiseRuntime.durationText(done)} marked complete · ${weekwiseRuntime.durationText(total)} planned</span></div><div class="breakdown-track" aria-label="${g.label}: ${weekwiseRuntime.durationText(done)} completed out of ${weekwiseRuntime.durationText(total)} planned"><div class="breakdown-fill" style="width:${Math.min(100,total?done/total*100:0)}%;--bar-color:${g.color}"></div></div></div>`;
  }).join('');
  const daily=weekwiseRuntime.DAY_NAMES.map((label,day)=>{const items=scheduled.filter(t=>t.day===day),total=items.reduce((n,t)=>n+Number(t.duration||0),0),done=items.filter(t=>t.done).reduce((n,t)=>n+Number(t.duration||0),0);return {label:weekwiseRuntime.DAY_SHORT[day],total,done};});
  weekwiseRuntime.$('dailyBreakdown').innerHTML=daily.map(x=>`<div class="daily-row"><span class="daily-name">${x.label}</span><div class="daily-track" title="${weekwiseRuntime.durationText(x.done)} completed of ${weekwiseRuntime.durationText(x.total)} planned"><div class="daily-fill" style="width:${Math.min(100,x.total?x.done/x.total*100:0)}%"></div></div><span class="daily-hours">${weekwiseRuntime.durationText(x.done)} / ${weekwiseRuntime.durationText(x.total)}</span></div>`).join('');
  const unscheduled=weekwiseRuntime.tasks.filter(t=>!t.allDay&&(t.start===null||t.start===undefined||t.unscheduled)).length,clockReviews=scheduled.filter(t=>!Number.isFinite(weekwiseRuntime.taskEndDate(t).getTime())).length;
  weekwiseRuntime.$('dashboardNote').innerHTML=`Totals use scheduled durations and completion checkmarks. <strong>Unchecked past plans</strong> need review; they do not measure wasted time or actual work. Recorded Focus sessions are shown separately in Insights.${clockReviews?` ${clockReviews} saved time${clockReviews===1?' needs':'s need'} clock review and is excluded from past/future classification.`:''}${unscheduled?` ${unscheduled} activity${unscheduled===1?' needs':'ies need'} a time and is not included in the hour totals.`:''}`;
  const shiftDays=(weekwiseRuntime.store.settings.shifts||[]).filter(s=>s&&s.enabled).length;
  const workHabit=weekwiseRuntime.$('workHabitSummary');if(workHabit)workHabit.textContent=shiftDays?`${shiftDays} work day${shiftDays===1?'':'s'} / week · protected calendar block${shiftDays===1?'':'s'}`:'Set your work days in settings';

  weekwiseRuntime.$('weekLabel').textContent=weekwiseRuntime.calendarView==='day'?`${weekwiseRuntime.DAY_NAMES[weekwiseRuntime.mobileDay]}, ${weekwiseRuntime.fmtDate(weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,weekwiseRuntime.mobileDay),{day:'numeric',month:'short',year:'numeric'})}`:`${weekwiseRuntime.fmtDate(d,{day:'numeric',month:'short'})} – ${weekwiseRuntime.fmtDate(weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,6),{day:'numeric',month:'short',year:'numeric'})}`;
}

function renderUnscheduled(){const box=weekwiseRuntime.$('unscheduledBox');const pending=weekwiseRuntime.tasks.filter(t=>!t.fixed&&!t.allDay&&(t.start===null||t.unscheduled));const conflicts=weekwiseRuntime.tasks.filter(t=>t.conflict);if(!pending.length&&!conflicts.length){box.classList.remove('show');return;}box.classList.add('show');let msg=[];if(pending.length)msg.push(`${pending.length} activity${pending.length===1?' needs':'ies need'} a time: ${pending.slice(0,6).map(t=>`${t.title} (${weekwiseRuntime.DAY_SHORT[t.day]})`).join(', ')}${pending.length>6?'…':''}.`);if(conflicts.length)msg.push(`Work shift and city-trip overlap detected on ${[...new Set(conflicts.map(t=>weekwiseRuntime.DAY_NAMES[t.day]))].join(', ')}. Edit settings to resolve the conflict.`);weekwiseRuntime.$('unscheduledText').textContent=msg.join(' ');}

function renderHabitSummaries(){
  const shifts=weekwiseRuntime.store.settings.shifts||[];const active=shifts.filter(s=>s&&s.enabled).length;
  const work=weekwiseRuntime.$('workHabitSummary');if(work)work.textContent=active?`${active} work day${active===1?'':'s'}/week · protected calendar blocks`:'Tap to set your work days and hours';
  const t=weekwiseRuntime.store.settings.classTemplate||weekwiseRuntime.defaultClassTemplate();const cls=weekwiseRuntime.$('classHabitSummary');
  if(cls){const days=Array.isArray(t.days)?t.days.map(Number).filter((d,i,a)=>Number.isInteger(d)&&d>=0&&d<=6&&a.indexOf(d)===i).length:4;cls.textContent=`Class template · ${days} session${days===1?'':'s'}/week · ${weekwiseRuntime.durationLabel(Number(t.duration)||75)} · around ${t.start||'13:00'}`;}
}

function renderAll(){WeekwiseZoneConversionUI.render();if(weekwiseRuntime.workspaceView==='calendar')weekwiseRuntime.renderDays();weekwiseRuntime.renderStats();weekwiseRuntime.renderUnscheduled();weekwiseRuntime.renderHabitSummaries();weekwiseRuntime.renderWorkspaceTasks();weekwiseRuntime.updateWorkspaceCounts();if(weekwiseRuntime.workspaceView==='matrix')weekwiseRuntime.renderPriorityMatrix();if(weekwiseRuntime.activeUtilityPanel===weekwiseRuntime.$('routineDetails'))weekwiseRuntime.renderHabitTracker();if(weekwiseRuntime.workspaceView==='board')weekwiseRuntime.renderKanbanBoard();if(weekwiseRuntime.workspaceView==='filters')weekwiseRuntime.renderSavedFilters();weekwiseRuntime.updateCalendarPeriodLabel();weekwiseRuntime.updateCalendarVisibility();weekwiseRuntime.renderExperience();WeekwiseTaskHistoryUI.render();WeekwiseSeriesScheduleUI.render();}

function moveTask(id,newDay,preferredTime=null){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
  const t=weekwiseRuntime.tasks.find(t=>t.id===id);if(!t||t.fixed)return;
  const preferred=preferredTime??t.start??10*60;
  const blockers=weekwiseRuntime.tasks.filter(x=>x.day===newDay&&x.id!==t.id);
  const slot=weekwiseRuntime.findSlot(newDay,t.duration+WeekwiseTaskOptions.breakAfter(t.breakAfter),preferred,0,1440,blockers);
  t.day=newDay;t.start=slot;t.unscheduled=slot===null;t.conflict=false;
  weekwiseRuntime.saveCurrent();weekwiseRuntime.renderAll();
  if(slot===null)weekwiseRuntime.showToast('No free time that day. Event moved to Needs a time.');
  else if(slot!==preferred)weekwiseRuntime.showToast(`That time was busy; moved to ${weekwiseRuntime.DAY_SHORT[newDay]} ${weekwiseRuntime.minsTime(slot)} instead.`);
  else weekwiseRuntime.showToast(`Moved to ${weekwiseRuntime.DAY_SHORT[newDay]} · ${weekwiseRuntime.minsTime(slot)}`);
}

function swapTasks(idA,idB){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
  const a=weekwiseRuntime.tasks.find(t=>t.id===idA),b=weekwiseRuntime.tasks.find(t=>t.id===idB);
  if(!a||!b||a.id===b.id||a.fixed)return;
  if(b.fixed){weekwiseRuntime.moveTask(a.id,b.day,b.start??10*60);return;}
  const aOld={day:a.day,start:a.start??10*60},bOld={day:b.day,start:b.start??10*60};
  const remaining=weekwiseRuntime.tasks.filter(t=>t.id!==a.id&&t.id!==b.id);
  let aStart=null,bStart=null;
  if(aOld.day===bOld.day){
    const blockers=remaining.filter(t=>t.day===aOld.day);
    aStart=weekwiseRuntime.findSlot(aOld.day,a.duration+WeekwiseTaskOptions.breakAfter(a.breakAfter),bOld.start,0,1440,blockers);
    if(aStart!==null)bStart=weekwiseRuntime.findSlot(bOld.day,b.duration+WeekwiseTaskOptions.breakAfter(b.breakAfter),aOld.start,0,1440,[...blockers,{start:aStart,duration:a.duration,breakAfter:a.breakAfter}]);
  }else{
    aStart=weekwiseRuntime.findSlot(bOld.day,a.duration+WeekwiseTaskOptions.breakAfter(a.breakAfter),bOld.start,0,1440,remaining.filter(t=>t.day===bOld.day));
    bStart=weekwiseRuntime.findSlot(aOld.day,b.duration+WeekwiseTaskOptions.breakAfter(b.breakAfter),aOld.start,0,1440,remaining.filter(t=>t.day===aOld.day));
  }
  if(aStart===null||bStart===null){weekwiseRuntime.showToast('Could not swap: there is no available time near one of those slots.');return;}
  a.day=bOld.day;a.start=aStart;a.unscheduled=false;b.day=aOld.day;b.start=bStart;b.unscheduled=false;
  weekwiseRuntime.saveCurrent();weekwiseRuntime.renderAll();weekwiseRuntime.showToast('Events swapped');
}

function setupDragDrop(){
  const grid=weekwiseRuntime.$('daysGrid');
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
    const source=drag?weekwiseRuntime.tasks.find(t=>t.id===drag.id):null;
    const maxStart=Math.max(0,1440-(source?.duration||15));
    const start=Math.max(0,Math.min(maxStart,Math.round((ratio*1440)/15)*15));
    const targetEvent=hit?.closest('.cal-event');
    return {day:Number(column.dataset.dayIndex),start,targetEvent:targetEvent&&targetEvent.dataset.taskId!==drag?.id?targetEvent:null,column};
  };
  grid.addEventListener('pointerdown',e=>{
    if(grid.dataset.rangeActive==='true')return;
    const handle=e.target.closest('[data-drag-handle]');
    const card=e.target.closest('.cal-event');
    const id=handle?.dataset.dragHandle||card?.dataset.taskId;
    if(!id)return;
    if(e.target.closest('.event-tool,.event-check,[data-done],[data-delete],[data-fixed-open]'))return;
    const task=weekwiseRuntime.tasks.find(t=>t.id===id);if(!task||task.fixed)return;
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
      drag.ghost=document.createElement('div');drag.ghost.className='drag-ghost';drag.ghost.textContent=weekwiseRuntime.tasks.find(t=>t.id===drag.id)?.title||'Move activity';document.body.appendChild(drag.ghost);
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
    if(info){if(info.targetEvent)info.targetEvent.classList.add('drop-over');else info.column.classList.add('is-drop-target');if(drag.ghost)drag.ghost.textContent=`${weekwiseRuntime.DAY_SHORT[info.day]} · ${weekwiseRuntime.minsTime(info.start)}`;}
    else if(drag.ghost)drag.ghost.textContent='Drop on a day and time';
  },{passive:false});
  document.addEventListener('pointerup',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const state=drag;const wasActive=state.active;const info=wasActive?locate(e.clientX,e.clientY):null;
    endDrag();
    if(!wasActive)return;
    if(info?.targetEvent){weekwiseRuntime.swapTasks(state.id,info.targetEvent.dataset.taskId);return;}
    if(info){weekwiseRuntime.moveTask(state.id,info.day,info.start);return;}
    weekwiseRuntime.showToast('To move an event, drop it inside a day column at the time you want.');
  });
  document.addEventListener('pointercancel',e=>{if(drag&&e.pointerId===drag.pointerId)endDrag();});
}

function shiftWeeks(n){const d=weekwiseRuntime.parseKey(weekwiseRuntime.currentWeek);d.setDate(d.getDate()+7*n);weekwiseRuntime.saveCurrent();weekwiseRuntime.loadWeek(weekwiseRuntime.dateKey(d));}

function setCalendarView(view){if(view!=='day'&&view!=='week')return;if(weekwiseRuntime.calendarView===view)return;weekwiseRuntime.calendarView=view;try{localStorage.setItem('weekwise-calendar-view-v1',view);}catch(_){}weekwiseRuntime.renderAll();}

function updateViewControls(){const dayBtn=weekwiseRuntime.$('dayViewBtn'),weekBtn=weekwiseRuntime.$('weekViewBtn');if(dayBtn){dayBtn.classList.toggle('active',weekwiseRuntime.calendarView==='day');dayBtn.setAttribute('aria-pressed',weekwiseRuntime.calendarView==='day'?'true':'false');}if(weekBtn){weekBtn.classList.toggle('active',weekwiseRuntime.calendarView==='week');weekBtn.setAttribute('aria-pressed',weekwiseRuntime.calendarView==='week'?'true':'false');}const prev=weekwiseRuntime.$('prevWeek'),next=weekwiseRuntime.$('nextWeek');if(prev){prev.title=weekwiseRuntime.calendarView==='day'?'Previous day':'Previous week';prev.setAttribute('aria-label',prev.title);}if(next){next.title=weekwiseRuntime.calendarView==='day'?'Next day':'Next week';next.setAttribute('aria-label',next.title);}}

function shiftPeriod(n){if(weekwiseRuntime.calendarView!=='day'){weekwiseRuntime.shiftWeeks(n);return;}const d=weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,weekwiseRuntime.mobileDay);d.setDate(d.getDate()+n);weekwiseRuntime.saveCurrent();weekwiseRuntime.mobileDay=d.getDay();weekwiseRuntime.loadWeek(weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(d)));}

function addQuick(e){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}e.preventDefault();const title=weekwiseRuntime.$('quickTitle').value.trim();if(!title)return;if(!weekwiseRuntime.validateTimeFields(['quickTime']))return;const day=Number(weekwiseRuntime.$('quickDay').value),type=weekwiseRuntime.$('quickType').value,duration=Number(weekwiseRuntime.$('quickDuration').value),preferred=weekwiseRuntime.timeMins(weekwiseRuntime.$('quickTime').value||'10:00');weekwiseRuntime.createTask(day,title,type,duration,preferred,{min:0,max:1440,custom:true});const t=weekwiseRuntime.tasks[weekwiseRuntime.tasks.length-1];t.unscheduled=t.start===null;weekwiseRuntime.saveCurrent();weekwiseRuntime.renderAll();weekwiseRuntime.$('quickTitle').value='';weekwiseRuntime.showToast(t.start===null?'Added to the day, but needs a time':'Activity added to your week');}

function setup(){weekwiseRuntime.syncWorkspaceLists();weekwiseRuntime.populateDaySelects();weekwiseRuntime.syncSettingsForm();weekwiseRuntime.setupSystemThemeListener();weekwiseRuntime.wireTime24Fields();weekwiseRuntime.wireWorkspaceControls();weekwiseRuntime.wireCountdownControls();weekwiseRuntime.loadWeek(weekwiseRuntime.currentWeek);weekwiseRuntime.setupDragDrop();weekwiseRuntime.$('dayViewBtn').addEventListener('click',()=>weekwiseRuntime.setCalendarView('day'));weekwiseRuntime.$('weekViewBtn').addEventListener('click',()=>weekwiseRuntime.setCalendarView('week'));weekwiseRuntime.$('monthViewBtn').addEventListener('click',()=>weekwiseRuntime.setCalendarView('month'));weekwiseRuntime.$('agendaViewBtn').addEventListener('click',()=>weekwiseRuntime.setCalendarView('agenda'));weekwiseRuntime.$('yearViewBtn').addEventListener('click',()=>weekwiseRuntime.setCalendarView('year'));weekwiseRuntime.$('prevWeek').addEventListener('click',()=>weekwiseRuntime.shiftPeriod(-1));weekwiseRuntime.$('nextWeek').addEventListener('click',()=>weekwiseRuntime.shiftPeriod(1));weekwiseRuntime.$('thisWeek').addEventListener('click',()=>{
 weekwiseRuntime.saveCurrent();
 weekwiseRuntime.now=new Date();weekwiseRuntime.mobileDay=weekwiseRuntime.now.getDay();weekwiseRuntime.currentWeek=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(weekwiseRuntime.now));
 weekwiseRuntime.monthAnchor=new Date(weekwiseRuntime.now.getFullYear(),weekwiseRuntime.now.getMonth(),1);
 weekwiseRuntime.agendaAnchor=weekwiseRuntime.dateOnly(weekwiseRuntime.now);weekwiseRuntime.calendarYear=weekwiseRuntime.now.getFullYear();
 weekwiseRuntime.weekwiseAnimateCalendar();weekwiseRuntime.loadWeek(weekwiseRuntime.currentWeek);
});weekwiseRuntime.$('menuQuickAddBtn').addEventListener('click',()=>weekwiseRuntime.openUtilityPanel('quickAddDetails','Quick add activity'));weekwiseRuntime.$('menuHabitsBtn').addEventListener('click',()=>weekwiseRuntime.openUtilityPanel('routineDetails','Habits & focus tips'));weekwiseRuntime.$('dashboardMenuBtn').addEventListener('click',weekwiseRuntime.openDashboard);weekwiseRuntime.$('remindersMenuBtn').addEventListener('click',weekwiseRuntime.openReminders);weekwiseRuntime.$('cloudMenuBtn').addEventListener('click',weekwiseRuntime.openCloudPanel);weekwiseRuntime.wireCloudAuthControls();weekwiseRuntime.$('cloudSyncNow').addEventListener('click',weekwiseRuntime.cloudSyncNow);weekwiseRuntime.$('cloudSignOut').addEventListener('click',async()=>{localStorage.removeItem('weekwise-offline-owner-v1');if(weekwiseRuntime.cloudClient)await weekwiseRuntime.cloudClient.auth.signOut();});weekwiseRuntime.$('cloudUseRemote').addEventListener('click',weekwiseRuntime.cloudUseRemote);weekwiseRuntime.$('cloudUseLocal').addEventListener('click',weekwiseRuntime.cloudUseLocal);weekwiseRuntime.$('reminderForm').addEventListener('submit',weekwiseRuntime.reminderSave);weekwiseRuntime.$('cancelReminderEdit').addEventListener('click',weekwiseRuntime.reminderFormReset);weekwiseRuntime.$('reminderFilter').addEventListener('change',weekwiseRuntime.renderReminders);document.querySelectorAll('[data-template-editor]').forEach(card=>{const activate=()=>weekwiseRuntime.openTemplateEditor(card.dataset.templateEditor);card.addEventListener('click',activate);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});});weekwiseRuntime.$('closeTemplate').addEventListener('click',weekwiseRuntime.closeTemplateEditor);weekwiseRuntime.$('cancelTemplate').addEventListener('click',weekwiseRuntime.closeTemplateEditor);weekwiseRuntime.$('templateForm').addEventListener('submit',weekwiseRuntime.saveTemplateEditor);weekwiseRuntime.$('templateModal').addEventListener('click',e=>{if(e.target===weekwiseRuntime.$('templateModal'))weekwiseRuntime.closeTemplateEditor();});weekwiseRuntime.$('closeUtility').addEventListener('click',()=>weekwiseRuntime.closeUtilityPanel());weekwiseRuntime.$('utilityModal').addEventListener('click',e=>{if(e.target===weekwiseRuntime.$('utilityModal'))weekwiseRuntime.closeUtilityPanel();});weekwiseRuntime.$('addTaskBtn').addEventListener('click',()=>weekwiseRuntime.openTaskModal(null,weekwiseRuntime.mobileDay,weekwiseRuntime.nextQuarterHour()));weekwiseRuntime.$('remindersQuickBtn').addEventListener('click',weekwiseRuntime.openReminders);weekwiseRuntime.$('exportCalendarBtn').addEventListener('click',weekwiseRuntime.exportCalendarICS);weekwiseRuntime.$('importCalendarBtn').addEventListener('click',()=>weekwiseRuntime.$('calendarImportFile').click());weekwiseRuntime.$('calendarImportFile').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)weekwiseRuntime.importCalendarICS(file).catch(error=>weekwiseRuntime.showToast('Could not import calendar file: '+(error?.message||'invalid iCalendar file'))).finally(()=>{e.target.value='';});});weekwiseRuntime.$('activitySuggestions').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();weekwiseRuntime.hideActivitySuggestions();weekwiseRuntime.$('modalTitleInput').focus();}});weekwiseRuntime.$('modalTitleInput').addEventListener('focus',()=>{if(weekwiseRuntime.suppressActivitySuggestionFocus){weekwiseRuntime.suppressActivitySuggestionFocus=false;return;}weekwiseRuntime.renderActivitySuggestions(weekwiseRuntime.$('modalTitleInput').value);});weekwiseRuntime.$('modalTitleInput').addEventListener('click',()=>weekwiseRuntime.renderActivitySuggestions(weekwiseRuntime.$('modalTitleInput').value));weekwiseRuntime.$('modalTitleInput').addEventListener('input',()=>{weekwiseRuntime.selectedActivitySuggestion=null;weekwiseRuntime.renderActivitySuggestions(weekwiseRuntime.$('modalTitleInput').value);});weekwiseRuntime.$('modalTitleInput').addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&!weekwiseRuntime.$('activitySuggestions').hidden){const first=weekwiseRuntime.$('activitySuggestions').querySelector('button');if(first){e.preventDefault();first.focus();}}if(e.key==='Escape')weekwiseRuntime.hideActivitySuggestions();});document.addEventListener('click',e=>{if(!e.target.closest('.activity-name-wrap'))weekwiseRuntime.hideActivitySuggestions();});weekwiseRuntime.$('modalDay').addEventListener('change',weekwiseRuntime.updateActivityTemplateStates);weekwiseRuntime.$('modalRecurrenceScope').addEventListener('change',weekwiseRuntime.updateRecurringBulkVisibility);weekwiseRuntime.$('modalRecurrence').addEventListener('change',weekwiseRuntime.updateRecurringBulkVisibility);weekwiseRuntime.$('modalTaskColor').addEventListener('change',weekwiseRuntime.updateTaskColourPreview);weekwiseRuntime.$('modalNoSchedule').addEventListener('change',()=>{if(weekwiseRuntime.$('modalNoSchedule').checked)weekwiseRuntime.$('modalAllDay').checked=false;weekwiseRuntime.updateModalScheduleVisibility();});weekwiseRuntime.$('modalAllDay').addEventListener('change',()=>{if(weekwiseRuntime.$('modalAllDay').checked)weekwiseRuntime.$('modalNoSchedule').checked=false;weekwiseRuntime.updateModalScheduleVisibility();});weekwiseRuntime.$('modalListId').addEventListener('change',()=>{if(weekwiseRuntime.$('modalListId').value==='inbox'){weekwiseRuntime.$('modalNoSchedule').checked=true;weekwiseRuntime.$('modalAllDay').checked=false;}weekwiseRuntime.updateModalScheduleVisibility();});weekwiseRuntime.$('modalTime').addEventListener('input',()=>{const el=weekwiseRuntime.$('modalTime'),value=String(el.value||'').trim();if(value.includes(':')||value.length===3||value.length===4){if(weekwiseRuntime.normalizeTimeField(el))weekwiseRuntime.updateEndTimeFromDuration();}});weekwiseRuntime.$('modalDuration').addEventListener('change',weekwiseRuntime.updateEndTimeFromDuration);weekwiseRuntime.$('modalEndTime').addEventListener('input',()=>{const el=weekwiseRuntime.$('modalEndTime');el.setCustomValidity('');const value=String(el.value||'').trim();if(value==='24:00'||value.includes(':')||value.length===3||value.length===4)weekwiseRuntime.updateDurationFromEnd();});weekwiseRuntime.$('modalEndTime').addEventListener('change',weekwiseRuntime.updateDurationFromEnd);weekwiseRuntime.$('modalEndNextDay').addEventListener('change',()=>{weekwiseRuntime.$('modalEndTime').setCustomValidity('');weekwiseRuntime.updateDurationFromEnd();});weekwiseRuntime.$('modalEndTime').addEventListener('blur',()=>{if(String(weekwiseRuntime.$('modalEndTime').value||'').trim()){weekwiseRuntime.normalizeEndTimeField(weekwiseRuntime.$('modalEndTime'));weekwiseRuntime.updateDurationFromEnd();}});weekwiseRuntime.$('closeModal').addEventListener('click',()=>weekwiseRuntime.closeTaskModal());weekwiseRuntime.$('taskForm').addEventListener('submit',weekwiseRuntime.saveModalTask);
weekwiseRuntime.$('applyTaskTemplateBtn').addEventListener('click',weekwiseRuntime.applySelectedTaskTemplate);weekwiseRuntime.$('saveTaskTemplateBtn').addEventListener('click',weekwiseRuntime.saveModalAsTaskTemplate);weekwiseRuntime.$('deleteTaskTemplateBtn').addEventListener('click',weekwiseRuntime.deleteSelectedTaskTemplate);weekwiseRuntime.$('taskTemplateSelect').addEventListener('change',()=>{weekwiseRuntime.$('deleteTaskTemplateBtn').disabled=!weekwiseRuntime.$('taskTemplateSelect').value;});weekwiseRuntime.$('deleteTaskBtn').addEventListener('click',()=>{if(WeekwiseTaskHistoryUI.remove(weekwiseRuntime.$('editTaskId').value,weekwiseRuntime.currentWeek))weekwiseRuntime.closeTaskModal(true);});weekwiseRuntime.$('archiveTaskBtn').onclick=()=>{if(WeekwiseTaskHistoryUI.remove(weekwiseRuntime.$('editTaskId').value,weekwiseRuntime.currentWeek,'archive'))weekwiseRuntime.closeTaskModal(true);};weekwiseRuntime.$('seriesScheduleOpen').onclick=()=>{const ref={id:weekwiseRuntime.$('editTaskId').value,week:weekwiseRuntime.currentWeek};weekwiseRuntime.closeTaskModal();if(!weekwiseRuntime.$('taskModal').classList.contains('show'))WeekwiseSeriesScheduleUI.open(ref);};weekwiseRuntime.$('taskModal').addEventListener('click',e=>{if(e.target===weekwiseRuntime.$('taskModal'))weekwiseRuntime.closeTaskModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape'){weekwiseRuntime.closeTaskModal();weekwiseRuntime.closeTemplateEditor();if(weekwiseRuntime.activeUtilityPanel)weekwiseRuntime.closeUtilityPanel();weekwiseRuntime.$('moreActions').open=false;}});weekwiseRuntime.$('quickAddForm').addEventListener('submit',weekwiseRuntime.addQuick);weekwiseRuntime.$('exportBtn').addEventListener('click',weekwiseRuntime.exportBackup);weekwiseRuntime.$('exportEditorHistoryBtn').addEventListener('click',weekwiseRuntime.exportEditorHistory);weekwiseRuntime.$('importBtn').addEventListener('click',()=>weekwiseRuntime.$('importFile').click());weekwiseRuntime.$('importFile').addEventListener('change',e=>{const file=e.target.files&&e.target.files[0];if(file)weekwiseRuntime.loadImport(file);e.target.value='';});weekwiseRuntime.$('printBtn').addEventListener('click',()=>{window.print();weekwiseRuntime.$('moreActions').open=false;});weekwiseRuntime.$('exportBtn').addEventListener('click',()=>weekwiseRuntime.$('moreActions').open=false);weekwiseRuntime.$('importBtn').addEventListener('click',()=>weekwiseRuntime.$('moreActions').open=false);weekwiseRuntime.$('quickDay').value=String(weekwiseRuntime.mobileDay);const mobileQuery=window.matchMedia('(max-width: 650px)');if(mobileQuery.addEventListener)mobileQuery.addEventListener('change',()=>weekwiseRuntime.renderDays());else if(mobileQuery.addListener)mobileQuery.addListener(()=>weekwiseRuntime.renderDays());window.addEventListener('resize',()=>{if(window.innerWidth<=650)weekwiseRuntime.renderMobileDayPicker();});weekwiseRuntime.initializeCloud();setInterval(()=>weekwiseRuntime.checkCloudForRemoteChanges(),15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)weekwiseRuntime.checkCloudForRemoteChanges();});window.addEventListener('focus',()=>weekwiseRuntime.checkCloudForRemoteChanges());window.addEventListener('online',()=>weekwiseRuntime.checkCloudForRemoteChanges());}

function weekwiseTasksOnDate(date){
 const key=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(date)),dateKeyValue=weekwiseRuntime.dateKey(date);
 const source=key===weekwiseRuntime.currentWeek?weekwiseRuntime.tasks:(Array.isArray(weekwiseRuntime.store.weeks[key]&&weekwiseRuntime.store.weeks[key].tasks)?weekwiseRuntime.store.weeks[key].tasks:[]);
 return source.filter(function(t){
  const timed=Number(t.day)===date.getDay()&&t.start!==null&&t.start!==undefined&&!t.unscheduled&&Number(t.duration)>0;
  const allDay=!!t.allDay&&(t.allDayDate||t.dueDate)===dateKeyValue;
  return timed||allDay;
 }).sort(function(a,b){const aa=!!a.allDay,bb=!!b.allDay;if(aa!==bb)return aa?-1:1;return Number(a.start)-Number(b.start);});
}

function weekwiseRenderMonth(){
 const grid=weekwiseRuntime.$('daysGrid');grid.classList.add('month-mode');grid.setAttribute('aria-label','Monthly calendar');
 const picker=weekwiseRuntime.$('mobileDayPicker');if(picker)picker.hidden=true;const help=weekwiseRuntime.$('mobileHelp');if(help)help.hidden=true;
 weekwiseRuntime.updateViewControls();
 const year=weekwiseRuntime.monthAnchor.getFullYear(),month=weekwiseRuntime.monthAnchor.getMonth(),layout=WeekwiseCalendarLayout.month(year,month,weekwiseRuntime.store.settings.calendarGridStartDay),start=layout.start,count=layout.count;
 let markup='<div class="month-calendar">'+layout.weekdays.map(function(i){return '<div class="month-weekday">'+weekwiseRuntime.DAY_SHORT[i]+'</div>';}).join('');
 for(let i=0;i<count;i++){
  const date=new Date(start);date.setDate(start.getDate()+i);
  const key=weekwiseRuntime.dateKey(date),inMonth=date.getMonth()===month,isToday=key===weekwiseRuntime.dateKey(weekwiseRuntime.now),items=weekwiseRuntime.weekwiseTasksOnDate(date);
  const chips=items.slice(0,3).map(function(t){const allDay=!!t.allDay,end=Number(t.start)+Number(t.duration||0),endLabel=end===1440?'24:00':weekwiseRuntime.minsTime(end),when=allDay?'All day':weekwiseRuntime.minsTime(Number(t.start));return '<button type="button" class="month-event-chip '+weekwiseRuntime.categoryClass(t.type)+(t.done?' done':'')+(allDay?' month-event-all-day':'')+'" data-month-event="'+weekwiseRuntime.escapeHtml(t.id)+'" data-month-date="'+key+'" title="'+weekwiseRuntime.escapeHtml(t.title+' · '+(allDay?'All day':weekwiseRuntime.minsTime(Number(t.start))+'–'+endLabel))+'"><span class="month-event-time">'+when+'</span><span class="month-event-title">'+weekwiseRuntime.escapeHtml(t.title)+'</span></button>';}).join('');
  const more=items.length>3?'<div class="month-more">+'+(items.length-3)+' more</div>':'';
  markup+='<div class="month-day-cell '+(inMonth?'':'outside-month')+(isToday?' is-today':'')+'" role="button" tabindex="0" data-month-day="'+key+'" aria-label="'+weekwiseRuntime.escapeHtml(weekwiseRuntime.fmtDate(date,{weekday:'long',day:'numeric',month:'long'}))+', '+items.length+' activities"><div class="month-day-number"><span>'+date.getDate()+'</span>'+(isToday?'<span class="month-today-dot" aria-hidden="true"></span>':'')+'</div><div class="month-event-list">'+chips+more+'</div>'+(items.length?'':'<span class="month-empty-hint">+ Add</span>')+'</div>';
 }
 grid.innerHTML=markup+'</div>';grid.scrollTop=0;grid.scrollLeft=0;grid.dataset.hasRendered='true';
 grid.onclick=function(e){
  if(weekwiseRuntime.calendarView!=='month')return;
  const ev=e.target.closest('[data-month-event]');
  if(ev){e.preventDefault();e.stopPropagation();const date=weekwiseRuntime.parseKey(ev.dataset.monthDate),id=ev.dataset.monthEvent;weekwiseRuntime.saveCurrent();weekwiseRuntime.mobileDay=date.getDay();weekwiseRuntime.currentWeek=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(date));weekwiseRuntime.loadWeek(weekwiseRuntime.currentWeek);weekwiseRuntime.calendarView='day';try{localStorage.setItem('weekwise-calendar-view-v1','day');}catch(_){}weekwiseRuntime.renderAll();const item=weekwiseRuntime.tasks.find(function(t){return t.id===id;});if(item){if(item.fixed)weekwiseRuntime.openFixedSettings(id);else weekwiseRuntime.openTaskModal(id);}return;}
  const cell=e.target.closest('[data-month-day]');
  if(cell){const date=weekwiseRuntime.parseKey(cell.dataset.monthDay);weekwiseRuntime.saveCurrent();weekwiseRuntime.mobileDay=date.getDay();weekwiseRuntime.monthAnchor=new Date(date.getFullYear(),date.getMonth(),1);weekwiseRuntime.currentWeek=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(date));weekwiseRuntime.loadWeek(weekwiseRuntime.currentWeek);weekwiseRuntime.calendarView='day';try{localStorage.setItem('weekwise-calendar-view-v1','day');}catch(_){}weekwiseRuntime.renderAll();weekwiseRuntime.openTaskModal(null,weekwiseRuntime.mobileDay,weekwiseRuntime.dateKey(date)===weekwiseRuntime.dateKey(weekwiseRuntime.now)?weekwiseRuntime.nextQuarterHour():10*60);}
 };
 grid.onkeydown=function(e){if(weekwiseRuntime.calendarView!=='month'||(e.key!=='Enter'&&e.key!==' '))return;const cell=e.target.closest('[data-month-day]');if(cell&&!e.target.closest('[data-month-event]')){e.preventDefault();cell.click();}};
}

function weekwiseRenderBreaks(){
 const grid=weekwiseRuntime.$('daysGrid');grid.querySelectorAll('.break-layer').forEach(function(el){el.remove();});
 if(weekwiseRuntime.store.settings.showBreaks===false)return;
 const hourHeight=56;
 grid.querySelectorAll('.day-column').forEach(function(column){
  const day=Number(column.dataset.dayIndex),items=weekwiseRuntime.tasks.filter(function(t){return Number(t.day)===day&&t.start!==null&&t.start!==undefined&&!t.unscheduled&&Number(t.duration)>0;}).slice().sort(function(a,b){return Number(a.start)-Number(b.start);});
  let covered=null;const gaps=[];
  items.forEach(function(t){const st=Math.max(0,Number(t.start)),en=Math.min(1440,st+Number(t.duration||0));if(covered!==null&&st-covered>=15)gaps.push({start:covered,end:st});covered=covered===null?en:Math.max(covered,en);});
  if(!gaps.length)return;
  const layer=document.createElement('div');layer.className='break-layer';layer.setAttribute('aria-hidden','true');
  layer.innerHTML=gaps.map(function(g){const mins=g.end-g.start,top=g.start/60*hourHeight,pixels=mins/60*hourHeight,height=Math.max(10,Math.min(19,pixels-2)),label=mins>=60?(Math.floor(mins/60)+'h'+(mins%60?' '+(mins%60)+'m':'')+' break'):(mins+'m break');return '<span class="break-gap" style="top:'+(top+Math.max(1,(pixels-height)/2))+'px;height:'+height+'px" title="'+label+' between scheduled activities">'+label+'</span>';}).join('');
  column.appendChild(layer);
 });
}

function weekwiseAnimateCalendar(){
 root.WeekwiseMotion?.calendar();
}

function weekwiseRenderAgenda(){
 const grid=weekwiseRuntime.$('daysGrid');grid.classList.add('agenda-mode');grid.setAttribute('aria-label','Agenda view');
 const picker=weekwiseRuntime.$('mobileDayPicker'),help=weekwiseRuntime.$('mobileHelp');if(picker)picker.hidden=true;if(help)help.hidden=true;
 weekwiseRuntime.updateViewControls();
 const anchor=weekwiseRuntime.dateOnly(weekwiseRuntime.agendaAnchor||weekwiseRuntime.now),end=new Date(anchor);end.setDate(end.getDate()+30);
 const records=weekwiseRuntime.workspaceRecords().filter(r=>weekwiseRuntime.dateOnly(r.date)>=anchor&&weekwiseRuntime.dateOnly(r.date)<end).sort((a,b)=>a.date-b.date||(a.task.start==null?1:b.task.start==null?-1:Number(a.task.start)-Number(b.task.start)));
 const groups=new Map();records.forEach(r=>{const key=weekwiseRuntime.dateKey(r.date);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});
 const label=weekwiseRuntime.fmtDate(anchor,{day:'numeric',month:'short'})+' – '+weekwiseRuntime.fmtDate(new Date(end.getTime()-86400000),{day:'numeric',month:'short'});
 let markup='<div class="agenda-calendar"><div class="agenda-topline"><div><h3>Upcoming agenda</h3><p>'+weekwiseRuntime.escapeHtml(label)+' · grouped by day</p></div><span class="agenda-topline-badge">'+records.length+' tasks</span></div>';
 if(!groups.size)markup+='<div class="agenda-empty"><strong>Your upcoming agenda is clear.</strong><p>Add a task to Inbox or schedule an activity. Future recurring tasks appear here automatically.</p></div>';
 groups.forEach((items,key)=>{
  const date=weekwiseRuntime.parseKey(key),label=weekwiseRuntime.dateKey(date)===weekwiseRuntime.dateKey(weekwiseRuntime.now)?'Today':weekwiseRuntime.dateKey(date)===weekwiseRuntime.dateKey(weekwiseRuntime.addDaysForView(weekwiseRuntime.now,1))?'Tomorrow':weekwiseRuntime.fmtDate(date,{weekday:'long',day:'numeric',month:'short'});
  markup+='<section class="agenda-day-group"><header class="agenda-day-head"><div><h4>'+weekwiseRuntime.escapeHtml(label)+'</h4><small>'+weekwiseRuntime.escapeHtml(weekwiseRuntime.fmtDate(date,{day:'numeric',month:'long',year:'numeric'}))+'</small></div><span class="agenda-day-count">'+items.length+'</span></header>';
  items.forEach(r=>{
   const t=r.task,priority=t.priority||'none',listLabel=weekwiseRuntime.WORKSPACE_LISTS.find(x=>x.id===r.listId)?.label||'Inbox';
   const when=t.allDay?'All day':(t.start==null||t.unscheduled?'Not scheduled':weekwiseRuntime.minsTime(Number(t.start))+(Number(t.duration)>0?' · '+weekwiseRuntime.durationText(Number(t.duration)):''));
   const due=t.dueDate?'<span class="agenda-task-pill">Due '+weekwiseRuntime.escapeHtml(weekwiseRuntime.fmtDate(weekwiseRuntime.parseKey(t.dueDate),{day:'numeric',month:'short'}))+'</span>':'';
   const pr=priority!=='none'?'<span class="agenda-task-pill '+(priority==='high'?'high':priority==='medium'?'medium':'')+'">'+weekwiseRuntime.escapeHtml(({high:'↑ High',medium:'→ Medium',low:'↓ Low'})[priority]||priority)+'</span>':'';
   markup+='<article class="agenda-task-row '+(t.done?'is-done':'')+'"'+WeekwiseTaskOptions.attributes(t)+'><span class="agenda-task-time">'+weekwiseRuntime.escapeHtml(when)+'</span><input class="agenda-task-check" type="checkbox" data-agenda-check="'+weekwiseRuntime.escapeHtml(t.id)+'" data-agenda-week="'+weekwiseRuntime.escapeHtml(r.week)+'" '+(t.done?'checked':'')+' aria-label="Complete '+weekwiseRuntime.escapeHtml(t.title)+'"><div><button type="button" class="agenda-task-title" data-agenda-edit="'+weekwiseRuntime.escapeHtml(t.id)+'" data-agenda-week="'+weekwiseRuntime.escapeHtml(r.week)+'">'+weekwiseRuntime.escapeHtml(t.title)+'</button><div class="agenda-task-meta"><span class="agenda-task-pill">'+weekwiseRuntime.escapeHtml(listLabel)+'</span>'+pr+due+'</div></div><button type="button" class="agenda-task-edit" title="Edit task" aria-label="Edit '+weekwiseRuntime.escapeHtml(t.title)+'" data-agenda-edit="'+weekwiseRuntime.escapeHtml(t.id)+'" data-agenda-week="'+weekwiseRuntime.escapeHtml(r.week)+'">✎</button></article>';
  });
  markup+='</section>';
 });
 markup+='</div>';
 grid.innerHTML=markup;grid.scrollTop=0;grid.scrollLeft=0;grid.dataset.hasRendered='true';
 grid.onclick=e=>{const b=e.target.closest('[data-agenda-edit]');if(b)weekwiseRuntime.openWorkspaceRecord(b.dataset.agendaEdit,b.dataset.agendaWeek);};
 grid.onchange=e=>{const b=e.target.closest('[data-agenda-check]');if(b)weekwiseRuntime.updateWorkspaceRecord(b.dataset.agendaCheck,b.dataset.agendaWeek,'toggle');};
}

function addDaysForView(value,days){const d=weekwiseRuntime.dateOnly(value);d.setDate(d.getDate()+days);return d;}

function weekwiseRenderYear(){
 const grid=weekwiseRuntime.$('daysGrid');grid.classList.add('year-mode');grid.setAttribute('aria-label','Year overview');
 const picker=weekwiseRuntime.$('mobileDayPicker'),help=weekwiseRuntime.$('mobileHelp');if(picker)picker.hidden=true;if(help)help.hidden=true;
 weekwiseRuntime.updateViewControls();
 const countByDate=new Map();weekwiseRuntime.workspaceRecords().forEach(r=>{const key=weekwiseRuntime.dateKey(r.date);countByDate.set(key,(countByDate.get(key)||0)+1);});
 let markup='<div class="agenda-calendar"><div class="agenda-topline"><div><h3>'+weekwiseRuntime.calendarYear+' at a glance</h3><p>Choose any date to open its Day view.</p></div><span class="agenda-topline-badge">12 months</span></div><div class="year-calendar">';
 for(let month=0;month<12;month++){
  const first=new Date(weekwiseRuntime.calendarYear,month,1),layout=WeekwiseCalendarLayout.month(weekwiseRuntime.calendarYear,month,weekwiseRuntime.store.settings.calendarGridStartDay),firstDay=layout.start,total=layout.count;
  markup+='<section class="year-month"><header class="year-month-head"><h3>'+first.toLocaleDateString('en-GB',{month:'long'})+'</h3><span>'+Array.from(countByDate.entries()).filter(([key])=>{const d=weekwiseRuntime.parseKey(key);return d.getFullYear()===weekwiseRuntime.calendarYear&&d.getMonth()===month;}).reduce((n,[,v])=>n+v,0)+' tasks</span></header><div class="year-month-grid">'+layout.weekdays.map(i=>'<span class="year-weekday">'+WeekwiseCalendarLayout.DAY_LETTER[i]+'</span>').join('');
  for(let i=0;i<total;i++){
   const date=new Date(firstDay);date.setDate(firstDay.getDate()+i);
   const key=weekwiseRuntime.dateKey(date),inMonth=date.getMonth()===month,n=countByDate.get(key)||0,today=key===weekwiseRuntime.dateKey(weekwiseRuntime.now);
   markup+='<button type="button" class="year-day '+(!inMonth?'outside ':'')+(today?'today ':'')+(n?'has-items':'')+'" data-year-date="'+key+'" title="'+weekwiseRuntime.escapeHtml(weekwiseRuntime.fmtDate(date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+(n?' · '+n+' tasks':'')+'">'+date.getDate()+'</button>';
  }
  markup+='</div></section>';
 }
 markup+='</div></div>';
 grid.innerHTML=markup;grid.scrollTop=0;grid.scrollLeft=0;grid.dataset.hasRendered='true';
 grid.onclick=e=>{const b=e.target.closest('[data-year-date]');if(!b)return;const date=weekwiseRuntime.parseKey(b.dataset.yearDate);weekwiseRuntime.saveCurrent();weekwiseRuntime.mobileDay=date.getDay();weekwiseRuntime.monthAnchor=new Date(date.getFullYear(),date.getMonth(),1);weekwiseRuntime.currentWeek=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(date));weekwiseRuntime.loadWeek(weekwiseRuntime.currentWeek);weekwiseRuntime.calendarView='day';try{localStorage.setItem('weekwise-calendar-view-v1','day');}catch(_){}weekwiseRuntime.renderAll();};
}

function countdownDays(dateKeyValue){return Math.round((weekwiseRuntime.parseKey(dateKeyValue)-weekwiseRuntime.dateOnly(weekwiseRuntime.now))/86400000);}

function countdownWords(days){if(days===0)return {number:'TODAY',label:'It is happening today'};if(days===1)return {number:'1',label:'day to go'};if(days>1)return {number:String(days),label:'days to go'};if(days===-1)return {number:'1',label:'day ago'};return {number:String(Math.abs(days)),label:'days ago'};}

function renderCountdowns(){
 const list=weekwiseRuntime.$('countdownList');if(!list)return;
 const sorted=weekwiseRuntime.countdowns.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const future=sorted.filter(c=>c.date>=weekwiseRuntime.dateKey(weekwiseRuntime.now)).length,summary=weekwiseRuntime.$('countdownSummary');
 if(summary)summary.innerHTML='<span><strong>'+future+'</strong> upcoming · '+weekwiseRuntime.countdowns.length+' total</span><span>Dates are calculated in your local timezone.</span>';
 if(!sorted.length){list.innerHTML='<div class="countdown-empty"><strong>Give an important date a place in your plan.</strong><p>Add an exam, deadline, trip or personal milestone. Weekwise will keep the remaining days visible here.</p></div>';return;}
 const nearest=sorted.find(c=>c.date>=weekwiseRuntime.dateKey(weekwiseRuntime.now));
 list.innerHTML=sorted.map(c=>{
  const days=weekwiseRuntime.countdownDays(c.date),d=weekwiseRuntime.countdownWords(days),past=days<0;
  return '<article class="countdown-card '+(past?'past ':'')+(nearest?.id===c.id?'nearest':'')+'" data-countdown-card="'+weekwiseRuntime.escapeHtml(c.id)+'"><header class="countdown-card-head"><span class="countdown-card-icon">'+weekwiseRuntime.escapeHtml(c.icon||'⌛')+'</span><div class="countdown-card-info"><h4>'+weekwiseRuntime.escapeHtml(c.title)+'</h4><p>'+weekwiseRuntime.escapeHtml(weekwiseRuntime.fmtDate(weekwiseRuntime.parseKey(c.date),{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</p></div><div class="countdown-card-actions"><button type="button" data-countdown-edit="'+weekwiseRuntime.escapeHtml(c.id)+'" aria-label="Edit '+weekwiseRuntime.escapeHtml(c.title)+'" title="Edit">✎</button><button type="button" data-countdown-delete="'+weekwiseRuntime.escapeHtml(c.id)+'" aria-label="Delete '+weekwiseRuntime.escapeHtml(c.title)+'" title="Delete">×</button></div></header><div class="countdown-card-number">'+weekwiseRuntime.escapeHtml(d.number)+'</div><div class="countdown-card-label">'+weekwiseRuntime.escapeHtml(d.label)+'</div>'+(c.note?'<div class="countdown-card-note">'+weekwiseRuntime.escapeHtml(c.note)+'</div>':'')+'</article>';
 }).join('');
}
return Object.freeze({sortedTasks,taskHTML,renderMobileDayPicker,openFixedSettings,renderDays,openUtilityPanel,closeUtilityPanel,openDashboard,durationText,analyticsGroup,taskEndDate,renderStats,renderUnscheduled,renderHabitSummaries,renderAll,moveTask,swapTasks,setupDragDrop,shiftWeeks,setCalendarView,updateViewControls,shiftPeriod,addQuick,setup,weekwiseTasksOnDate,weekwiseRenderMonth,weekwiseRenderBreaks,weekwiseAnimateCalendar,weekwiseRenderAgenda,addDaysForView,weekwiseRenderYear,countdownDays,countdownWords,renderCountdowns});
}
root.WeekwiseAppCalendar=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
