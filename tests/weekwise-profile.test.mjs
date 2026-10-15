import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-data.js';
const data=WeekwiseData;
const store=()=>({settings:{timeZone:'UTC',weekStartsOn:1},weeks:{'2026-10-11':{tasks:[]}}});
test('optional personal details leave existing unmodified stores and backups valid',()=>{
 const prior=store(),before=JSON.stringify(prior);
 assert.equal(data.validateStore(prior),prior);
 assert.equal(JSON.stringify(prior),before);
 const backup={...prior,app:'Weekwise',version:6};
 assert.equal(data.parseBackup(JSON.stringify(backup)).settings.profile,undefined);
});
test('personal name and birth date remain part of planner settings and backup round trips',()=>{
 const planner=store();planner.settings.profile={fullName:'Preferred Name',dateOfBirth:'2000-02-29'};
 data.validateStore(planner);
 const backup={...planner,app:'Weekwise',version:6};
 assert.deepEqual(data.storeFromBackup(data.parseBackup(JSON.stringify(backup))).settings.profile,planner.settings.profile);
 assert.deepEqual(data.parseStore(JSON.stringify(planner)).settings.profile,planner.settings.profile);
  planner.settings.profile.showNameInGreeting=false;
  assert.deepEqual(data.storeFromBackup(data.parseBackup(JSON.stringify({...planner,app:'Weekwise',version:6}))).settings.profile,planner.settings.profile);
  planner.settings.profile.showNameInGreeting=true;
  assert.equal(data.parseStore(JSON.stringify(planner)).settings.profile.showNameInGreeting,true);
});
test('reject invalid profile objects, overflowing names, invalid DOB and control characters',()=>{
 const planner=store();
 for(const profile of [
  null,{fullName:12,dateOfBirth:''},{fullName:'x'.repeat(101),dateOfBirth:''},
  {fullName:'Secret\u0000Name',dateOfBirth:''},{fullName:'Valid',dateOfBirth:'2001-02-29'},
  {fullName:'Valid',dateOfBirth:'2000-13-01'},{fullName:'Valid',dateOfBirth:'not a date'},{fullName:'Valid',dateOfBirth:'',showNameInGreeting:'false'}
 ]){
  planner.settings.profile=profile;
  assert.throws(()=>data.validateStore(planner),/Personal|Date of birth/);
 }
});
