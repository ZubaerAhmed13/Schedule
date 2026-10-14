/* Keep forms within the visual viewport; avoid treating pinch zoom as a keyboard. */
(()=>{'use strict';let queued=false;
 const editable=el=>el?.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]):not([type=color]):not([type=range])');
 function update(){queued=false;const v=window.visualViewport,height=v?.height||innerHeight,top=v?.offsetTop||0;
  document.documentElement.style.setProperty('--ww-visible-height',height+'px');document.documentElement.style.setProperty('--ww-visible-top',top+'px');
  const keyboard=innerWidth<=760&&(editable(document.activeElement)||document.body.classList.contains('keyboard-open'))&&(v?.scale||1)<=1.1&&innerHeight-height>140;
  document.body.classList.toggle('keyboard-open',!!keyboard);
  if(keyboard&&editable(document.activeElement)){const el=document.activeElement,r=el.getBoundingClientRect();if(r.bottom>top+height-24||r.top<top+80)el.scrollIntoView({block:'center',behavior:'instant'});}
  if(keyboard&&document.activeElement?.closest('#cloudAuthForm')){
   const pane=document.getElementById('signinLanding'),submit=document.getElementById('cloudSignInBtn');
   if(pane?.contains(document.activeElement)&&submit){
    const field=document.activeElement.getBoundingClientRect(),action=submit.getBoundingClientRect(),bottom=top+height-20;
    const shift=Math.min(action.bottom-bottom,field.top-top-16);
    if(shift>0)pane.scrollTop+=shift;
   }
  }
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
 window.visualViewport?.addEventListener('resize',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});document.addEventListener('focusin',schedule);document.addEventListener('focusout',schedule);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
