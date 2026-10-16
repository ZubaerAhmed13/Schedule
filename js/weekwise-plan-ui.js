/* The Plan screen consumes canonical records through a narrow app bridge. */
(function (root) {
  'use strict';
  let app, preview=null, undo=null, overrides={}, mode="build", splitRef=null,lastAccount=null,splitSnapshot=null,placementDirty=false,preferencesEdited=false,preferencesSource=null;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const duration=n=>{const h=Math.floor(n/60),m=n%60;return h?(h+'h'+(m?' '+m+'m':'')):m+'m';};
  const tasksLabel=n=>n+' task'+(n===1?'':'s');
  const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  function announce(message,error=false){$('planStatus').textContent=message;$('planStatus').dataset.error=String(error);}
  function fingerprint(){return JSON.stringify(app.snapshot());}
  function readPreferences(){return root.WeekwisePlanning.preferences({days:[...document.querySelectorAll('[name="planDay"]:checked')].map(el=>Number(el.value)),start:parseTime($('planStart').value),end:parseTime($('planEnd').value),buffer:Number($('planBuffer').value),breakMinutes:Number($('planBreak').value),weeklyBuffer:Number($('planWeeklyBuffer').value),maxDailyMinutes:Number($('planDailyLimit').value),focusStart:$('planFocusStart').value?parseTime($('planFocusStart').value):null,focusEnd:$('planFocusEnd').value?parseTime($('planFocusEnd').value):null,windows:[...$('planWindows').children].map(row=>({days:[Number(row.querySelector('select').value)],start:parseTime(row.querySelector('[data-window-start]').value),end:parseTime(row.querySelector('[data-window-end]').value)}))});}
  function addWindow(window={days:[1],start:540,end:720}){const row=document.createElement('div');row.className='plan-window-row';row.innerHTML='<label>Weekday<select>'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label,i)=>'<option value="'+i+'">'+label+'</option>').join('')+'</select></label><label>From<input type="time" data-window-start required></label><label>Until<input type="time" data-window-end required></label><button class="btn" type="button" aria-label="Remove availability window">Remove</button>';row.querySelector('select').value=window.days[0];row.querySelector('[data-window-start]').value=time(window.start);row.querySelector('[data-window-end]').value=time(window.end);row.querySelector('button').onclick=()=>{preferencesEdited=true;row.remove();clearPreview();};$('planWindows').append(row);}
  function parseTime(value){if(!/^\d{2}:\d{2}$/.test(value))throw new Error('Enter planning hours.');const [h,m]=value.split(':').map(Number);return h*60+m;}
  function renderOverview(){
    try{
      const snapshot=app.snapshot(),prefs=readPreferences(),week=weekKey(),zone=snapshot.store.settings.timeZone;
      const records=Object.entries(snapshot.store.weeks).flatMap(([key,value])=>(value.tasks||[]).map(task=>({week:key,task,dateKey:root.WeekwisePlanning.dateAt(key,task.day)})));
      const workload=root.WeekwiseInsights.weekly(records,week,[],zone),peak=Math.max(60,...workload.days.map(day=>day.minutes));
      const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],days=prefs.days.length===5&&prefs.days.every((day,i)=>day===i+1)?'Weekdays':prefs.days.map(day=>names[day]).join(', ')||'No days selected';
      $('planPreferenceSummary').textContent=days+' · '+time(prefs.start)+'–'+time(prefs.end)+' · '+duration(prefs.buffer)+' daily buffer'+(prefs.windows.length?' · custom windows':'');
      const rangeLabel=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
      $('planOverviewRange').textContent=rangeLabel(week)+' – '+rangeLabel(root.WeekwisePlanning.dateAt(week,6));
      $('planOverviewDays').innerHTML=workload.days.map(day=>'<article class="plan-overview-day"><strong>'+esc(new Date(day.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'}))+'</strong><div class="plan-load-track" aria-hidden="true"><span style="width:'+Math.round(day.minutes/peak*100)+'%"></span></div><small>'+duration(day.minutes)+' scheduled</small></article>').join('');
      const r=root.WeekwisePlanning.readiness(snapshot.store,week);
      $('planReadiness').innerHTML=[['Ready to place',r.ready.length,'Estimated; placement still needs a preview'],['Needs an estimate',r.missing.length,'Add an estimate before building a placement'],['Already scheduled',r.scheduled,'Unfinished calendar activities this week'],['Highlighted, unplanned',r.highlighted.length,'Chosen highlights still needing calendar time']].map(([label,count,note])=>'<article><span>'+label+'</span><strong>'+count+'</strong><small>'+note+'</small></article>').join('');
      $('planMissingEstimates').hidden=!r.missing.length;
      $('planMissingSummary').textContent='Review '+r.missing.length+' missing estimate'+(r.missing.length===1?'':'s');
      const missingHTML=r.missing.slice(0,5).map(({week,task})=>'<li><strong>'+esc(task.title)+'</strong><button class="btn" type="button" data-plan-edit-ref="'+esc(week+'::'+task.id)+'" data-plan-edit-id="'+esc(task.id)+'" data-plan-edit-week="'+esc(week)+'">Add estimate</button></li>').join('');
      if($('planMissingTasks').innerHTML!==missingHTML)$('planMissingTasks').innerHTML=missingHTML;
      $('planMissingNote').textContent=r.missing.length>5?'Showing the first five. More appear as these estimates are added.':'Set Estimated duration or Estimated focus in Priority & planning. Calendar duration alone is not an estimate.';
      $('planOverviewNote').textContent='Saved schedule in '+(zone||'your planner time zone')+'. Bars describe the selected week; overlaps count once. Build considers unfinished unscheduled flexible tasks through this week, including Inbox. '+(r.future?r.future+' later-dated flexible task'+(r.future===1?' is':'s are')+' outside this week. ':'')+'Highlights remain intentions until assigned a time. Building a preview does not change tasks.';
    }catch(_){$('planReadiness').replaceChildren();$('planMissingTasks').replaceChildren();$('planMissingEstimates').hidden=true;$('planPreferenceSummary').textContent='Review your hours';$('planOverviewDays').replaceChildren();$('planOverviewRange').textContent='';$('planOverviewNote').textContent='Choose valid planning preferences to see this week.';}
  }
  function weekKey(){const raw=$('planWeek').value;if(!root.WeekwiseData.validDate(raw))throw new Error('Choose a valid week.');const date=new Date(raw+'T12:00:00');const first=1;date.setDate(date.getDate()-(date.getDay()-first+7)%7);return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
  function clearPreview(){preview=null;$('planResults').hidden=true;$('planApply').disabled=true;renderOverview();announce('Build a new preview to use these preferences. Your tasks have not changed.');}
  function buildPreview({selection=null}={}){
    try{
      const snapshot=app.snapshot(),clock=root.WeekwisePlanning.planningClock(snapshot.store),week=weekKey();$('planWeek').value=week;
      const plan=root.WeekwisePlanning.build({store:snapshot.store,weekStart:week,prefs:readPreferences(),notBefore:{date:clock.date,minute:Math.floor(clock.minute)+1},mode,overrides});
      preview={plan,fingerprint:JSON.stringify(snapshot),account:app.account(),createdAt:Date.now(),selection:selection===null?null:new Set(selection)};
      renderPreview();announce(tasksLabel(plan.proposals.length)+' suggested; '+tasksLabel(plan.unscheduled.length)+(plan.unscheduled.length===1?' needs':' need')+' a decision. Review and select the changes you want to apply.');
    }catch(error){announce(error.message,true);}
  }
  function renderPreview(){placementDirty=false;
    const p=preview.plan;$('planPreviewTitle').textContent=p.mode==='recover'?'Review recovery adjustments':'Suggested placements';$('planRecoveryNote').textContent=p.mode==='recover'?'What changed: unfinished past activities or overlapping commitments. Only flexible activities appear here. Original slots stay reserved until you approve a move; some work may need a different week or revised deadline.':'';
    $('planResults').hidden=false;
    $('planCapacityNote').textContent='Planning zone: '+(p.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone)+'. Existing commitments stay in place. Capacity excludes '+duration(p.existingBreaks)+' of existing breaks, '+duration(p.reservedBuffer)+' of daily/weekly buffers and '+duration(p.dailyLimitReserved)+' reserved by daily limits.'+(p.clockChangeReserved?' Clock-change review excludes '+duration(p.clockChangeReserved)+'.':'')+' Selected task breaks are shown below.';
    $('planWarning').hidden=!(p.overcommitted||p.overlaps.length||p.unscheduled.length);
    $('planWarning').textContent=[p.overcommitted?'The estimated backlog exceeds flexible capacity. Your selected plan below uses only the checked suggestions.':'',p.overlaps.length?'Existing commitments overlap. The overlap is counted once; review it in Calendar.':'',p.unknown?tasksLabel(p.unknown)+(p.unknown===1?' needs':' need')+' a duration estimate before placement.':'',p.unscheduled.length?tasksLabel(p.unscheduled.length)+(p.unscheduled.length===1?' remains':' remain')+' unchanged; review the reasons below.':''].filter(Boolean).join(' ');
    $('planProposals').innerHTML=p.proposals.length?p.proposals.map((item,index)=>'<article class="plan-proposal" aria-labelledby="planProposalTitle'+index+'" data-plan-ref="'+esc(item.week+'::'+item.id)+'"><label><input type="checkbox" name="planProposal" value="'+index+'" '+(preview.selection===null||preview.selection.has(item.week+'::'+item.id)?'checked':'')+'><strong id="planProposalTitle'+index+'">'+esc(item.title)+'</strong></label><div><span class="plan-proposal-time">'+(item.recovery?'Previously '+esc(item.week)+' · '+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][item.from.day]+' '+time(item.from.start)+' → ':'')+esc(item.date)+' · '+time(item.start)+'–'+time(item.start+item.duration)+'</span><small>'+esc(item.reason)+'</small><div class="plan-placement"><label>Date<input type="date" data-placement-date="'+index+'" value="'+item.date+'"></label><label>Start<input type="time" data-placement-start="'+index+'" value="'+time(item.start)+'"></label><button type="button" class="btn" data-placement-apply="'+index+'">Check placement</button>'+(overrides[item.week+'::'+item.id]?'<button type="button" class="btn" data-plan-clear-id="'+esc(item.id)+'" data-plan-clear-week="'+esc(item.week)+'">Use suggested time</button>':'')+'</div></div></article>').join(''):'<div class="plan-empty">'+(p.mode==='recover'?'No flexible activity needs recovery, or none fits the remaining hours. Review any deadline risks below.':'No suggestions yet. Add a flexible task with an explicit duration estimate and choose planning hours.')+'</div>';
    const labels={'estimate':'Needs an estimate','deadline-invalid':'Review deadline','deadline-passed':'Deadline passed','deadline-week':'Earlier week needed','availability':'Review availability','capacity':'No remaining capacity','deadline-slot':'Deadline at risk','continuous-slot':'Needs a longer gap','placement':'Check chosen time'};
    const taskMap=new Map(Object.entries(app.snapshot().store.weeks).flatMap(([week,value])=>value.tasks.map(task=>[week+'::'+task.id,task])));
    $('planUnscheduled').innerHTML=p.unscheduled.length?p.unscheduled.map(item=>{
      const task=taskMap.get(item.week+'::'+item.id),canSplit=task&&!root.WeekwisePlanning.isProtected(task);
      return '<li data-plan-issue="'+esc(item.code)+'"><div><small class="plan-issue-label">'+esc(labels[item.code]||'Needs a decision')+'</small><strong>'+esc(item.title)+'</strong><p>'+esc(item.reason)+'</p></div><div class="plan-actions"><button class="btn" type="button" data-plan-edit-ref="'+esc(item.week+'::'+item.id)+'" data-plan-edit-id="'+esc(item.id)+'" data-plan-edit-week="'+esc(item.week)+'">Edit task</button>'+(canSplit?'<button class="btn" type="button" data-plan-split-id="'+esc(item.id)+'" data-plan-split-week="'+esc(item.week)+'">Split task</button>':'')+(overrides[item.week+'::'+item.id]?'<button class="btn" type="button" data-plan-clear-id="'+esc(item.id)+'" data-plan-clear-week="'+esc(item.week)+'">Use suggested time</button>':'')+'</div></li>';
    }).join(''):'<li class="plan-empty">No eligible tasks were left unscheduled.</li>';
    selectionCount();
  }
  function selectedRefs(){return [...document.querySelectorAll('[name="planProposal"]:checked')].map(el=>{const p=preview.plan.proposals[Number(el.value)];return p.week+'::'+p.id;});}
  function selectionCount(){
    if(!preview)return;const p=preview.plan,r=root.WeekwisePlanning.review(p,selectedRefs());
    $('planSelectionCount').textContent=r.count+' of '+p.proposals.length+' selected';
    $('planApply').disabled=placementDirty||!r.count||preview.fingerprint!==fingerprint()||preview.account!==app.account();
    $('planReviewSummary').textContent=(placementDirty?'Check placement edits first. This summary uses the last checked slots. ':'')+(r.count?r.count+' selected · '+duration(r.taskMinutes)+' of task time + '+duration(r.breakMinutes)+' of breaks. '+(r.unchanged+p.unscheduled.length)+' eligible task'+(r.unchanged+p.unscheduled.length===1?' stays':'s stay')+' unchanged.':'Nothing will change. Select a suggestion to include it in your plan.');
    $('planSummary').innerHTML=[['Planning time',p.available],['Already committed',p.committed],['Reserved buffer',p.reservedBuffer],['Flexible capacity',p.capacity],['Left after selection',r.remaining]].map(([label,value])=>'<div class="plan-metric"><span>'+label+'</span><strong>'+duration(value)+'</strong></div>').join('');
    $('planDayCapacity').innerHTML=r.days.length?r.days.map(d=>'<div class="plan-day-capacity"><span>'+esc(new Date(d.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}))+'</span><strong>'+duration(d.selectedMinutes)+' selected · '+duration(d.remaining)+' left</strong><small>'+duration(d.selectedBreaks)+' of selected breaks</small><small>'+(d.lastFinish===null?'No selected tasks':'Selected tasks finish '+time(d.lastFinish))+'</small></div>').join(''):'<p>No planning hours remain in this week. Choose a future week or update your availability.</p>';
  }
  function focusPlacement(ref){
    const row=[...$('planProposals').children].find(el=>el.dataset.planRef===ref),target=row?.querySelector('[data-placement-apply]')||$('planPreviewTitle');
    if(target.tagName!=='BUTTON')target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'instant'});
  }
  function clearPlacement(button){const ref=button.dataset.planClearWeek+'::'+button.dataset.planClearId,selection=selectedRefs();delete overrides[ref];buildPreview({selection});focusPlacement(ref);}

  function applySelected(){
    try{
      if(!preview)throw new Error('Build a preview first.');if(placementDirty)throw new Error('Check your edited placement before applying the preview.');
      if(preview.fingerprint!==fingerprint() || preview.account!==app.account())throw new Error('Your planner or account changed. Build a fresh preview before applying.');
      if(Date.now()-preview.createdAt>5*60*1000)throw new Error('This preview is more than five minutes old. Build a fresh preview.');
      const selected=[...document.querySelectorAll('[name="planProposal"]:checked')].map(el=>preview.plan.proposals[Number(el.value)]);
      if(!selected.length)throw new Error('Select at least one suggested task.');
      const now=new Date();
      for(const item of selected){
        const slot=root.WeekwisePlanning.planningSlot(app.snapshot().store,item);
        if(slot.scheduleInstant.start<=now.getTime())throw new Error('A suggested start has already passed in the saved planner zone. Build a fresh preview.');
      }
      const before=app.snapshot().store,next=root.WeekwisePlanning.apply(before,preview.plan,selected.map(p=>p.week+'::'+p.id));
      const expected=preview.fingerprint,account=preview.account;
      app.commit(expected,account,next,'weekwise-pre-plan-v1');
      undo={store:before,account,fingerprint:fingerprint()};
      preview=null;$('planResults').hidden=true;$('planApply').disabled=true;$('planUndo').hidden=false;
      announce(selected.length+' tasks scheduled and saved locally. Use Undo if you change your mind.');
    }catch(error){announce(error.message,true);}
  }
  function undoPlan(){
    try{
      if(!undo)return;
      if(undo.account!==app.account()||undo.fingerprint!==fingerprint())throw new Error('Your planner changed after this plan. Undo is paused to protect newer edits. The pre-plan checkpoint remains on this device.');
      app.commit(undo.fingerprint,undo.account,undo.store);
      undo=null;$('planUndo').hidden=true;announce('Planning changes undone and saved locally.');
    }catch(error){announce(error.message,true);}
  }
  function render(){if(!app)return;const ownerChanged=lastAccount!==app.account();if(!ownerChanged&&$('planWorkspace').hidden)return;if(ownerChanged){lastAccount=app.account();preview=null;undo=null;overrides={};preferencesEdited=false;preferencesSource=null;$('planMissingEstimates').open=false;$('planResults').hidden=true;['planSummary','planProposals','planUnscheduled','planDayCapacity'].forEach(id=>$(id).replaceChildren());['planReviewSummary','planSelectionCount','planCapacityNote','planWarning','planRecoveryNote'].forEach(id=>$(id).textContent='');$('planApply').disabled=true;$('planUndo').hidden=true;$('planWeek').value='';$('planStart').value='09:00';$('planEnd').value='17:00';$('planBuffer').value=60;$('planBreak').value=10;$('planWeeklyBuffer').value=0;$('planDailyLimit').value=480;$('planFocusStart').value='';$('planFocusEnd').value='';$('planWindows').replaceChildren();document.querySelectorAll('[name=planDay]').forEach(el=>el.checked=[1,2,3,4,5].includes(Number(el.value)));announce('Choose planning hours for this planner.');}const p=app.snapshot().store.settings.planning;
    const source=JSON.stringify(p||null);
    if(!$('planWeek').value||(!preferencesEdited&&preferencesSource!==source)){if(!$('planWeek').value)$('planWeek').value=app.currentWeek();preferencesSource=source;if(p){try{const pref=root.WeekwisePlanning.preferences(p);$('planStart').value=time(pref.start);$('planEnd').value=time(pref.end);$('planBuffer').value=pref.buffer;$('planBreak').value=pref.breakMinutes;$('planWeeklyBuffer').value=pref.weeklyBuffer;$('planDailyLimit').value=pref.maxDailyMinutes;$('planFocusStart').value=pref.focusStart===null?'':time(pref.focusStart);$('planFocusEnd').value=pref.focusEnd===null?'':time(pref.focusEnd);$('planWindows').replaceChildren();pref.windows.forEach(w=>w.days.forEach(day=>addWindow({...w,days:[day]})));document.querySelectorAll('[name="planDay"]').forEach(el=>el.checked=pref.days.includes(Number(el.value)));}catch(_){announce('Saved planning preferences need review.',true);}}}
    if(preview&&preview.fingerprint!==fingerprint()){announce('Your planner changed. Build a fresh preview before applying.',true);$('planApply').disabled=true;}
    renderOverview();
  }
  function addPart(title='',minutes=''){if($('planSplitParts').children.length>=12)return;const row=document.createElement('div');row.className='plan-window-row';row.innerHTML='<label>Part name<input type="text" maxlength="100" required></label><label>Minutes<input type="number" min="5" max="1440" step="5" required></label><button class="btn" type="button">Remove</button>';row.querySelector('input[type="text"]').value=title;row.querySelector('input[type="number"]').value=minutes;row.querySelector('button').onclick=()=>row.remove();$('planSplitParts').append(row);}
  function openSplit(ref){const task=app.snapshot().store.weeks[ref.week]?.tasks.find(t=>t.id===ref.id);if(!task||root.WeekwisePlanning.isProtected(task)){announce('Fixed and recurring commitments cannot be split here.',true);return;}splitRef=ref;splitSnapshot={account:app.account(),fingerprint:fingerprint()};$('planSplitDescription').textContent=task.title;$('planSplitParts').replaceChildren();$('planSplitStatus').textContent='';addPart();addPart();$('planSplitDialog').showModal();}
  function init(bridge){
    app=bridge;
    const shiftWeek=delta=>{$('planWeek').value=root.WeekwisePlanning.dateAt(weekKey(),delta);overrides={};clearPreview();};
    $('planPreviousWeek').onclick=()=>shiftWeek(-7);$('planNextWeek').onclick=()=>shiftWeek(7);$('planCurrentWeek').onclick=()=>{$('planWeek').value=root.WeekwiseCalendarRange.range(app.todayKey(),1)[0];overrides={};clearPreview();};
    $('planCapture').onclick=()=>document.getElementById('globalCaptureBtn').click();
    for(const [id,checked]of [['planSelectAll',true],['planSelectNone',false]])$(id).onclick=()=>{document.querySelectorAll('[name="planProposal"]').forEach(input=>input.checked=checked);selectionCount();};
    $('planPreferences').addEventListener('submit',e=>{e.preventDefault();mode='build';overrides={};buildPreview();});
    $('planPreferences').addEventListener('input',()=>{preferencesEdited=true;overrides={};clearPreview();});$('planAddWindow').onclick=()=>{preferencesEdited=true;addWindow();clearPreview();};$('planRecover').onclick=()=>{mode='recover';overrides={};buildPreview();};
    $('planApply').addEventListener('click',applySelected);$('planUndo').addEventListener('click',undoPlan);
    $('planSavePreferences').addEventListener('click',()=>{try{const snapshot=app.snapshot(),next=JSON.parse(JSON.stringify(snapshot.store));next.settings.planning=readPreferences();app.commit(JSON.stringify(snapshot),app.account(),next);preferencesEdited=false;preferencesSource=JSON.stringify(next.settings.planning);clearPreview();announce('Planning preferences saved locally.');}catch(error){announce(error.message,true);}});
    $('planMissingTasks').addEventListener('click',e=>{const button=e.target.closest('[data-plan-edit-id]');if(button){app.edit(button.dataset.planEditId,button.dataset.planEditWeek);$('taskPriorityOptions').open=true;$('modalDurationEstimate').focus();}});
    $('planUnscheduled').addEventListener('click',e=>{const button=e.target.closest('[data-plan-edit-id]');if(button)app.edit(button.dataset.planEditId,button.dataset.planEditWeek);const split=e.target.closest('[data-plan-split-id]');if(split)openSplit({id:split.dataset.planSplitId,week:split.dataset.planSplitWeek});const clear=e.target.closest('[data-plan-clear-id]');if(clear&&preview)clearPlacement(clear);});
    $('planProposals').addEventListener('input',e=>{if(e.target.matches('[data-placement-date],[data-placement-start]')){placementDirty=true;selectionCount();announce('Check your edited placement to validate it before applying.');}});
    $('planProposals').addEventListener('change',selectionCount);
    $('planProposals').addEventListener('click',e=>{const clear=e.target.closest('[data-plan-clear-id]');if(clear&&preview){clearPlacement(clear);return;}const button=e.target.closest('[data-placement-apply]');if(!button||!preview)return;try{const i=Number(button.dataset.placementApply),item=preview.plan.proposals[i],ref=item.week+'::'+item.id,selection=selectedRefs();overrides[ref]={date:$('planProposals').querySelector('[data-placement-date="'+i+'"]').value,start:parseTime($('planProposals').querySelector('[data-placement-start="'+i+'"]').value)};buildPreview({selection});focusPlacement(ref);}catch(error){announce(error.message,true);}});
    $('planCancelSplit').onclick=()=>$('planSplitDialog').close();$('planAddPart').onclick=()=>addPart();$('planSplitForm').onsubmit=e=>{e.preventDefault();try{if(splitSnapshot.account!==app.account()||splitSnapshot.fingerprint!==fingerprint())throw new Error('Your planner changed. Close this dialog and start splitting again.');const snapshot=app.snapshot(),parts=[...$('planSplitParts').children].map(row=>({title:row.querySelector('input[type="text"]').value,minutes:Number(row.querySelector('input[type="number"]').value)}));const next=root.WeekwisePlanning.splitTask(snapshot.store,splitRef,parts,()=>root.crypto.randomUUID());app.commit(JSON.stringify(snapshot),app.account(),next,'weekwise-pre-split-v1');$('planSplitDialog').close();overrides={};buildPreview();announce('Linked parts saved. Review their placements before applying.');}catch(error){$('planSplitStatus').textContent=error.message;}};
    render();
  }
  function recoverToday(){
    render();const clock=root.WeekwisePlanning.planningClock(app.snapshot().store);
    $('planWeek').value=root.WeekwiseCalendarRange.range(clock.date,1)[0];mode='recover';overrides={};renderOverview();buildPreview();
    const target=$('planResults').hidden?$('planStatus'):$('planPreviewTitle');
    target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'instant'});
  }
  root.WeekwisePlanUI=Object.freeze({init,render,recoverToday});
})(window);
