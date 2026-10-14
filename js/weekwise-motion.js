/* Presentation only. No records, storage, network requests or delayed app actions. */
(function(root){
  'use strict';
  const preference=root.matchMedia('(prefers-reduced-motion: reduce)');
  const animations=new Set(),frames=new Set();
  const ease='cubic-bezier(.22,1,.36,1)';
  function cancel(){
    for(const frame of frames)root.cancelAnimationFrame(frame);
    frames.clear();
    for(const animation of animations)animation.cancel();
    animations.clear();
  }
  function next(callback){
    const frame=root.requestAnimationFrame(()=>{frames.delete(frame);callback();});
    frames.add(frame);return frame;
  }
  function animate(element,keyframes,options){
    if(preference.matches||document.hidden||!element?.isConnected||typeof element.animate!=='function')return;
    const animation=element.animate(keyframes,{easing:ease,fill:'none',...options});
    animations.add(animation);
    animation.addEventListener('finish',()=>animations.delete(animation),{once:true});
    animation.addEventListener('cancel',()=>animations.delete(animation),{once:true});
  }
  function entrance(getElements){
    cancel();
    if(preference.matches||document.hidden)return;
    next(()=>{
      const elements=getElements().filter(el=>el&&!el.hidden&&el.getClientRects().length).slice(0,5);
      elements.forEach((element,index)=>animate(element,[
        {transform:'translateY(7px)'},
        {transform:'translateY(0)'}
      ],{duration:260,delay:index*28}));
    });
  }
  function enter(view){
    entrance(()=>{
      if(view==='calendar')return ['calendarToolbar','daysGrid'].map(id=>document.getElementById(id));
      const ids={plan:'planWorkspace',insights:'insightsWorkspace',settings:'settingsWorkspace',filters:'filtersWorkspace',board:'kanbanBoard',matrix:'priorityMatrix'};
      const panel=document.getElementById(ids[view]||'taskWorkspace');
      return panel?Array.from(panel.children).filter(el=>!['DIALOG','SCRIPT','STYLE'].includes(el.tagName)):[];
    });
  }
  function calendar(){entrance(()=>[document.getElementById('daysGrid')]);}
  function feedback(selector,confirmed){
    if(preference.matches)return;
    next(()=>{
      const element=document.querySelector(selector);
      if(element&&confirmed(element))animate(element,[
        {transform:'scale(1)'},{transform:'scale(1.16)',offset:.45},{transform:'scale(1)'}
      ],{duration:260});
    });
  }
  // Resolve the current control after the canonical controller has re-rendered it.
  document.addEventListener('change',event=>{
    const control=event.target.closest?.('input[data-workspace-done],input[data-range-done]');
    if(!control?.checked)return;
    const names=control.hasAttribute('data-range-done')?['data-range-done','data-range-id','data-range-week']:['data-workspace-done','data-workspace-week'];
    const selector=names.filter(name=>control.hasAttribute(name)).map(name=>'['+name+'="'+CSS.escape(control.getAttribute(name))+'"]').join('');
    feedback(selector,el=>el.checked);
  },true);
  document.addEventListener('click',event=>{
    const control=event.target.closest?.('[data-habit-check]');
    if(!control||control.disabled||control.getAttribute('aria-pressed')!=='false')return;
    const selector='[data-habit-check="'+CSS.escape(control.dataset.habitCheck)+'"][data-habit-date="'+CSS.escape(control.dataset.habitDate)+'"]';
    feedback(selector,el=>el.getAttribute('aria-pressed')==='true');
  },true);
  const onPreference=()=>{if(preference.matches)cancel();};
  if(preference.addEventListener)preference.addEventListener('change',onPreference);
  else preference.addListener?.(onPreference);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  root.addEventListener('pagehide',cancel);
  root.WeekwiseMotion=Object.freeze({enter,calendar,cancel});
})(window);
