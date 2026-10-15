import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-json-files.js';

const policy=globalThis.WeekwiseJsonFiles;

test('only the independent device planner can import/export JSON',()=>{
 assert.equal(policy.allowed('local'),true);
 for(const owner of ['account-user','offline-account-owner','',null,undefined])assert.equal(policy.allowed(owner),false);
});

test('visibility changes in both directions and selected JSON files are cleared for account owners',()=>{
 const previously=globalThis.document;
 const deviceTools=[{hidden:false,inert:false},{hidden:false,inert:false}],accountHelp=[{hidden:true,inert:true}];
 const files=new Map(['importFile','workspaceImportListFile','qualityBackupFile'].map(id=>[id,{value:'selected.json'}]));
 globalThis.document={body:{dataset:{}},querySelectorAll(s){return s==='[data-device-only-json]'?deviceTools:s==='[data-cloud-json-info]'?accountHelp:[];},getElementById(id){return files.get(id)||null;}};
 try{
  policy.render('a-signed-in-user');
  assert.equal(document.body.dataset.weekwiseJsonMode,'account');
  assert.ok(deviceTools.every(x=>x.hidden&&x.inert));
  assert.ok(accountHelp.every(x=>!x.hidden&&!x.inert));
  assert.ok([...files.values()].every(x=>x.value===''));
  policy.render('local');
  assert.equal(document.body.dataset.weekwiseJsonMode,'device');
  assert.ok(deviceTools.every(x=>!x.hidden&&!x.inert));
  assert.ok(accountHelp.every(x=>x.hidden&&x.inert));
 }finally{if(previously===undefined)delete globalThis.document;else globalThis.document=previously;}
});
