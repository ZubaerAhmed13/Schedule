import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const path=new URL('../js/weekwise-notification-settings.js',import.meta.url);
function fixture(){
 const ids=['notificationTimingForm','notificationLeadMinutes','notificationTimingStatus','notificationDeliveryNote','notificationQuietEnabled','notificationQuietStart','notificationQuietEnd','notificationGroupByTask'];
 const elements=new Map(ids.map(id=>[id,{value:'',checked:id==='notificationGroupByTask',textContent:'',dataset:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}}]));
 const selects=['study','job','life','language','hobby','other'].map(category=>({dataset:{notificationCategory:category},value:'inherit',options:[],replaceChildren(){this.options=[];},add(option){this.options.push(option);}}));
 let owner='local',store={settings:{reminderLeadMinutes:15},weeks:{}},fail=false;
 const document={getElementById:id=>elements.get(id),querySelectorAll(selector){return selector==='[data-notification-category]'?selects:[];},createElement:()=>({value:'',textContent:''}),addEventListener(){}};
 const context={document,addEventListener(){},WeekwiseReminderPolicy:{leadMinutes:n=>[5,15,60].includes(n)?n:0},JSON,Number,Error};context.window=context;
 if(fs.existsSync(path))vm.runInNewContext(fs.readFileSync(path,'utf8'),context);
 context.WeekwiseNotificationSettings.init({snapshot:()=>({store:structuredClone(store),currentWeek:'2030-01-06'}),account:()=>owner,commit(expected,account,next){if(fail)throw Error('Storage is full');assert.equal(account,owner);assert.equal(expected,JSON.stringify({store,currentWeek:'2030-01-06'}));store=next;},deliveryStatus:()=>owner==='local'?'Device-only planner.':'Account sync: Pending',permission(){}});
 return {elements,selects,context,setOwner(value){owner=value;},fail(){fail=true;},get store(){return store;},change(){elements.get('notificationTimingForm').listeners.change({target:{closest:()=>true}});},submit(){elements.get('notificationTimingForm').listeners.submit({preventDefault(){}});}};
}
test('reminder timing persists through a guarded transaction and reports success only afterwards',()=>{
 const f=fixture();f.elements.get('notificationLeadMinutes').value='60';f.change();f.submit();
 assert.equal(f.store.settings.reminderLeadMinutes,60);assert.match(f.elements.get('notificationTimingStatus').textContent,/Saved/);
});
test('failed saving restores previous selection',()=>{
 const f=fixture();f.fail();f.elements.get('notificationLeadMinutes').value='5';f.change();f.submit();
 assert.equal(f.elements.get('notificationLeadMinutes').value,'15');assert.match(f.elements.get('notificationTimingStatus').textContent,/Storage is full/);
});
test('account changes do not save previous account settings',()=>{
 const f=fixture();f.elements.get('notificationLeadMinutes').value='60';f.change();f.setOwner('another');f.submit();
 assert.equal(f.store.settings.reminderLeadMinutes,15);assert.match(f.elements.get('notificationTimingStatus').textContent,/account changed/);
});
test('quiet hours and advanced category defaults preserve old records',()=>{
 const f=fixture();f.elements.get('notificationQuietEnabled').checked=true;f.elements.get('notificationQuietStart').value='21:00';f.elements.get('notificationQuietEnd').value='07:00';
 f.elements.get('notificationGroupByTask').checked=false;f.selects.find(s=>s.dataset.notificationCategory==='study').value='60';f.change();f.submit();
 assert.equal(f.store.settings.reminderQuietHours.enabled,true);assert.equal(f.store.settings.reminderQuietHours.start,'21:00');
 assert.equal(f.store.settings.reminderCategoryLeadMinutes.study,60);assert.equal(f.store.settings.reminderGroupByTask,false);
});
test('invalid quiet hours never change settings',()=>{
 const f=fixture();f.elements.get('notificationQuietEnabled').checked=true;f.elements.get('notificationQuietStart').value='22:00';f.elements.get('notificationQuietEnd').value='22:00';f.change();f.submit();
 assert.equal(f.store.settings.reminderQuietHours,undefined);assert.match(f.elements.get('notificationTimingStatus').textContent,/different valid quiet-hours/);
});
