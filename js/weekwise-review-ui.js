/* Review UI: local recovery is separate from an explicit planner/account save. */
(function(root){
 'use strict';let app=null,owner=null,state=null,timer=null,latest=null;
 const $=id=>document.getElementById(id),model=()=>root.WeekwiseWeeklyReview;
 const values=()=>Object.fromEntries(model().names.map(name=>[name,$('review'+name).value]));
 const setValues=fields=>model().names.forEach(name=>{$('review'+name).value=fields?.[name]||'';});
 const status=message=>{$('reviewStatus').textContent=message;};
 const label=week=>new Date(week+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
 function renderDrafts(){const list=$('reviewDraftList');list.replaceChildren();try{const drafts=model().read(localStorage,owner).value.drafts,dates=Object.keys(drafts).sort().reverse();$('reviewDraftCount').textContent=String(dates.length);$('reviewDraftsDetails').hidden=!dates.length;for(const week of dates){const button=document.createElement('button');button.type='button';button.className='btn';button.dataset.reviewWeek=week;button.textContent='Week of '+label(week);list.append(button);}}catch(error){$('reviewDraftsDetails').hidden=true;status(error.message);}}
 function ownerChanged(next){if(owner===next)return;clearTimeout(timer);timer=null;owner=next;state=null;latest=null;setValues({});$('insightsWeek').value='';$('reviewFormTitle').textContent='Your weekly review';status('');$('reviewDraftList').replaceChildren();$('reviewDraftCount').textContent='0';$('reviewDraftsDetails').hidden=true;for(const id of ['insightsSummary','insightsWorkload','insightsScheduleStability','insightsFocus','insightsHabits','insightsComparison','insightsRange'])$(id).replaceChildren();}
 function checkpoint(){clearTimeout(timer);timer=null;if(!state?.dirty)return;if(app.source().owner!==owner)throw new Error('The planner owner changed. Your previous review draft was retained.');const draft=model().put(localStorage,owner,state.week,state.stored,{fields:values(),base:state.base,savedAt:new Date().toISOString()});state.stored=model().fingerprint(draft);status('Draft saved on this device. Use Save review to include it in your planner and backups.');renderDrafts();}
 function load(data,week){const saved=model().review(data.store,week);state={week,base:model().fingerprint(saved),stored:model().fingerprint(null),dirty:false};let draft;
  try{draft=model().read(localStorage,owner).value.drafts[week];}catch(error){setValues(saved);status(error.message);return;}
  if(draft){state.base=draft.base;state.stored=model().fingerprint(draft);state.dirty=true;setValues(draft.fields);status('Recovered an unfinished review draft from this device. Save review when it is ready.');}
  else{setValues(saved);status(saved?'Saved review loaded.':'No saved review for this week.');}
 }
 function render(data){if(owner!==data.owner)ownerChanged(data.owner);latest=data;if(!data.active)return null;
  let week=$('insightsWeek').value||root.WeekwiseCalendarRange.range(data.today,1)[0];if(!root.WeekwiseData.validDate(week))week=root.WeekwiseCalendarRange.range(data.today,1)[0];
  if(state&&state.week!==week&&state.dirty){try{checkpoint();}catch(error){status(error.message);week=state.week;}}
  $('insightsWeek').value=week;$('reviewFormTitle').textContent='Your review · week of '+label(week);
  $('saveWeeklyReview').disabled=false;$('reviewLoadSaved').disabled=false;
  try{if(!state||state.week!==week||!state.dirty)load(data,week);const saved=model().review(data.store,week);if(state.dirty&&model().fingerprint(saved)!==state.base)status('A newer saved review is available. Your draft remains here. Copy any text you need, then choose Load saved review.');}catch(error){if(!state||state.week!==week||!state.dirty){state=null;setValues({});}$('saveWeeklyReview').disabled=true;$('reviewLoadSaved').disabled=true;status(error.message);}
  $('insightsRange').textContent=label(week)+' – '+label(root.WeekwisePlanning.dateAt(week,6))+' · Planner clock: '+data.zone+'.';renderDrafts();return week;
 }
 function choose(week){if(!root.WeekwiseData.validDate(week))return;$('insightsWeek').value=week;app.render();}
 function init(bridge){app=bridge;
  $('weeklyReviewForm').addEventListener('input',event=>{if(!event.target.matches('textarea')||!state)return;state.dirty=true;status('Unsaved review changes. Saving a recovery draft on this device…');clearTimeout(timer);timer=setTimeout(()=>{try{checkpoint();}catch(error){status(error.message);}},250);});
  $('insightsWeek').onchange=()=>app.render();$('insightsPrevious').onclick=()=>choose(root.WeekwisePlanning.dateAt($('insightsWeek').value,-7));$('insightsNext').onclick=()=>choose(root.WeekwisePlanning.dateAt($('insightsWeek').value,7));$('insightsCurrent').onclick=()=>choose(root.WeekwiseCalendarRange.range(app.source().today,1)[0]);
  $('reviewDraftList').onclick=event=>{const button=event.target.closest('[data-review-week]');if(button){choose(button.dataset.reviewWeek);$('reviewworked').focus();}};
  $('weeklyReviewForm').onsubmit=event=>{event.preventDefault();if(!state)return;try{checkpoint();app.review(state.week,values(),{owner,base:state.base});state.base=model().fingerprint(model().review(app.source().store,state.week));state.dirty=false;clearTimeout(timer);timer=null;try{model().remove(localStorage,owner,state.week,state.stored);state.stored=model().fingerprint(null);}catch(_){status('Review saved on this device. A local recovery draft could not be cleared and was retained.');renderDrafts();return;}status('Weekly review saved on this device. Account changes sync through Account & sync.');renderDrafts();}catch(error){status(error.message);}};
  $('reviewLoadSaved').onclick=()=>{if(!state)return;if(state.dirty&&!confirm('Discard this week’s unfinished review draft and load the saved review? Copy any text you need first.'))return;try{clearTimeout(timer);timer=null;model().remove(localStorage,owner,state.week,state.stored);state.dirty=false;load(app.source(),state.week);renderDrafts();}catch(error){status(error.message);}};
  $('downloadReviewDrafts').onclick=()=>{const current=app.source().owner;if(!root.WeekwiseJsonFiles.allowed(current))return;try{try{checkpoint();}catch(_){}const raw=localStorage.getItem(model().key(current)),openDraft=state?.dirty&&owner===current?{week:state.week,fields:values(),base:state.base}:null,report={app:'Weekwise',kind:'private-weekly-review-drafts',version:1,exportedAt:new Date().toISOString(),raw,openDraft};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='weekwise-review-drafts.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);app.announce('Stored and open review drafts downloaded. Keep this private file safe.');}catch(_){app.announce('Review drafts could not be downloaded. Keep your unfinished notes open and copy them before leaving.');}};
  root.addEventListener('beforeunload',event=>{try{checkpoint();}catch(_){}if(state?.dirty){event.preventDefault();event.returnValue='';}});
  root.addEventListener('pagehide',()=>{try{checkpoint();}catch(_){}});
  root.addEventListener('storage',event=>{if(owner&&event.key===model().key(owner)){if(state?.dirty){status('Review drafts changed in another tab. Your text remains here; reload after keeping a copy.');}else if(latest?.active)app.render();}});
 }
 root.WeekwiseReviewUI=Object.freeze({init,render,ownerChanged,checkpoint,hasPendingReview:()=>!!state?.dirty});
})(window);
