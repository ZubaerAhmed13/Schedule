/* Presentation-only settings categories. Forms keep their original nodes and handlers. */
(()=>{'use strict';
 const buttons=[...document.querySelectorAll('[data-settings-category]')];
 function select(key,focus=false){
  const button=buttons.find(b=>b.dataset.settingsCategory===key);if(!button)return;
  for(const item of buttons){const on=item===button;item.classList.toggle('active',on);item.setAttribute('aria-pressed',String(on));document.getElementById('settings-'+item.dataset.settingsCategory).hidden=!on;}
  if(focus)document.getElementById('settings-'+key+'-title').focus({preventScroll:true});
 }
 for(const button of buttons)button.addEventListener('click',()=>select(button.dataset.settingsCategory));
 // Return to a predictable category at each account boundary; no profile data is cached here.
 window.addEventListener('weekwise-settings-owner-change',()=>select('profile'));
 window.WeekwiseSettingsNav=Object.freeze({select});
})();
