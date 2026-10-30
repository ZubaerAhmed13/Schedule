/* Notification preferences share the guarded planner settings transaction and owner isolation. */
(function(root){
 'use strict';let app=null,owner=null,expected=null,dirty=false;
 const $=id=>document.getElementById(id);
 const categories=['study','job','life','language','hobby','other'];
 const allowed=[0,5,15,60];
 const time=/^([01]\d|2[0-3]):[0-5]\d$/;
 function settingsFields(){
  const enabled=$('notificationQuietEnabled').checked,start=$('notificationQuietStart').value,end=$('notificationQuietEnd').value;
  if(enabled&&(!time.test(start)||!time.test(end)||start===end))throw new Error('Choose two different valid quiet-hours times.');
  const result={reminderLeadMinutes:Number($('notificationLeadMinutes').value),reminderQuietHours:{enabled,start,end},reminderCategoryLeadMinutes:{},reminderGroupByTask:$('notificationGroupByTask').checked};
  if(!allowed.includes(result.reminderLeadMinutes))throw new Error('Choose an available reminder time.');
  for(const select of document.querySelectorAll('[data-notification-category]')){
   const value=select.value;
   if(value!=='inherit'){
    const lead=Number(value);
    if(!allowed.includes(lead))throw new Error('Choose a supported category reminder time.');
    result.reminderCategoryLeadMinutes[select.dataset.notificationCategory]=lead;
   }
  }
  return result;
 }
 function render(force=false){
  if(!app||!$('notificationTimingForm'))return;
  const changedOwner=owner!==app.account();
  if(changedOwner||force||!dirty){
   owner=app.account();const snapshot=app.snapshot();expected=JSON.stringify(snapshot);dirty=false;
   const settings=snapshot.store.settings||{},quiet=settings.reminderQuietHours||{},overrides=settings.reminderCategoryLeadMinutes||{};
   $('notificationLeadMinutes').value=String(root.WeekwiseReminderPolicy.leadMinutes(settings.reminderLeadMinutes));
   $('notificationQuietEnabled').checked=quiet.enabled===true;
   $('notificationGroupByTask').checked=settings.reminderGroupByTask!==false;
   $('notificationQuietStart').value=time.test(quiet.start||'')?quiet.start:'22:00';
   $('notificationQuietEnd').value=time.test(quiet.end||'')?quiet.end:'07:00';
   for(const select of document.querySelectorAll('[data-notification-category]')){
    const value=overrides[select.dataset.notificationCategory];select.value=allowed.includes(value)?String(value):'inherit';
   }
   if(changedOwner)$('notificationTimingStatus').textContent='';
  }
  $('notificationDeliveryNote').textContent=app.deliveryStatus();app.permission();
 }
 function init(bridge){
  app=bridge;
  for(const select of document.querySelectorAll('[data-notification-category]')){
   select.replaceChildren();
   for(const [value,label] of [['inherit','Use main setting'],['0','Off'],['5','5 minutes before'],['15','15 minutes before'],['60','1 hour before']]){
    const option=document.createElement('option');option.value=value;option.textContent=label;select.add(option);
   }
  }
  render(true);
  $('notificationTimingForm').addEventListener('change',event=>{
   if(!event.target.closest('#notificationTimingForm'))return;
   dirty=true;$('notificationTimingStatus').textContent='Unsaved notification preferences.';
  });
  $('notificationTimingForm').addEventListener('submit',event=>{
   event.preventDefault();const status=$('notificationTimingStatus');
   try{
    if(owner!==app.account())throw new Error('Your account changed. Review the current planner before saving.');
    const blocked=app.blocked?.();if(blocked)throw new Error(blocked);
    const values=settingsFields(),snapshot=JSON.parse(expected),next=JSON.parse(JSON.stringify(snapshot.store));
    next.settings.reminderLeadMinutes=values.reminderLeadMinutes;
    next.settings.reminderQuietHours=values.reminderQuietHours;
    next.settings.reminderGroupByTask=values.reminderGroupByTask;
    const overrides={...(next.settings.reminderCategoryLeadMinutes||{})};
    for(const category of categories)delete overrides[category];
    Object.assign(overrides,values.reminderCategoryLeadMinutes);
    next.settings.reminderCategoryLeadMinutes=overrides;
    app.commit(expected,owner,next);render(true);
    status.textContent='Saved notification preferences. '+(values.reminderQuietHours.enabled?'Quiet hours are on.':'Quiet hours are off.')+' Custom activity reminders remain unchanged.';
    app.changed?.();
   }catch(error){render(true);status.textContent=error.message||'Could not save preferences. Previous settings are unchanged.';}
  });
  document.addEventListener('click',event=>{if(event.target.closest('[data-settings-category="reminders"]'))render();});
  root.addEventListener('weekwise-sync-status',()=>render());
  root.addEventListener('weekwise-settings-owner-change',()=>{dirty=false;expected=null;});
  root.addEventListener('focus',()=>render());
 }
 root.WeekwiseNotificationSettings=Object.freeze({init,render});
})(typeof window!=='undefined'?window:globalThis);
