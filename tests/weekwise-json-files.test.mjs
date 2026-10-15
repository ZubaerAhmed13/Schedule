import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-json-files.js';

const policy=globalThis.WeekwiseJsonFiles;

test('JSON file transfers are available for device-only and signed-in account planners',()=>{
 for(const owner of ['local','signed-in-owner','saved-offline-account'])assert.equal(policy.allowed(owner),true);
 for(const owner of ['',null,undefined,'   '])assert.equal(policy.allowed(owner),false);
});

test('settings file controls stay available in both modes and pending selections clear on owner switch',()=>{
 const oldDocument=globalThis.document;
 const tools=[{hidden:true,inert:true},{hidden:false,inert:false,tagName:'INPUT',type:'file'}],accountInfo=[{hidden:true,inert:true}];
 const files=new Map(['importFile','workspaceImportListFile','calendarImportFile','qualityBackupFile'].map(id=>[id,{value:'selected.file'}]));
 globalThis.document={body:{dataset:{}},querySelectorAll(selector){return selector==='[data-device-only-json]'?tools:selector==='[data-cloud-json-info]'?accountInfo:[];},getElementById(id){return files.get(id)||null;}};
 try{
  policy.render('signed-in-owner');
  assert.equal(document.body.dataset.weekwiseJsonMode,'account');
  assert.equal(tools[0].hidden,false);
  assert.equal(tools[0].inert,false);
  assert.equal(tools[1].hidden,true);
  assert.equal(tools[1].inert,false);
  assert.equal(accountInfo[0].hidden,false);
  assert.ok([...files.values()].every(input=>input.value===''));
  files.get('importFile').value='pending.json';
  policy.render('signed-in-owner');
  assert.equal(files.get('importFile').value,'pending.json','ordinary rerenders should not discard a chosen file');
  policy.render('local');
  assert.equal(document.body.dataset.weekwiseJsonMode,'device');
  assert.equal(tools[0].hidden,false);
  assert.equal(accountInfo[0].hidden,true);
  assert.ok([...files.values()].every(input=>input.value===''),'an owner switch must clear selected files');
 }finally{
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
 }
});
