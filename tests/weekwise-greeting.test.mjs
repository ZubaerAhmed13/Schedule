import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-experience.js';

const greet=globalThis.WeekwiseExperience.greetingText;
const planner=(fullName,showNameInGreeting)=>({settings:{profile:{fullName,dateOfBirth:'',...(showNameInGreeting===undefined?{}:{showNameInGreeting})}}});

test('a natural time-of-day greeting uses planner minutes at exact boundaries',()=>{
 assert.equal(greet(planner('Ada'),0),'Good morning, Ada.');
 assert.equal(greet(planner('Ada'),719),'Good morning, Ada.');
 assert.equal(greet(planner('Ada'),720),'Good afternoon, Ada.');
 assert.equal(greet(planner('Ada'),1079),'Good afternoon, Ada.');
 assert.equal(greet(planner('Ada'),1080),'Good evening, Ada.');
 assert.equal(greet(planner('Ada'),1439),'Good evening, Ada.');
});

test('unnamed and legacy planner records retain the friendly default',()=>{
 assert.equal(greet({settings:{}},540),'Good morning.');
 assert.equal(greet({settings:{profile:{fullName:'',dateOfBirth:'2000-01-01'}}},780),'Good afternoon.');
 assert.equal(greet(undefined,1110),'Good evening.');
});

test('use the preferred display name as written, without guessing first name or using date of birth',()=>{
 assert.equal(greet(planner('  Mary   Jane  Watson  '),600),'Good morning, Mary Jane Watson.');
 assert.equal(greet(planner('李 小龍'),1170),'Good evening, 李 小龍.');
 assert.equal(greet(planner('O’Connor'),720),'Good afternoon, O’Connor.');
});

test('explicit display opt-out hides the name without erasing saved personal details',()=>{
 const store=planner('Private Name',false);
 assert.equal(store.settings.profile.fullName,'Private Name');
 assert.equal(greet(store,590),'Good morning.');
 store.settings.profile.showNameInGreeting=true;
 assert.equal(greet(store,590),'Good morning, Private Name.');
});
