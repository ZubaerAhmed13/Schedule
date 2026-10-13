import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-update-safety.js';
const update=globalThis.WeekwiseUpdateSafety;
function page({active=false,quick=''}={}){
 return {querySelector(sel){
  if(sel.includes('#taskModal.show'))return active?{}:null;
  if(sel==='#workspaceCaptureInput')return {value:quick};
  return null;
 }};
}
test('waiting PWA updates refuse to interrupt an open editor',()=>{
 assert.match(update.reason(page({active:true})),/Close or save/);
 assert.equal(update.reason(page()),'');
});
test('waiting PWA updates protect dirty weekly review and unsaved quick capture',()=>{
 assert.match(update.reason(page(),true),/weekly review/);
 assert.match(update.reason(page({quick:'  unsaved task  '})),/quick-capture/);
 assert.equal(update.reason(page({quick:'  '})), '');
 assert.throws(()=>update.reason(null),/Document is required/);
});
