/* Optional, account-scoped first-run guide. Never changes planner records or sends data. */
(function(root){'use strict';
 const PREFIX='weekwise-onboarding-v1:';
 function key(owner){
  if(typeof owner!=='string'||!owner||owner.length>300)throw new Error('Invalid planner owner for onboarding.');
  return PREFIX+encodeURIComponent(owner);
 }
 function mode(storage,owner){try{return storage.getItem(key(owner))||'new';}catch(_){return 'new';}}
 function setMode(storage,owner,value){if(!['shown','dismissed'].includes(value))throw new Error('Unsupported guide preference.');try{storage.setItem(key(owner),value);return true;}catch(_){return false;}}
 function visible(storage,owner,hasTasks){
  const state=mode(storage,owner);
  return state==='shown'||(state==='new'&&!hasTasks);
 }
 function markup(){
  return '<section class="today-onboarding" id="todayOnboarding" aria-labelledby="todayOnboardingTitle"><div class="today-onboarding-head"><div><span class="workspace-page-eyebrow">YOUR FIRST STEPS · OPTIONAL</span><h3 id="todayOnboardingTitle">Make Weekwise yours.</h3><p>Start small. Your schedule stays empty until you choose what to add. No account or questionnaire is required.</p></div><button class="btn" type="button" data-experience-guide-dismiss aria-label="Dismiss the getting started guide">Dismiss guide</button></div><div class="today-onboarding-steps"><article><span aria-hidden="true">01</span><h4>Capture one responsibility</h4><p>A task, idea or reminder is enough to begin.</p><button class="btn primary" type="button" data-experience-capture>Capture a task</button></article><article><span aria-hidden="true">02</span><h4>Make time for it</h4><p>Set planning hours, breaks and buffer; nothing will be moved without approval.</p><button class="btn" type="button" data-experience-plan>Planning preferences</button></article><article><span aria-hidden="true">03</span><h4>Explore your calendar</h4><p>Review Day, Week, Month, Agenda and Year without creating sample activities.</p><button class="btn" type="button" data-experience-calendar>Open calendar</button></article></div></section>';
 }
 root.WeekwiseOnboarding=Object.freeze({key,mode,setMode,visible,markup});
})(typeof window!=='undefined'?window:globalThis);
