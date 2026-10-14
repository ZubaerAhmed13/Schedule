/* Dialog focus containment, underlying-page isolation and launcher restoration.
   Existing task/editor handlers continue to control saving and dismissal. */
(()=>{'use strict';
 let active=null,returnTo=null,refocusing=false,lastOutsideFocus=null,lastLauncher=null;
 const ids=['signinLanding','utilityModal','taskModal','templateModal'];
 const visible=el=>!!el&&!el.hidden&&(el.classList.contains('show')||el.id==='signinLanding'||el.id==='utilityModal');
 const controls=el=>[...el.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type=hidden]),textarea:not(:disabled),select:not(:disabled),a[href],summary,[tabindex]:not([tabindex="-1"])')]
   .filter(x=>x.getClientRects().length&&!x.closest('[hidden],[inert]')&&x.getAttribute('aria-hidden')!=='true'&&getComputedStyle(x).visibility!=='hidden');
 function first(el){return controls(el)[0]||null;}
 function focusWithin(){
  if(!active||refocusing||active.contains(document.activeElement))return;
  const target=first(active)||active.querySelector('[role="dialog"],.modal')||active;
  if(!target.hasAttribute('tabindex')&&!/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(target.tagName))target.setAttribute('tabindex','-1');
  refocusing=true;try{target.focus({preventScroll:true});}finally{refocusing=false;}
 }
 function update(){
  const next=document.querySelector('dialog[open]')||ids.map(id=>document.getElementById(id)).filter(visible).pop()||null;
  const wrap=document.querySelector('.wrap');if(wrap)wrap.inert=!!next;
  if(next===active)return;
  const prior=active,launcher=document.activeElement;
  // Save the opener BEFORE applying inert; otherwise browsers may move focus to body.
  if(next&&!prior)returnTo=(lastLauncher?.isConnected?lastLauncher:null)||(lastOutsideFocus?.isConnected?lastOutsideFocus:null)||(launcher instanceof HTMLElement?launcher:null);
  active=next;
  if(active){
   const dialog=active.matches('[role="dialog"]')?active:(active.querySelector('[role="dialog"],.modal')||active);
   dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
   focusWithin();
  }else{
   let target=returnTo;returnTo=null;
   // Phone tool launchers live in a menu that closes when a tool is selected.
   // Restore a visible control instead of leaving keyboard focus on the page body.
   if(target?.isConnected&&!target.getClientRects().length){
    const menu=document.getElementById('mobileNavigationToggle');
    target=menu?.getClientRects().length?menu:target.closest('details')?.querySelector('summary');
   }
   if(target?.isConnected&&!target.closest('[hidden],[inert]'))target.focus({preventScroll:true});
  }
 }
 document.addEventListener('click',event=>{if(active)return;const launcher=event.target.closest?.('button,a,summary,[role="button"]');if(launcher&&!launcher.closest('#taskModal,#utilityModal,#templateModal,#signinLanding'))lastLauncher=launcher;},true);
 document.addEventListener('keydown',event=>{if(active)return;if(event.key==='Enter'||event.key===' '){const launcher=document.activeElement;if(launcher instanceof HTMLElement&&!launcher.closest('#taskModal,#utilityModal,#templateModal,#signinLanding'))lastLauncher=launcher;}},true);
 document.addEventListener('focusin',event=>{if(!active){if(event.target.closest?.('.wrap'))lastOutsideFocus=event.target;return;}focusWithin();});
 document.addEventListener('keydown',event=>{
  if(!active||event.key!=='Tab')return;
  const items=controls(active);
  if(!items.length){event.preventDefault();focusWithin();return;}
  const firstItem=items[0],lastItem=items[items.length-1],current=document.activeElement;
  if(event.shiftKey&&(current===firstItem||!active.contains(current))){event.preventDefault();lastItem.focus();}
  else if(!event.shiftKey&&(current===lastItem||!active.contains(current))){event.preventDefault();firstItem.focus();}
 });
 function init(){new MutationObserver(update).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','class','open']});update();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
