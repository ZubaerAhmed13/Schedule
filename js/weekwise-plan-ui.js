/* The Plan screen consumes canonical records through a narrow app bridge. */
(function (root) {
  'use strict';
  let app, preview=null, undo=null;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const duration=n=>{const h=Math.floor(n/60),m=n%60;return h?(h+'h'+(m?' '+m+'m':'')):m+'m';};
  const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  function announce(message,error=false){$('planStatus').textContent=message;$('planStatus').dataset.error=String(error);}
  function fingerprint(){return JSON.stringify(app.snapshot());}
  function readPreferences(){return root.WeekwisePlanning.preferences({days:[...document.querySelectorAll('[name="planDay"]:checked')].map(el=>Number(el.value)),start:parseTime($('planStart').value),end:parseTime($('planEnd').value),buffer:Number($('planBuffer').value),breakMinutes:Number($('planBreak').value)});}
  function parseTime(value){if(!/^\d{2}:\d{2}$/.test(value))throw new Error('Enter planning hours.');const [h,m]=value.split(':').map(Number);return h*60+m;}
  function weekKey(){const raw=$('planWeek').value;if(!root.WeekwiseData.validDate(raw))throw new Error('Choose a valid week.');const date=new Date(raw+'T12:00:00');date.setDate(date.getDate()-date.getDay());return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
  function clearPreview(){preview=null;$('planResults').hidden=true;$('planApply').disabled=true;announce('Build a new preview to use these preferences. Your tasks have not changed.');}
  function buildPreview(){
    try{
      const snapshot=app.snapshot(),now=new Date(),week=weekKey();$('planWeek').value=week;
      const plan=root.WeekwisePlanning.build({store:snapshot.store,weekStart:week,prefs:readPreferences(),notBefore:{date:app.todayKey(),minute:now.getHours()*60+now.getMinutes()+1}});
      preview={plan,fingerprint:JSON.stringify(snapshot),account:app.account(),createdAt:Date.now()};
      renderPreview();announce(plan.proposals.length+' tasks suggested. Review and select the changes you want to apply.');
    }catch(error){announce(error.message,true);}
  }
  function renderPreview(){
    const p=preview.plan;
    $('planResults').hidden=false;
    $('planSummary').innerHTML=[['Planning time',p.available],['Already committed',p.committed],['Reserved buffer',p.reservedBuffer],['Flexible capacity',p.capacity],['Remaining after preview',p.remaining]].map(([label,value])=>'<div class="plan-metric"><span>'+label+'</span><strong>'+duration(value)+'</strong></div>').join('');
    $('planCapacityNote').textContent='Capacity uses only your chosen hours. Existing breaks reserve '+duration(p.existingBreaks)+', and suggested-task breaks reserve '+duration(p.proposalBreaks)+'. All-day events block that day. '+p.protectedCount+' existing calendar commitments remain unchanged.';
    $('planWarning').hidden=!(p.overcommitted||p.overlaps.length||p.unknown);
    $('planWarning').textContent=[p.overcommitted?duration(p.overcommitted)+' more estimated work and suggested breaks than flexible capacity. Review priorities or keep tasks unscheduled.':'',p.overlaps.length?'Existing commitments overlap. The overlap is counted once; review it in Calendar.':'',p.unknown?p.unknown+' tasks need a duration estimate before they can be placed.':''].filter(Boolean).join(' ');
    $('planDayCapacity').innerHTML=p.days.length?p.days.map(d=>'<div class="plan-day-capacity"><span>'+esc(new Date(d.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}))+'</span><strong>'+duration(d.capacity)+' available for tasks</strong></div>').join(''):'<p>No planning hours remain in this week. Choose a future week or update your availability.</p>';
    $('planProposals').innerHTML=p.proposals.length?p.proposals.map((item,index)=>'<label class="plan-proposal"><input type="checkbox" name="planProposal" value="'+index+'" checked><span><strong>'+esc(item.title)+'</strong><span class="plan-proposal-time">'+esc(new Date(item.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}))+' · '+time(item.start)+'–'+time(item.start+item.duration)+'</span><small>'+esc(item.reason)+'</small></span></label>').join(''):'<div class="plan-empty">No new tasks can be suggested yet. Add an unscheduled task, set its Estimated focus, and choose planning hours.</div>';
    $('planUnscheduled').innerHTML=p.unscheduled.length?p.unscheduled.map(item=>'<li><div><strong>'+esc(item.title)+'</strong><p>'+esc(item.reason)+'</p></div><button class="btn" type="button" data-plan-edit-id="'+esc(item.id)+'" data-plan-edit-week="'+esc(item.week)+'">Edit task</button></li>').join(''):'<li class="plan-empty">No eligible tasks were left unscheduled.</li>';
    $('planApply').disabled=!p.proposals.length;
  }
  function validLocalSlot(item){
    const start=new Date(item.date+'T00:00:00');start.setMinutes(item.start);
    const end=new Date(item.date+'T00:00:00');end.setMinutes(item.start+item.duration);
    // Reject nonexistent times and a duration crossing a DST discontinuity.
    return start.getHours()*60+start.getMinutes()===item.start && (end-start)/60000===item.duration;
  }
  function applySelected(){
    try{
      if(!preview)throw new Error('Build a preview first.');
      if(preview.fingerprint!==fingerprint() || preview.account!==app.account())throw new Error('Your planner or account changed. Build a fresh preview before applying.');
      if(Date.now()-preview.createdAt>5*60*1000)throw new Error('This preview is more than five minutes old. Build a fresh preview.');
      const selected=[...document.querySelectorAll('[name="planProposal"]:checked')].map(el=>preview.plan.proposals[Number(el.value)]);
      if(!selected.length)throw new Error('Select at least one suggested task.');
      const now=new Date();
      for(const item of selected){
        if(!validLocalSlot(item))throw new Error('A suggested time crosses a clock change. Adjust your planning hours and rebuild.');
        const start=new Date(item.date+'T00:00:00');start.setMinutes(item.start);
        if(start<=now)throw new Error('A suggested start has already passed. Build a fresh preview.');
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
  function render(){if(!app)return;const p=app.snapshot().store.settings.planning;
    if(!$('planWeek').value){$('planWeek').value=app.currentWeek();if(p){try{const pref=root.WeekwisePlanning.preferences(p);$('planStart').value=time(pref.start);$('planEnd').value=time(pref.end);$('planBuffer').value=pref.buffer;$('planBreak').value=pref.breakMinutes;document.querySelectorAll('[name="planDay"]').forEach(el=>el.checked=pref.days.includes(Number(el.value)));}catch(_){announce('Saved planning preferences need review.',true);}}}
    if(preview&&preview.fingerprint!==fingerprint()){announce('Your planner changed. Build a fresh preview before applying.',true);$('planApply').disabled=true;}
  }
  function init(bridge){
    app=bridge;
    $('planPreferences').addEventListener('submit',e=>{e.preventDefault();buildPreview();});
    $('planPreferences').addEventListener('input',clearPreview);
    $('planApply').addEventListener('click',applySelected);$('planUndo').addEventListener('click',undoPlan);
    $('planSavePreferences').addEventListener('click',()=>{try{const snapshot=app.snapshot(),next=JSON.parse(JSON.stringify(snapshot.store));next.settings.planning=readPreferences();app.commit(JSON.stringify(snapshot),app.account(),next);clearPreview();announce('Planning preferences saved locally.');}catch(error){announce(error.message,true);}});
    $('planUnscheduled').addEventListener('click',e=>{const button=e.target.closest('[data-plan-edit-id]');if(button)app.edit(button.dataset.planEditId,button.dataset.planEditWeek);});
    $('planProposals').addEventListener('change',()=>{$('planApply').disabled=!document.querySelector('[name="planProposal"]:checked');});
    render();
  }
  root.WeekwisePlanUI=Object.freeze({init,render});
})(window);
