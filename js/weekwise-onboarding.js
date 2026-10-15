/* Optional, account-scoped first-run guide. Never changes planner records or sends data. */
(function(root){'use strict';
 const PREFIX='weekwise-onboarding-v1:';
 function key(owner){
  if(typeof owner!=='string'||!owner||owner.length>300)throw new Error('Invalid planner owner for onboarding.');
  return PREFIX+encodeURIComponent(owner);
 }
 function mode(storage,owner){try{return storage.getItem(key(owner))||'new';}catch(_){return 'new';}}
 function setMode(storage,owner,value){if(!['shown','dismissed','started'].includes(value))throw new Error('Unsupported guide preference.');try{storage.setItem(key(owner),value);return true;}catch(_){return false;}}
 function visible(storage,owner,hasTasks,complete=false){
  const state=mode(storage,owner);
  return state==='shown'||(state==='started'&&!complete)||(state==='new'&&!hasTasks);
 }
 function progress(records=[],store={}){
  const captured=records.length>0,planned=!!store.settings?.planning,scheduled=records.some(r=>r.task&&Number.isFinite(r.task.start)&&r.task.unscheduled!==true&&r.task.archived!==true&&r.task.deleted!==true);
  const steps=[captured,planned,scheduled];return {steps,completed:steps.filter(Boolean).length,complete:steps.every(Boolean)};
 }
 function markup(value={steps:[false,false,false],completed:0},signedIn=false){
  const nextIndex=value.steps.findIndex(done=>!done),next=[{action:'capture',label:'Capture a task',text:'Start with one responsibility or idea.'},{action:'plan',label:'Plan my week',text:'Choose your available hours, then review what fits.'},{action:'calendar',label:'Open calendar',text:'Give one task a time you can manage.'}][nextIndex]||{action:'plan',label:'Review my week',text:'Your first steps are complete. Make room for what matters next.'};
  const states=value.steps.map(done=>'<small class="guide-step-state">'+(done?'Completed from your saved planner':'Next when you are ready')+'</small>');
  return '<section class="today-onboarding compact-onboarding" id="todayOnboarding" aria-labelledby="todayOnboardingTitle"><div class="today-onboarding-head"><div><span class="workspace-page-eyebrow">YOUR FIRST STEPS · OPTIONAL</span><h3 id="todayOnboardingTitle">A little plan. A lighter week.</h3><p class="guide-mode-note">'+(signedIn?'Connected to your account.':'Saved in this browser. Account sync is optional.')+'</p><p class="today-onboarding-progress">'+value.completed+' of 3 steps completed · based on your saved tasks and planning preferences</p></div><button class="btn" type="button" data-experience-guide-dismiss>Dismiss guide</button></div><div class="guide-next-step"><p>'+next.text+'</p><button class="btn primary" type="button" data-guide-next="'+next.action+'">'+next.label+'</button></div><details class="guide-all-steps" id="todayOnboardingDetails"><summary>All three steps</summary><div class="today-onboarding-steps"><article data-complete="'+value.steps[0]+'"><span aria-hidden="true">01</span><h4>Capture a task</h4><p>A responsibility, idea or reminder is enough to begin.</p>'+states[0]+'<button class="btn primary" type="button" data-experience-capture>Capture a task</button></article><article data-complete="'+value.steps[1]+'"><span aria-hidden="true">02</span><h4>Make room for it</h4><p>Choose hours, breaks and buffer in Plan. Build a preview, then approve the placements you want.</p>'+states[1]+'<button class="btn" type="button" data-experience-plan>Plan my week</button></article><article data-complete="'+value.steps[2]+'"><span aria-hidden="true">03</span><h4>Give one task a time</h4><p>Approve a suggested placement or choose a time in Calendar. Start with one manageable commitment.</p>'+states[2]+'<button class="btn" type="button" data-experience-calendar>Open calendar</button></article></div></details></section>';
 }
 root.WeekwiseOnboarding=Object.freeze({key,mode,setMode,visible,progress,markup});
})(typeof window!=='undefined'?window:globalThis);
