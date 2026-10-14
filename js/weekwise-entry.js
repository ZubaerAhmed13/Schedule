/* One real authentication form, shared by the entry screen and account panel. */
(function(root){
 'use strict';
 function refresh(){
  const slot=document.getElementById('signinFormSlot'),panel=document.getElementById('cloudPanel');
  if(!slot||!panel)return;
  if(!slot.contains(panel)&&!panel.closest('#utilityModalContent'))slot.appendChild(panel);
  if(panel.parentElement===slot)panel.open=true;
 }
 root.WeekwiseEntry=Object.freeze({refresh});
 refresh();
})(typeof window!=='undefined'?window:globalThis);
