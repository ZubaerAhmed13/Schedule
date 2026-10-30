/* Notification preferences use the same guarded transaction as other planner settings. */
(function(root){
 'use strict';let app=null,owner=null,expected=null,dirty=false;
 const $=id=>document.getElementById(id);
 function render(force=false){
  if(!app||!$('notificationTimingForm'))return;
  const changedOwner=owner!==app.account();
  if(changedOwner||force||!dirty){
   owner=app.account();const snapshot=app.snapshot();expected=JSON.stringify(snapshot);dirty=false;
   $('notificationLeadMinutes').value=String(root.WeekwiseReminderPolicy.leadMinutes(snapshot.store.settings.reminderLeadMinutes));
   if(changedOwner)$('notificationTimingStatus').textContent='';
  }
  $('notificationDeliveryNote').textContent=app.deliveryStatus();app.permission();
 }
 function init(bridge){
  app=bridge;render(true);
  $('notificationLeadMinutes').addEventListener('change',()=>{dirty=true;$('notificationTimingStatus').textContent='Unsaved reminder timing.';});
  $('notificationTimingForm').addEventListener('submit',event=>{
   event.preventDefault();const status=$('notificationTimingStatus');
   try{
    if(owner!==app.account())throw new Error('Your account changed. Review the current planner before saving.');
    const blocked=app.blocked?.();if(blocked)throw new Error(blocked);
    const value=Number($('notificationLeadMinutes').value);if(![0,5,15,60].includes(value))throw new Error('Choose one of the available reminder times.');
    const snapshot=JSON.parse(expected),next=JSON.parse(JSON.stringify(snapshot.store));next.settings.reminderLeadMinutes=value;
    app.commit(expected,owner,next);render(true);status.textContent=value?'Saved · '+(value===60?'1 hour':value+' minutes')+' before upcoming activities.':'Saved · automatic event reminders are off. Custom task reminders still apply.';
    app.changed?.();
   }catch(error){render(true);status.textContent=error.message||'Could not save reminder timing. Your previous setting is unchanged.';}
  });
  document.addEventListener('click',event=>{if(event.target.closest('[data-settings-category="reminders"]'))render();});
  root.addEventListener('weekwise-sync-status',()=>render());
  root.addEventListener('weekwise-settings-owner-change',()=>{dirty=false;expected=null;});
  root.addEventListener('focus',()=>render());
 }
 root.WeekwiseNotificationSettings=Object.freeze({init,render});
})(typeof window!=='undefined'?window:globalThis);
