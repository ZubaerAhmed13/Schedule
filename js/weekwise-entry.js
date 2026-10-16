/* Addressable public/account pages share one auth form and the existing session guard. */
(function(root){
 'use strict';
 let settled=false,wasInApp=false;
 const $=id=>document.getElementById(id);
 const installed=()=>root.matchMedia('(display-mode: standalone)').matches||root.matchMedia('(display-mode: fullscreen)').matches||root.navigator.standalone===true;
 const appRequested=()=>{const url=new URL(root.location.href);return installed()||url.searchParams.get('launch')==='app'||['today','tomorrow','inbox','plan','calendar','settings'].includes(url.searchParams.get('view'));};
 function publicRoute(){const url=new URL(root.location.href);return installed()||url.searchParams.get('launch')==='app'||url.searchParams.get('page')==='signin'||url.hash==='#weekwiseAccess'||$('signinOfflineAccount')?.hidden===false?'signin':'home';}
 function render(focus=false){
  const gate=$('signinLanding');if(!gate)return;
  const route=gate.hidden?'app':settled?publicRoute():'pending';
  document.documentElement.dataset.entryRoute=route;
  const back=$('weekwiseAccess').querySelector('[data-entry-home]');if(back)back.hidden=installed()||new URL(root.location.href).searchParams.get('launch')==='app';
  $('weekwiseHome').hidden=route!=='home';$('weekwiseAccess').hidden=route!=='signin';$('entryLoading').hidden=route!=='pending';
  gate.setAttribute('aria-labelledby',route==='signin'?'signinLandingTitle':route==='pending'?'entryLoading':'wwLandingTitle');
  if(route==='app'){document.title='Weekwise — Your planner';wasInApp=true;return;}
  document.title=route==='signin'?'Sign in — Weekwise':route==='pending'?'Opening Weekwise…':'Weekwise — Make room for what matters | Personal weekly planner';
  if(focus){gate.scrollTop=0;const target=route==='signin'?$('cloudEmail'):$('wwLandingTitle');if(target){if(target.tagName==='H1')target.tabIndex=-1;target.focus({preventScroll:true});}}
 }
 function refresh(){
  const slot=$('signinFormSlot'),panel=$('cloudPanel');if(!slot||!panel)return;
  if(!slot.contains(panel)&&!panel.closest('#utilityModalContent'))slot.appendChild(panel);
  if(panel.parentElement===slot)panel.open=true;
  render();
 }
 function go(route,{replace=false,focus=true}={}){
  const url=new URL(root.location.href);url.hash='';url.searchParams.delete('view');
  if(route==='signin')url.searchParams.set('page','signin');else url.searchParams.delete('page');
  root.history[replace?'replaceState':'pushState']({},'',url);settled=true;render(focus);
 }
 function ready(){settled=true;refresh();}
 function signIn(){go('signin');}
 function enterApp(deviceOnly=false){
  settled=true;wasInApp=true;const url=new URL(root.location.href);url.searchParams.delete('page');if(deviceOnly)url.searchParams.set('view','today');if(url.hash==='#weekwiseAccess')url.hash='';
  root.history.replaceState({},'',url);render();
 }
 function signedOut(){settled=true;wasInApp=false;go(installed()||new URL(root.location.href).searchParams.get('launch')==='app'?'signin':'home',{replace:true,focus:false});refresh();}
 document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target)return;
  const url=new URL(link.href,root.location.href);
  if(url.origin!==root.location.origin||url.pathname!==root.location.pathname)return;
  if(link.closest('#weekwiseHome')&&link.getAttribute('href').startsWith('#')){const target=$(url.hash.slice(1));if(target){event.preventDefault();root.history.pushState({},'',url);const gate=$('signinLanding'),top=gate.scrollTop+target.getBoundingClientRect().top-gate.getBoundingClientRect().top-90;gate.scrollTo({top:Math.max(0,top),behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});const heading=target.matches('h1,h2')?target:target.querySelector('h1,h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}}
  // Public/account links use native document navigation, including Back/Forward and reload.
 });
 root.addEventListener('popstate',()=>{if($('signinLanding')?.hidden)return;render(true);});
 root.addEventListener('hashchange',()=>{if($('signinLanding')?.hidden||root.location.hash!=='#weekwiseAccess')return;render();});
 const mode=root.matchMedia('(display-mode: standalone)');mode.addEventListener?.('change',()=>render());
 root.WeekwiseEntry=Object.freeze({refresh,ready,signIn,enterApp,signedOut,appRequested});
 refresh();
 new MutationObserver(()=>{const gate=$('signinLanding');if(gate.hidden){render();}else if(wasInApp)signedOut();else render();}).observe($('signinLanding'),{attributes:true,attributeFilter:['hidden']});
})(typeof window!=='undefined'?window:globalThis);
