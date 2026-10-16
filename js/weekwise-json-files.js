/* Manual JSON transfers have exactly one home: Settings.
   Local and signed-in account planners may use them. Account ownership, confirmation,
   optimistic storage checks and sync-conflict protection are enforced by import handlers. */
(function(root){
 'use strict';
 const allowed=owner=>typeof owner==='string'&&owner.trim().length>0;
 let previousOwner=null;
 function render(owner){
  if(typeof document==='undefined')return;
  const available=allowed(owner),device=owner==='local';
  document.body.dataset.weekwiseJsonMode=device?'device':'account';
  document.querySelectorAll('[data-device-only-json]').forEach(control=>{
   // Native file inputs are always opened by their explicit Settings buttons.
   control.hidden=control.tagName==='INPUT'&&control.type==='file'?true:!available;
   control.inert=!available;
  });
  document.querySelectorAll('[data-cloud-json-info]').forEach(control=>{
   control.hidden=device;
   control.inert=device;
  });
  if(previousOwner!==owner){
   for(const id of ['importFile','workspaceImportListFile','calendarImportFile','qualityBackupFile','qualityRestoredFile']){
    const input=document.getElementById(id);
    if(input)input.value='';
   }
   previousOwner=owner;
  }
 }
 root.WeekwiseJsonFiles=Object.freeze({allowed,render});
})(typeof window!=='undefined'?window:globalThis);
