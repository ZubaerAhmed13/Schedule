/* One visibility and authorization policy for manual JSON file transfers.
   Account-owned planners (including offline account copies) never offer these tools.
   Device-only planner transfers remain available for local backup and portability. */
(function(root){
 'use strict';
 const allowed=owner=>owner==='local';
 function render(owner){
  if(typeof document==='undefined')return;
  const device=allowed(owner);
  document.body.dataset.weekwiseJsonMode=device?'device':'account';
  document.querySelectorAll('[data-device-only-json]').forEach(control=>{
   // File inputs are opened by their explicit buttons, never rendered inline.
   control.hidden=control.tagName==='INPUT'&&control.type==='file'?true:!device;
   control.inert=!device;
  });
  document.querySelectorAll('[data-cloud-json-info]').forEach(control=>{
   control.hidden=device;
   control.inert=device;
  });
  if(!device){
   for(const id of ['importFile','workspaceImportListFile','qualityBackupFile']){
    const input=document.getElementById(id);
    if(input)input.value='';
   }
  }
 }
 root.WeekwiseJsonFiles=Object.freeze({allowed,render});
})(typeof window!=='undefined'?window:globalThis);
