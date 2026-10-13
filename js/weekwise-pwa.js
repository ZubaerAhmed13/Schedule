/* Waiting service-worker updates are opt-in, never discard unfinished editor input. */
(()=>{'use strict';
 if(!('serviceWorker' in navigator)||location.protocol==='file:')return;
 let requested=false,refreshReady=false,registration=null,refreshNotice=()=>{};
 const blocked=()=>window.WeekwiseUpdateSafety?.reason(document,!!window.WeekwiseExperience?.hasPendingReview?.())||'';
 function offer(reg){
  registration=reg;
  if(!reg.waiting&&!refreshReady)return;
  let notice=document.getElementById('updateNotice'),first=false;
  if(!notice){
   first=true;notice=document.createElement('aside');notice.id='updateNotice';notice.className='update-notice';
   notice.setAttribute('role','status');notice.innerHTML='<span>A Weekwise update is ready.</span><button class="btn primary" type="button">Reload to update</button><small class="update-safety-message" aria-live="polite"></small>';
   document.body.append(notice);
  }
  const button=notice.querySelector('button'),message=notice.querySelector('.update-safety-message');
  refreshNotice=()=>{
   const reason=blocked();
   button.textContent=refreshReady?'Reload updated app':'Reload to update';
   button.disabled=!!reason||(requested&&!refreshReady);
   message.textContent=reason||((requested&&!refreshReady)?'Installing the verified update. Your saved records stay on this device.':'Your saved local planner data will be retained.');
  };
  button.onclick=()=>{
   refreshNotice();
   if(blocked()||(requested&&!refreshReady))return;
   if(refreshReady){location.reload();return;}
   const waiting=registration?.waiting;
   if(!waiting){notice.remove();return;}
   requested=true;refreshNotice();
   waiting.postMessage({type:'WEEKWISE_ACTIVATE_UPDATE'});
  };
  if(first){
   const observer=new MutationObserver(()=>refreshNotice());
   observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','class']});
   document.addEventListener('input',()=>queueMicrotask(refreshNotice));
   document.addEventListener('click',()=>setTimeout(refreshNotice,0));
  }
  refreshNotice();
 }
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!requested)return;
  if(!blocked())location.reload();
  else{refreshReady=true;offer(registration);}
 });
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(reg=>{
  offer(reg);
  reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',()=>{
   if(reg.waiting&&navigator.serviceWorker.controller)offer(reg);
  }));
 }).catch(()=>{}));
})();
