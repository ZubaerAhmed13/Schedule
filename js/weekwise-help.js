/* Local help and explicit links. No automatic messages, uploads, or seeded tasks. */
(function(root){
 'use strict';let app;
 const $=id=>document.getElementById(id);
 function open(){app.open('helpPanel','A little help for your week');}
 function leave(view,target){app.close(false);app.navigate(view);root.requestAnimationFrame(()=>{if($('utilityModal').hidden&&$('signinLanding').hidden)$(target).focus();});}
 function init(bridge){
  app=bridge;
  document.addEventListener('click',e=>{
   const trigger=e.target.closest('[data-help-open]');if(trigger){open();return;}
   const action=e.target.closest('[data-help-action]');if(!action)return;
   if(action.dataset.helpAction==='capture')leave('inbox','workspaceCaptureInput');
   if(action.dataset.helpAction==='plan')leave('plan','workspaceMain');
   if(action.dataset.helpAction==='calendar')leave('calendar','workspaceMain');
   if(action.dataset.helpAction==='sync')app.account();
   if(action.dataset.helpAction==='device')leave('settings','settingsTitle');
   if(action.dataset.helpAction==='backup')leave('settings','exportBtn');
  });
 }
 root.WeekwiseHelp=Object.freeze({init,open});
})(window);
