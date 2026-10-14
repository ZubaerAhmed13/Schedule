/* Device checks, bounded private measurements, and read-only backup rehearsal. */
(function(root){
 'use strict';let app=null,owner=null,report=null,device=null,deviceSequence=0,fileSequence=0,selectionOwner=null;
 const $=id=>document.getElementById(id),model=()=>root.WeekwiseEvidence,day=()=>new Date().toISOString().slice(0,10),build=()=>root.WeekwisePerformance.build();
 const visible=()=>!$('utilityModal').hidden&&$('utilityModalContent').contains($('qualityPanel'));
 function status(message){$('qualityStatus').textContent=message;}
 function syncState(){return app.syncState();}
 function renderSync(){
  const s=syncState();let label,description;
  if(s.recovery){label='Saving paused';description='Saved data needs recovery or another tab has newer changes. Keep a backup and resolve the notice before syncing.';}
  else if(s.conflict){label='Needs review';description='Both copies are preserved. Export a backup of each device before choosing a version in Account & sync.';}
  else if(s.mode==='device'){label='Device planner';description='This planner stays in this browser. Sign in to use your account planner across devices; the two planners stay separate.';}
  else if(s.mode==='offline-account'){label='Saved account copy';description='You are using this account’s saved copy offline. Sign in to the same account again to upload its changes.';}
  else if(!navigator.onLine){label='Offline';description='Your saved changes stay on this device. Weekwise retries when you reconnect and return to the app.';}
  else if(s.busy){label='Syncing';description='Your latest saved changes are being checked with the cloud.';}
  else if(!s.ready||s.error){label='Connection needs attention';description='Your device copy is preserved. Try Sync now; check your connection or open Account & sync if the problem continues.';}
  else if(s.pending!==false){label='Waiting to sync';description='This device has changes that have not yet been confirmed by the cloud. Keep the app open or use Sync now.';}
  else{label='Synced';description='Your latest saved copy has been acknowledged by the cloud. Other devices must use this same account.';}
  $('qualitySyncState').textContent=label;$('qualitySyncDescription').textContent=description;
  $('qualitySyncSaved').textContent=s.lastSavedAt?'Last cloud confirmation: '+new Date(s.lastSavedAt).toLocaleString()+'.':'No account confirmation recorded on this device.';
  $('qualitySyncNow').hidden=s.mode!=='account';$('qualitySyncNow').disabled=s.busy||s.conflict||s.recovery||!navigator.onLine;
 }
 function renderDiagnostics(){
  try{
   const value=root.WeekwiseDiagnostics.read(localStorage,owner).value,s=root.WeekwiseDiagnostics.summary(value,build());
   $('qualityRecordDiagnostics').checked=value.enabled;
   $('qualityDiagnosticsSummary').textContent='Recording '+(value.enabled?'on':'off')+' · '+s.events+' events for this build: '+s.success+' successful, '+s.failed+' failed, '+s.review+' requiring review. This is local troubleshooting evidence.';
   const list=$('qualityDiagnosticsEvents');list.replaceChildren();
   for(const row of value.events.filter(e=>e.build===build()).slice(-12).reverse()){const li=document.createElement('li');li.textContent=row.day+' · '+({'sync-read':'Cloud check','sync-save':'Cloud save','sync-start':'Cloud connection',runtime:'App error'}[row.operation])+' · '+row.outcome+(row.durationMs===null?'':' · '+row.durationMs+' ms');list.append(li);}
  }catch(error){status(error.message);}
 }
 function ownerChanged(){if(!app)return;const next=app.account();if(next===owner)return;owner=next;deviceSequence++;fileSequence++;report=null;device=null;$('qualityBackupFile').value='';$('qualityBackupResult').textContent='';$('qualityBackupReport').hidden=true;status('');root.WeekwisePerformance.ownerChanged();render();}
 function render(){
  if(!app)return;if(owner!==app.account()){ownerChanged();return;}
  try{renderSync();renderDiagnostics();}catch(_){$('qualitySyncNow').disabled=true;status('Planner status could not be checked. Your saved data was retained.');}
  try{
   const value=model().read(localStorage,owner).value,s=model().summary(value,root.WeekwisePerformance.viewport(),build());
   $('qualityRecordPerformance').checked=value.enabled;
   $('qualityPerformanceSummary').textContent=s.pageSamples+' page samples for this build on this '+(s.viewport==='phone'?'phone-size':'desktop-size')+' viewport. Recording '+(value.enabled?'enabled for future reloads.':'is off.');
   for(const name of ['lcp','inp','cls']){const row=s[name],id='quality'+name.toUpperCase();$(id).textContent=row.p75===null?'No sample':name==='cls'?row.p75.toFixed(3):name==='lcp'?(row.p75/1000).toFixed(2)+' s':Math.round(row.p75)+' ms';$(id+'Count').textContent=row.samples+' samples'+(row.samples<20?' · limited evidence':' · this device only');}
   $('qualityNavigation').textContent=s.navigation.length?s.navigation.map(n=>n.view+': '+Math.round(n.p75)+' ms ('+n.samples+' measurements)').join(' · '):'Navigate between views after enabling recording and reloading to measure response on this device.';
   const saved=model().readChecks(localStorage,owner).value.checks;
   for(const control of document.querySelectorAll('[data-quality-check]')){const entry=saved[control.dataset.qualityCheck];control.checked=!!entry?.confirmed;control.closest('label').querySelector('small').textContent=entry?.confirmed?'Confirmed by you on '+entry.day+(entry.build===build()?' for this build.':' on an earlier build; repeat after upgrading.'):'Not yet confirmed on this device.';}
  }catch(error){status(error.message);}
 }
 function workerHealth(worker){return new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},1800);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};worker.postMessage({type:'WEEKWISE_HEALTH_CHECK'},[channel.port2]);});}
 async function refresh(){
  ownerChanged();render();const captured=owner,id=++deviceSequence;
  let shell=null,subscription=false;
  try{const worker=navigator.serviceWorker?.controller;if(worker)shell=await workerHealth(worker);const reg=await navigator.serviceWorker?.getRegistration('./');subscription=!!(await reg?.pushManager?.getSubscription());}catch(_){shell=null;}
  if(owner!==captured||app.account()!==captured||deviceSequence!==id)return;
  const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,permission='Notification'in root?Notification.permission:'unsupported';
  device={installed,online:navigator.onLine,permission,pushSupported:'PushManager'in root,subscription,offlineShell:shell?.kind==='weekwise-shell-health'&&shell.missing===0,expectedAssets:shell?.kind==='weekwise-shell-health'?shell.expected:null,cachedAssets:shell?.kind==='weekwise-shell-health'?shell.cached:null,build:build()};
  $('qualityInstallState').textContent=installed?'Installed app window':'Browser tab';$('qualityNetworkState').textContent=navigator.onLine?'Browser reports online':'Browser reports offline';$('qualityPermissionState').textContent=permission==='granted'?'Notifications allowed':permission==='denied'?'Notifications blocked':permission==='default'?'Notification permission not chosen':'Notification API unavailable';
  $('qualityOfflineState').textContent=device.offlineShell?'Offline shell cached ('+device.cachedAssets+' assets)':'Offline shell not verified; open online and reload, then check again.';
  $('qualityPushState').textContent=subscription?'A local push subscription exists. Closed-app delivery still needs your confirmation.':device.pushSupported?'No local push subscription. Open reminder settings to enable this device.':'Background push is unavailable here; check another supported browser or an installed app.';
 }
 function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function init(bridge){
  app=bridge;owner=app.account();root.WeekwisePerformance.init({account:app.account});
  document.addEventListener('click',event=>{if(event.target.closest('[data-quality-open]')){ownerChanged();app.open('qualityPanel','Device, speed & recovery');refresh();}});
  $('qualityRefresh').onclick=refresh;$('qualityReminders').onclick=()=>document.getElementById('remindersMenuBtn').click();
  $('qualitySyncNow').onclick=async()=>{const captured=owner;try{await app.sync();if(captured===owner&&app.account()===captured)render();}catch(_){if(captured===owner)status('Sync could not be confirmed. Your saved device copy remains. Open Account & sync for help.');}};
  $('qualitySyncAccount').onclick=()=>app.openAccount();
  $('qualityRecordDiagnostics').onchange=()=>{try{root.WeekwiseDiagnostics.configure(localStorage,owner,$('qualityRecordDiagnostics').checked);renderDiagnostics();status($('qualityRecordDiagnostics').checked?'Troubleshooting recording enabled on this device.':'Troubleshooting recording stopped. Existing events remain until you clear them.');}catch(error){status(error.message);renderDiagnostics();}};
  $('qualityClearDiagnostics').onclick=()=>{if(!confirm('Clear this account’s troubleshooting history on this device?'))return;try{root.WeekwiseDiagnostics.clear(localStorage,owner);renderDiagnostics();status('Troubleshooting history cleared and recording disabled.');}catch(error){status(error.message);}};
  $('qualityRecordPerformance').onchange=()=>{try{model().recording(localStorage,owner,$('qualityRecordPerformance').checked);root.WeekwisePerformance.stop();render();status($('qualityRecordPerformance').checked?'Recording begins after your next reload. Save open work before refreshing.':'Performance recording stopped. Existing samples remain on this device.');}catch(error){status(error.message);render();}};
  $('qualityClearPerformance').onclick=()=>{if(!confirm('Clear this account’s performance samples on this device?'))return;try{model().clear(localStorage,owner);root.WeekwisePerformance.stop();render();status('Samples cleared and recording disabled.');}catch(error){status(error.message);}};
  $('qualityExport').onclick=()=>{try{download({kind:'weekwise-private-device-report',version:1,capturedOn:day(),build:build(),capabilities:device,sync:syncState(),diagnostics:root.WeekwiseDiagnostics.read(localStorage,owner).value,humanConfirmations:model().readChecks(localStorage,owner).value.checks,performance:model().exportPerformance(model().read(localStorage,owner).value),backupRehearsal:report},'weekwise-device-report.json');}catch(error){status(error.message);}};
  document.querySelectorAll('[data-quality-check]').forEach(control=>control.onchange=()=>{try{model().check(localStorage,owner,control.dataset.qualityCheck,control.checked,day(),build());render();}catch(error){status(error.message);render();}});
  $('qualityBackupFile').addEventListener('click',()=>{selectionOwner=owner;});
  $('qualityBackupFile').onchange=async()=>{
   if(selectionOwner!==null&&selectionOwner!==owner){$('qualityBackupFile').value='';selectionOwner=null;status('Your account changed while choosing the backup. Select it again for this account.');return;}selectionOwner=null;
   const file=$('qualityBackupFile').files[0],captured=owner,id=++fileSequence;report=null;$('qualityBackupReport').hidden=true;if(!file)return;
   $('qualityBackupResult').textContent='Checking an isolated copy…';
   try{if(file.size>root.WeekwiseData.MAX_BACKUP_BYTES)throw new Error('Too large');const next=await root.WeekwiseRecovery.rehearse(await file.text());if(owner!==captured||app.account()!==captured||fileSequence!==id)return;report=next;$('qualityBackupResult').textContent='Rehearsal passed: '+next.tasks+' tasks across '+next.weeks+' weeks; complete restored entries retained. SHA-256: '+next.sha256+'. Your planner and cloud copy were not changed.';$('qualityBackupReport').hidden=false;}
   catch(_){if(owner===captured&&app.account()===captured&&fileSequence===id)$('qualityBackupResult').textContent='This backup could not be rehearsed. Choose a supported Weekwise JSON backup under 10 MB. Your original file and planner were not changed.';}
  };
  $('qualityBackupReport').onclick=()=>{if(report)download(report,'weekwise-backup-rehearsal.json');};
  root.addEventListener('weekwise-performance-change',()=>{if(visible())render();});
  root.addEventListener('weekwise-sync-status',()=>{if(visible())render();});
  root.addEventListener('weekwise-diagnostics-change',()=>{if(visible())renderDiagnostics();});
  for(const event of ['error','unhandledrejection'])root.addEventListener(event,()=>{try{if(owner!==app.account())return;if(root.WeekwiseDiagnostics.record(localStorage,owner,{operation:'runtime',outcome:'failed',build:build()}))renderDiagnostics();}catch(_){}});
  for(const event of ['online','offline','focus'])root.addEventListener(event,()=>{if(visible())refresh();});
  root.addEventListener('storage',event=>{if([model().key('device-checks',owner),root.WeekwiseDiagnostics.key(owner)].includes(event.key)&&visible())render();});
  render();
 }
 root.WeekwiseQuality=Object.freeze({init,ownerChanged,refresh});
})(window);
