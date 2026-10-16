/* zone controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function zoneNeedsReview(){const source=weekwiseRuntime.store.settings.timeZone,device=Intl.DateTimeFormat().resolvedOptions().timeZone;if(!source)return Object.values(weekwiseRuntime.store.weeks||{}).some(week=>week.tasks?.length)||(weekwiseRuntime.store.recurringTemplates||[]).length>0||(weekwiseRuntime.store.taskHistory||[]).length>0;return source!==device&&!WeekwiseZoneConversion.accepted(localStorage,weekwiseRuntime.currentDataOwner,source,device);}

function renderZoneNotice(){let notice=weekwiseRuntime.$('timeZoneNotice');if(!weekwiseRuntime.zoneNeedsReview()){notice?.remove();return;}if(!notice){notice=document.createElement('aside');notice.id='timeZoneNotice';notice.className='zone-notice';notice.setAttribute('role','status');notice.innerHTML='<span></span><button class="btn" type="button" data-zone-conversion>Review planner time zone</button><button class="btn" type="button" data-zone-keep>Continue with saved zone</button>';document.querySelector('.topbar').after(notice);notice.querySelector('[data-zone-keep]').onclick=()=>{try{WeekwiseZoneConversion.acknowledge(localStorage,weekwiseRuntime.currentDataOwner,weekwiseRuntime.store.settings.timeZone,Intl.DateTimeFormat().resolvedOptions().timeZone);weekwiseRuntime.renderAll();}catch(error){weekwiseRuntime.showToast(error.message);}};}notice.querySelector('[data-zone-keep]').hidden=!weekwiseRuntime.store.settings.timeZone;notice.querySelector('span').textContent=weekwiseRuntime.store.settings.timeZone?'This planner uses '+weekwiseRuntime.store.settings.timeZone+'. This device uses '+Intl.DateTimeFormat().resolvedOptions().timeZone+'. Keep its saved zone or review a conversion before editing.':'This historical planner has no saved time zone. Choose its original zone before changing schedules or reminders.';}

function dataCanWrite(){
 if(document.body.classList.contains('signin-required')||!weekwiseRuntime.$('signinLanding').hidden){weekwiseRuntime.showToast('Sign in to edit your account planner.');return false;}
 const owner=weekwiseRuntime.currentDataOwner;
 if(owner==='local'&&!root.WeekwiseOfflineAccess.allowsLocal(localStorage)){weekwiseRuntime.showToast('Choose Explore on this device to open your separate device-only planner.');return false;}
 if(owner!=='local'&&weekwiseRuntime.cloudUser?.id!==owner&&!weekwiseRuntime.offlineAccountSelected()){weekwiseRuntime.showToast('Sign in to this account before editing.');return false;}
 if(owner!=='local'&&!navigator.onLine&&!root.WeekwiseOfflineAccess.allows(localStorage,owner)){weekwiseRuntime.showToast('Connect and sign in once to enable offline editing.');return false;}
 if(weekwiseRuntime.zoneNeedsReview()){weekwiseRuntime.renderZoneNotice();weekwiseRuntime.showToast('Review the time zone notice before changing your planner.');return false;}if(weekwiseRuntime.cloudUser&&weekwiseRuntime.currentDataOwner!==weekwiseRuntime.cloudUser.id){weekwiseRuntime.showToast('Your account is changing. Wait until its planner is ready.');return false;}if(weekwiseRuntime.plannerStorageBlocked||WeekwiseData.blockedKeys().length){weekwiseRuntime.showToast('Editing is paused to protect stored data. Restore a valid backup using the recovery notice.');return false;}return true;}
return Object.freeze({zoneNeedsReview,renderZoneNotice,dataCanWrite});
}
root.WeekwiseAppZone=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
