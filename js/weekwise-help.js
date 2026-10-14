/* Local help and explicit links. No automatic messages, uploads, or seeded tasks. */
(function(root){
 'use strict';let app;
 const $=id=>document.getElementById(id);
 function open(){app.open('helpPanel','A little help for your week');}
 function init(bridge){
  app=bridge;
  document.addEventListener('click',e=>{
   const trigger=e.target.closest('[data-help-open]');if(trigger){open();return;}
   const action=e.target.closest('[data-help-action]');if(!action)return;
   if(action.dataset.helpAction==='capture'){app.close();app.navigate('inbox');$('workspaceCaptureInput').focus();}
   if(action.dataset.helpAction==='plan'){app.close();app.navigate('plan');}
   if(action.dataset.helpAction==='calendar'){app.close();app.navigate('calendar');}
   if(action.dataset.helpAction==='sync')app.account();
   if(action.dataset.helpAction==='device'){$('closeUtility').click();document.querySelector('[data-quality-open]').click();}
   if(action.dataset.helpAction==='backup')$('exportBtn').click();
  });
 }
 root.WeekwiseHelp=Object.freeze({init,open});
})(window);
