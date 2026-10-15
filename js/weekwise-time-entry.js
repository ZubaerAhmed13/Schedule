/* Accessible optional time chooser. Native fields remain the single source of truth.
   This module never reads or writes planner storage. */
(function(root){
'use strict';
function parse(raw,{end=false}={}){
 let value=String(raw??'').trim().toLowerCase().replace(/\s+/g,'');
 if(!value)return null;
 const meridiem=value.match(/(am|pm)$/);
 if(meridiem)value=value.slice(0,-2);
 value=value.replace('.',':');
 let hour,minute;
 const separated=value.match(/^(\d{1,2}):(\d{1,2})$/);
 if(separated){hour=Number(separated[1]);minute=Number(separated[2]);}
 else if(/^\d{1,2}$/.test(value)){hour=Number(value);minute=0;}
 else if(/^\d{3,4}$/.test(value)){hour=Number(value.slice(0,-2));minute=Number(value.slice(-2));}
 else return null;
 if(meridiem){
  if(hour<1||hour>12)return null;
  hour=hour%12+(meridiem[1]==='pm'?12:0);
 }
 if(!Number.isInteger(hour)||!Number.isInteger(minute)||minute>59||minute<0||hour<0||hour>24||(hour===24&&(!end||minute!==0)))return null;
 return String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
}
function mount(doc=document){
 if(!doc?.getElementById('taskForm'))return;
 const IDs=['modalTime','modalEndTime'];
 let active=null;
 const info=new Map();
 function close({restore=false}={}){
  if(!active)return;
  const {trigger,panel}=info.get(active);panel.hidden=true;trigger.setAttribute('aria-expanded','false');
  active=null;
  if(restore)trigger.focus({preventScroll:true});
 }
 function open(id){
  const item=info.get(id);if(!item)return;
  if(active===id){close({restore:true});return;}
  close();
  const {field,trigger,panel,hours,minutes}=item;
  const canonical=parse(field.value,{end:id==='modalEndTime'})||parse(id==='modalEndTime'?'10:30':'10:00');
  const [h,m]=canonical.split(':').map(Number);
  hours.value=String(h);
  fillMinutes(item,m);
  panel.hidden=false;trigger.setAttribute('aria-expanded','true');active=id;
  hours.focus({preventScroll:true});
 }
 function fillMinutes(item,value){
  const {hours,minutes}=item,limit=Number(hours.value)===24;
  const chosen=limit?0:value;
  const options=[...new Set([...Array(12)].map((_,i)=>i*5).concat(chosen))].sort((a,b)=>a-b);
  minutes.replaceChildren(...options.map(n=>{const opt=doc.createElement('option');opt.value=String(n);opt.textContent=String(n).padStart(2,'0');return opt;}));
  minutes.value=String(chosen);minutes.disabled=limit;
 }
 for(const id of IDs){
  const field=doc.getElementById(id);if(!field||doc.getElementById(id+'PickButton'))continue;
  const wrap=doc.createElement('div');wrap.className='time-entry-wrap';
  const trigger=doc.createElement('button');trigger.type='button';trigger.id=id+'PickButton';
  trigger.className='time-pick-trigger';trigger.setAttribute('aria-controls',id+'PickPanel');
  trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-label','Choose '+(id==='modalTime'?'start':'end')+' time');
  trigger.textContent='Choose';
  const panel=doc.createElement('div');panel.className='time-pick-panel';panel.id=id+'PickPanel';
  panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label',id==='modalTime'?'Start time picker':'End time picker');
  const heading=doc.createElement('div');heading.className='time-pick-heading';heading.textContent='Choose '+(id==='modalTime'?'start':'end')+' time';
  const row=doc.createElement('div');row.className='time-pick-selects';
  const hours=doc.createElement('select'),minutes=doc.createElement('select');
  hours.id=id+'PickHours';minutes.id=id+'PickMinutes';
  for(let h=0;h<=(id==='modalEndTime'?24:23);h++){const o=doc.createElement('option');o.value=String(h);o.textContent=String(h).padStart(2,'0');hours.append(o);}
  const hourLabel=doc.createElement('label');hourLabel.textContent='Hour';hourLabel.append(hours);
  const minuteLabel=doc.createElement('label');minuteLabel.textContent='Minute';minuteLabel.append(minutes);
  row.append(hourLabel,minuteLabel);
  const note=doc.createElement('p');note.className='time-pick-note';note.textContent='Five-minute choices here, or type any exact minute in the field.';
  const actions=doc.createElement('div');actions.className='time-pick-actions';
  const cancel=doc.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancel';
  const apply=doc.createElement('button');apply.type='button';apply.className='btn primary';apply.textContent='Use time';
  actions.append(cancel,apply);panel.append(heading,row,note,actions);
  field.parentNode.insertBefore(wrap,field);wrap.append(field,trigger,panel);
  info.set(id,{field,trigger,panel,hours,minutes});
  trigger.addEventListener('click',()=>open(id));
  hours.addEventListener('change',()=>fillMinutes(info.get(id),Number(minutes.value)));
  cancel.addEventListener('click',()=>close({restore:true}));
  apply.addEventListener('click',()=>{
   const h=Number(hours.value),m=h===24?0:Number(minutes.value);
   field.value=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
   close();field.dispatchEvent(new Event('input',{bubbles:true}));
   field.dispatchEvent(new Event('change',{bubbles:true}));
   field.focus({preventScroll:true});
  });
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close({restore:true});}});
 }
 doc.addEventListener('pointerdown',event=>{if(active&&!info.get(active).trigger.contains(event.target)&&!info.get(active).panel.contains(event.target))close();},true);
 doc.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close({restore:true});}},true);
 const observer=new MutationObserver(()=>{if(active&&!doc.getElementById('taskModal')?.classList.contains('show'))close();});
 observer.observe(doc.getElementById('taskModal'),{attributes:true,attributeFilter:['class']});
}
root.WeekwiseTimeEntry=Object.freeze({parse,mount});
})(typeof window!=='undefined'?window:globalThis);
