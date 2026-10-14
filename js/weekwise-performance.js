/* Explicit opt-in, owner-scoped numeric evidence; no network or planner writes. */
(function(root){
 'use strict';let app=null,session=null,owner=null,invalidated=false;
 const model=()=>root.WeekwiseEvidence;
 function build(){const source=document.querySelector('script[src*="weekwise-performance.js"]')?.src;try{return new URL(source).searchParams.get('v')||'development';}catch(_){return 'development';}}
 const viewport=()=>innerWidth<=760?'phone':'desktop';
 function notify(){root.dispatchEvent(new Event('weekwise-performance-change'));}
 function save(){if(!session||invalidated||app.account()!==session.owner)return;try{model().put(localStorage,session.owner,session.generation,session.row);notify();}catch(_){session=null;notify();}}
 function start(){
  if(session||invalidated||!root.webVitals)return;
  let state;try{state=model().read(localStorage,owner).value;}catch(_){return;}if(!state.enabled)return;
  const captured={owner,generation:state.generation,row:{id:crypto.randomUUID(),day:new Date().toISOString().slice(0,10),build:build(),viewport:viewport(),lcp:null,inp:null,cls:null,navigation:[]}};session=captured;
  for(const [method,field]of [['onLCP','lcp'],['onINP','inp'],['onCLS','cls']])root.webVitals[method](metric=>{if(session!==captured||invalidated||app.account()!==captured.owner)return;captured.row[field]=metric.value;save();},{reportAllChanges:true});
 }
 function ownerChanged(){if(!app)return;const next=app.account();if(owner===next)return;owner=next;session=null;invalidated=true;notify();}
 function stop(){session=null;invalidated=true;notify();}
 function beginView(view){
  if(!session||invalidated)return null;const captured=session,start=performance.now(),kind=view.startsWith('list-')?'list':view.startsWith('folder:')?'folder':view.startsWith('tag:')?'tag':view;
  if(!model().views.includes(kind))return null;
  return ()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(session!==captured||invalidated||app.account()!==captured.owner)return;captured.row.navigation.push({view:kind,ms:Math.max(0,Math.round(performance.now()-start))});captured.row.navigation=captured.row.navigation.slice(-50);save();}));
 }
 function init(bridge){app=bridge;owner=app.account();start();root.addEventListener('storage',event=>{if(event.key===model().key('performance',owner)){session=null;invalidated=true;notify();}});root.addEventListener('pagehide',save);}
 root.WeekwisePerformance=Object.freeze({init,ownerChanged,stop,beginView,build,viewport});
})(window);
