/* The Plan screen consumes canonical records through a narrow app bridge. */
(function (root) {
  'use strict';
  let app, preview=null, undo=null, overrides={}, mode="build", splitRef=null,lastAccount=null,splitSnapshot=null,placementDirty=false;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const duration=n=>{const h=Math.floor(n/60),m=n%60;return h?(h+'h'+(m?' '+m+'m':'')):m+'m';};
  const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  function announce(message,error=false){$('planStatus').textContent=message;$('planStatus').dataset.error=String(error);}
  function fingerprint(){return JSON.stringify(app.snapshot());}
  function readPreferences(){return root.WeekwisePlanning.preferences({days:[...document.querySelectorAll('[name="planDay"]:checked')].map(el=>Number(el.value)),start:parseTime($('planStart').value),end:parseTime($('planEnd').value),buffer:Number($('planBuffer').value),breakMinutes:Number($('planBreak').value),weeklyBuffer:Number($('planWeeklyBuffer').value),maxDailyMinutes:Number($('planDailyLimit').value),focusStart:$('planFocusStart').value?parseTime($('planFocusStart').value):null,focusEnd:$('planFocusEnd').value?parseTime($('planFocusEnd').value):null,windows:[...$('planWindows').children].map(row=>({days:[Number(row.querySelector('select').value)],start:parseTime(row.querySelector('[data-window-start]').value),end:parseTime(row.querySelector('[data-window-end]').value)}))});}
  function addWindow(window={days:[1],start:540,end:720}){const row=document.createElement('div');row.className='plan-window-row';row.innerHTML='<label>Weekday<select>'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label,i)=>'<option value="'+i+'">'+label+'</option>').join('')+'</select></label><label>From<input type="time" data-window-start required></label><label>Until<input type="time" data-window-end required></label><button class="btn" type="button" aria-label="Remove availability window">Remove</button>';row.querySelector('select').value=window.days[0];row.querySelector('[data-window-start]').value=time(window.start);row.querySelector('[data-window-end]').value=time(window.end);row.querySelector('button').onclick=()=>{row.remove();clearPreview();};$('planWindows').append(row);}
  function parseTime(value){if(!/^\d{2}:\d{2}$/.test(value))throw new Error('Enter planning hours.');const [h,m]=value.split(':').map(Number);return h*60+m;}
  function renderOverview(){
    try{
      const snapshot=app.snapshot(),prefs=readPreferences(),week=weekKey(),zone=snapshot.store.settings.timeZone;
      const records=Object.entries(snapshot.store.weeks).flatMap(([key,value])=>(value.tasks||[]).map(task=>({week:key,task,dateKey:root.WeekwisePlanning.dateAt(key,task.day)})));
      const workload=root.WeekwiseInsights.weekly(records,week,[],zone),peak=Math.max(60,...workload.days.map(day=>day.minutes));
      const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],days=prefs.days.length===5&&prefs.days.every((day,i)=>day===i+1)?'Weekdays':prefs.days.map(day=>names[day]).join(', ')||'No days selected';
      $('planPreferenceSummary').textContent=days+' · '+time(prefs.start)+'–'+time(prefs.end)+' · '+duration(prefs.buffer)+' daily buffer'+(prefs.windows.length?' · custom windows':'');
      $('planOverviewRange').textContent=week+' — '+root.WeekwisePlanning.dateAt(week,6);
      $('planOverviewDays').innerHTML=workload.days.map(day=>'<article class="plan-overview-day"><strong>'+esc(new Date(day.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'}))+'</strong><div class="plan-load-track" aria-hidden="true"><span style="width:'+Math.round(day.minutes/peak*100)+'%"></span></div><small>'+duration(day.minutes)+' scheduled</small></article>').join('');
      $('planOverviewNote').textContent='Saved schedule in '+(zone||'your planner time zone')+'. Overlaps count once. This overview does not change tasks; build a preview to check availability and suggested placements.';
    }catch(_){$('planPreferenceSummary').textContent='Review your hours';$('planOverviewNote').textContent='Choose valid planning preferences to see this week.';}
  }
  function weekKey(){const raw=$('planWeek').value;if(!root.WeekwiseData.validDate(raw))throw new Error('Choose a valid week.');const date=new Date(raw+'T12:00:00');const first=app.snapshot().store.settings.weekStartsOn===1?1:0;date.setDate(date.getDate()-(date.getDay()-first+7)%7);return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
  function clearPreview(){preview=null;$('planResults').hidden=true;$('planApply').disabled=true;announce('Build a new preview to use these preferences. Your tasks have not changed.');}
  function buildPreview(){
    try{
      const snapshot=app.snapshot(),clock=root.WeekwisePlanning.planningClock(snapshot.store),week=weekKey();$('planWeek').value=week;
      const plan=root.WeekwisePlanning.build({store:snapshot.store,weekStart:week,prefs:readPreferences(),notBefore:{date:clock.date,minute:Math.floor(clock.minute)+1},mode,overrides});
      preview={plan,fingerprint:JSON.stringify(snapshot),account:app.account(),createdAt:Date.now()};
      renderPreview();announce(plan.proposals.length+' tasks suggested. Review and select the changes you want to apply.');
    }catch(error){announce(error.message,true);}
  }
  function renderPreview(){placementDirty=false;
    const p=preview.plan;$('planPreviewTitle').textContent=p.mode==='recover'?'Review recovery adjustments':'Suggested placements';$('planRecoveryNote').textContent=p.mode==='recover'?'What changed: unfinished past activities or overlapping commitments. Only flexible activities appear here. Original slots stay reserved until you approve a move; some work may need a different week or revised deadline.':'';
    $('planResults').hidden=false;
    $('planSummary').innerHTML=[['Planning time',p.available],['Already committed',p.committed],['Reserved buffer',p.reservedBuffer],['Flexible capacity',p.capacity],['Remaining after preview',p.remaining]].map(([label,value])=>'<div class="plan-metric"><span>'+label+'</span><strong>'+duration(value)+'</strong></div>').join('');
    $('planCapacityNote').textContent='Planning clock: '+(p.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone)+'. '+(p.clockChangeReserved?'Clock-change review excludes '+duration(p.clockChangeReserved)+'. ':'')+'Capacity uses only your chosen hours. Existing breaks reserve '+duration(p.existingBreaks)+', and suggested-task breaks reserve '+duration(p.proposalBreaks)+'. All-day events block that day. '+p.protectedCount+' existing calendar commitments remain unchanged.';
    $('planWarning').hidden=!(p.overcommitted||p.overlaps.length||p.unknown);
    $('planWarning').textContent=[p.overcommitted?duration(p.overcommitted)+' more estimated work and suggested breaks than flexible capacity. Review priorities or keep tasks unscheduled.':'',p.overlaps.length?'Existing commitments overlap. The overlap is counted once; review it in Calendar.':'',p.unknown?p.unknown+' tasks need a duration estimate before they can be placed.':''].filter(Boolean).join(' ');
    $('planDayCapacity').innerHTML=p.days.length?p.days.map(d=>'<div class="plan-day-capacity"><span>'+esc(new Date(d.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}))+'</span><strong>'+duration(d.capacity)+' available for tasks</strong></div>').join(''):'<p>No planning hours remain in this week. Choose a future week or update your availability.</p>';
    $('planProposals').innerHTML=p.proposals.length?p.proposals.map((item,index)=>'<article class="plan-proposal"><label><input type="checkbox" name="planProposal" value="'+index+'" checked><strong>'+esc(item.title)+'</strong></label><div><span class="plan-proposal-time">'+(item.recovery?'Previously '+esc(item.week)+' · '+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][item.from.day]+' '+time(item.from.start)+' → ':'')+esc(item.date)+' · '+time(item.start)+'–'+time(item.start+item.duration)+'</span><small>'+esc(item.reason)+'</small><div class="plan-placement"><label>Date<input type="date" data-placement-date="'+index+'" value="'+item.date+'"></label><label>Start<input type="time" data-placement-start="'+index+'" value="'+time(item.start)+'"></label><button type="button" class="btn" data-placement-apply="'+index+'">Check placement</button></div></div></article>').join(''):'<div class="plan-empty">'+(p.mode==='recover'?'No flexible activity needs recovery, or none fits the remaining hours. Review any deadline risks below.':'No suggestions yet. Add a flexible task with an explicit duration estimate and choose planning hours.')+'</div>';
    $('planUnscheduled').innerHTML=p.unscheduled.length?p.unscheduled.map(item=>'<li><div><strong>'+esc(item.title)+'</strong><p>'+esc(item.reason)+'</p></div><button class="btn" type="button" data-plan-edit-id="'+esc(item.id)+'" data-plan-edit-week="'+esc(item.week)+'">Edit task</button><button class="btn" type="button" data-plan-split-id="'+esc(item.id)+'" data-plan-split-week="'+esc(item.week)+'">Split task</button></li>').join(''):'<li class="plan-empty">No eligible tasks were left unscheduled.</li>';
    $('planApply').disabled=!p.proposals.length;
  }
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
  function render(){if(!app)return;if(lastAccount!==app.account()){lastAccount=app.account();preview=null;undo=null;overrides={};$('planResults').hidden=true;$('planApply').disabled=true;$('planUndo').hidden=true;$('planWeek').value='';$('planStart').value='09:00';$('planEnd').value='17:00';$('planBuffer').value=60;$('planBreak').value=10;$('planWeeklyBuffer').value=0;$('planDailyLimit').value=480;$('planFocusStart').value='';$('planFocusEnd').value='';$('planWindows').replaceChildren();document.querySelectorAll('[name=planDay]').forEach(el=>el.checked=[1,2,3,4,5].includes(Number(el.value)));announce('Choose planning hours for this planner.');}const p=app.snapshot().store.settings.planning;
    if(!$('planWeek').value){$('planWeek').value=app.currentWeek();if(p){try{const pref=root.WeekwisePlanning.preferences(p);$('planStart').value=time(pref.start);$('planEnd').value=time(pref.end);$('planBuffer').value=pref.buffer;$('planBreak').value=pref.breakMinutes;$('planWeeklyBuffer').value=pref.weeklyBuffer;$('planDailyLimit').value=pref.maxDailyMinutes;$('planFocusStart').value=pref.focusStart===null?'':time(pref.focusStart);$('planFocusEnd').value=pref.focusEnd===null?'':time(pref.focusEnd);$('planWindows').replaceChildren();pref.windows.forEach(w=>w.days.forEach(day=>addWindow({...w,days:[day]})));document.querySelectorAll('[name="planDay"]').forEach(el=>el.checked=pref.days.includes(Number(el.value)));}catch(_){announce('Saved planning preferences need review.',true);}}}
    if(preview&&preview.fingerprint!==fingerprint()){announce('Your planner changed. Build a fresh preview before applying.',true);$('planApply').disabled=true;}
    renderOverview();
  }
  function addPart(title='',minutes=''){if($('planSplitParts').children.length>=12)return;const row=document.createElement('div');row.className='plan-window-row';row.innerHTML='<label>Part name<input type="text" maxlength="100" required></label><label>Minutes<input type="number" min="5" max="1440" step="5" required></label><button class="btn" type="button">Remove</button>';row.querySelector('input[type="text"]').value=title;row.querySelector('input[type="number"]').value=minutes;row.querySelector('button').onclick=()=>row.remove();$('planSplitParts').append(row);}
  function openSplit(ref){const task=app.snapshot().store.weeks[ref.week]?.tasks.find(t=>t.id===ref.id);if(!task||root.WeekwisePlanning.isProtected(task)){announce('Fixed and recurring commitments cannot be split here.',true);return;}splitRef=ref;splitSnapshot={account:app.account(),fingerprint:fingerprint()};$('planSplitDescription').textContent=task.title;$('planSplitParts').replaceChildren();$('planSplitStatus').textContent='';addPart();addPart();$('planSplitDialog').showModal();}
  function init(bridge){
    app=bridge;
    $('planPreferences').addEventListener('submit',e=>{e.preventDefault();mode='build';overrides={};buildPreview();});
    $('planPreferences').addEventListener('input',()=>{overrides={};clearPreview();renderOverview();});$('planAddWindow').onclick=()=>{addWindow();clearPreview();renderOverview();};$('planRecover').onclick=()=>{mode='recover';overrides={};buildPreview();};
    $('planApply').addEventListener('click',applySelected);$('planUndo').addEventListener('click',undoPlan);
    $('planSavePreferences').addEventListener('click',()=>{try{const snapshot=app.snapshot(),next=JSON.parse(JSON.stringify(snapshot.store));next.settings.planning=readPreferences();app.commit(JSON.stringify(snapshot),app.account(),next);clearPreview();announce('Planning preferences saved locally.');}catch(error){announce(error.message,true);}});
    $('planUnscheduled').addEventListener('click',e=>{const button=e.target.closest('[data-plan-edit-id]');if(button)app.edit(button.dataset.planEditId,button.dataset.planEditWeek);const split=e.target.closest('[data-plan-split-id]');if(split)openSplit({id:split.dataset.planSplitId,week:split.dataset.planSplitWeek});});
    $('planProposals').addEventListener('input',e=>{if(e.target.matches('[data-placement-date],[data-placement-start]')){placementDirty=true;$('planApply').disabled=true;announce('Check your edited placement to validate it before applying.');}});
    $('planProposals').addEventListener('change',()=>{$('planApply').disabled=placementDirty||!document.querySelector('[name="planProposal"]:checked');});
    $('planProposals').addEventListener('click',e=>{const button=e.target.closest('[data-placement-apply]');if(!button||!preview)return;try{const i=Number(button.dataset.placementApply),item=preview.plan.proposals[i];overrides[item.week+'::'+item.id]={date:$('planProposals').querySelector('[data-placement-date="'+i+'"]').value,start:parseTime($('planProposals').querySelector('[data-placement-start="'+i+'"]').value)};buildPreview();}catch(error){announce(error.message,true);}});
    $('planCancelSplit').onclick=()=>$('planSplitDialog').close();$('planAddPart').onclick=()=>addPart();$('planSplitForm').onsubmit=e=>{e.preventDefault();try{if(splitSnapshot.account!==app.account()||splitSnapshot.fingerprint!==fingerprint())throw new Error('Your planner changed. Close this dialog and start splitting again.');const snapshot=app.snapshot(),parts=[...$('planSplitParts').children].map(row=>({title:row.querySelector('input[type="text"]').value,minutes:Number(row.querySelector('input[type="number"]').value)}));const next=root.WeekwisePlanning.splitTask(snapshot.store,splitRef,parts,()=>root.crypto.randomUUID());app.commit(JSON.stringify(snapshot),app.account(),next,'weekwise-pre-split-v1');$('planSplitDialog').close();overrides={};buildPreview();announce('Linked parts saved. Review their placements before applying.');}catch(error){$('planSplitStatus').textContent=error.message;}};
    render();
  }
  root.WeekwisePlanUI=Object.freeze({init,render});
})(window);
