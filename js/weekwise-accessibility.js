/* Dialog focus containment, underlying-page isolation and launcher restoration.
   Existing task/editor handlers continue to control saving and dismissal. */
(()=>{'use strict';
 let active=null,returnTo=null,refocusing=false;
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
  const next=ids.map(id=>document.getElementById(id)).filter(visible).pop()||null;
  if(next===active)return;
  const prior=active,launcher=document.activeElement;
  // Save the opener BEFORE applying inert; otherwise browsers may move focus to body.
  if(next&&!prior)returnTo=launcher instanceof HTMLElement?launcher:null;
  active=next;
  const wrap=document.querySelector('.wrap');
  if(wrap)wrap.inert=!!active;
  if(active){
   const dialog=active.matches('[role="dialog"]')?active:(active.querySelector('[role="dialog"],.modal')||active);
   dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
   focusWithin();
  }else{
   const target=returnTo;returnTo=null;
   if(target?.isConnected&&!target.closest('[hidden],[inert]'))target.focus({preventScroll:true});
  }
 }
 document.addEventListener('focusin',()=>{if(active)focusWithin();});
 document.addEventListener('keydown',event=>{
  if(!active||event.key!=='Tab')return;
  const items=controls(active);
  if(!items.length){event.preventDefault();focusWithin();return;}
  const firstItem=items[0],lastItem=items[items.length-1],current=document.activeElement;
  if(event.shiftKey&&(current===firstItem||!active.contains(current))){event.preventDefault();lastItem.focus();}
  else if(!event.shiftKey&&(current===lastItem||!active.contains(current))){event.preventDefault();firstItem.focus();}
 });
 function init(){new MutationObserver(update).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','class']});update();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
