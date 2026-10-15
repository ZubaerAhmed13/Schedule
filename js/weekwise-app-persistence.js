/* persistence controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function loadStore(){
  try{
    const current=localStorage.getItem(weekwiseRuntime.STORE_KEY);
    if(current)return WeekwiseData.parseStore(current);
    const legacy=localStorage.getItem('weekwise-planner-v1');
    if(legacy){
      const old=WeekwiseData.parseStore(legacy);if(old&&old.settings&&old.weeks){
        const migrated={...old,settings:{...old.settings},weeks:{}};
        migrated.settings.travelDay=(Number(old.settings.travelDay||0)+1)%7;
        migrated.settings.cookStartDay=(Number(old.settings.cookStartDay||0)+1)%7;
        const oldShifts=old.settings.shifts||[];migrated.settings.shifts=[oldShifts[6]||{enabled:false,start:'09:00',end:'17:00'},...oldShifts.slice(0,6)];
        Object.entries(old.weeks).forEach(([mondayKey,week])=>{
          const sunday=weekwiseRuntime.parseKey(mondayKey);sunday.setDate(sunday.getDate()-1);const newKey=weekwiseRuntime.dateKey(sunday);
          const oldTasks=Array.isArray(week.tasks)?week.tasks:[];
          migrated.weeks[newKey]={...week,tasks:oldTasks.map(t=>({...t,day:(Number(t.day||0)+1)%7}))};
        });
        localStorage.setItem(weekwiseRuntime.STORE_KEY,JSON.stringify(migrated));return migrated;
      }
    }
    return {settings:weekwiseRuntime.defaultSettings(),weeks:{}};
  }catch(e){weekwiseRuntime.plannerStorageBlocked=true;weekwiseRuntime.plannerStorageError=e.message||'Stored planner data could not be read.';return {settings:weekwiseRuntime.defaultSettings(),weeks:{}}}
}

function loadReminders(){return WeekwiseData.readCollection(localStorage,weekwiseRuntime.REMINDERS_KEY);}

function saveReminders(){weekwiseRuntime.checkedCollectionSave(weekwiseRuntime.REMINDERS_KEY,weekwiseRuntime.reminders,value=>weekwiseRuntime.reminders=value);}

function storageSaveError(message){const error=new Error(message);error.name='WeekwiseStorageError';weekwiseRuntime.showToast(message);return error;}

function checkedCollectionSave(key,value,restore){try{WeekwiseData.writeCollection(localStorage,key,value);}catch(error){const raw=localStorage.getItem(key);if(raw!==null){try{restore(WeekwiseData.readCollection(localStorage,key));}catch(_){}}else restore([]);throw weekwiseRuntime.storageSaveError(error.message.startsWith('Another tab')?error.message:'Could not save this change. Previous records remain on this device.');}if(!weekwiseRuntime.cloudApplyingRemote)weekwiseRuntime.queueCloudSave();}

function saveStore(){
 if(weekwiseRuntime.plannerStorageBlocked||WeekwiseData.blockedKeys().length)return false;
 try{if(localStorage.getItem(weekwiseRuntime.STORE_KEY)!==weekwiseRuntime.lastSavedDisk){const fresh=WeekwiseData.parseStore(localStorage.getItem(weekwiseRuntime.STORE_KEY));weekwiseRuntime.lastSavedStore=JSON.stringify(fresh);weekwiseRuntime.lastSavedDisk=localStorage.getItem(weekwiseRuntime.STORE_KEY);throw new Error('Another tab changed your planner. Its records are preserved. Reload before continuing.');}const raw=JSON.stringify(weekwiseRuntime.store);WeekwiseData.commitStorage(localStorage,[[weekwiseRuntime.STORE_KEY,raw]]);weekwiseRuntime.lastSavedStore=raw;weekwiseRuntime.lastSavedDisk=raw;}
 catch(error){weekwiseRuntime.store=JSON.parse(weekwiseRuntime.lastSavedStore);weekwiseRuntime.tasks=JSON.parse(JSON.stringify(weekwiseRuntime.store.weeks[weekwiseRuntime.currentWeek]?.tasks||[]));throw weekwiseRuntime.storageSaveError(error.message.startsWith('Another tab')?error.message:'Could not save this change. Your previous planner remains on this device.');}
 if(!weekwiseRuntime.cloudApplyingRemote)weekwiseRuntime.queueCloudSave();return true;
}

function reconcileSplitTasks(){const all=weekwiseRuntime.workspaceRecords().map(r=>r.task),byId=new Map(all.map(t=>[t.id,t]));for(const parent of all){if(!parent.planningChildren?.length)continue;for(const sub of parent.subtasks||[]){if(sub.taskId&&byId.has(sub.taskId)){const child=byId.get(sub.taskId);sub.title=child.title;sub.done=!!child.done;}}const children=parent.planningChildren.map(id=>byId.get(id)).filter(Boolean);if(children.length===parent.planningChildren.length){parent.done=children.every(t=>t.done)&&(!parent.subtasks?.length||parent.subtasks.every(s=>s.done));parent.status=parent.done?'done':'todo';}}}

function saveCurrent(){weekwiseRuntime.reconcileSplitTasks();weekwiseRuntime.store.weeks[weekwiseRuntime.currentWeek]={...weekwiseRuntime.store.weeks[weekwiseRuntime.currentWeek],tasks:JSON.parse(JSON.stringify(weekwiseRuntime.tasks))};return weekwiseRuntime.saveStore();}

function exportEditorHistory(){
  if(!root.WeekwiseJsonFiles.allowed(weekwiseRuntime.currentDataOwner))return;
 try{
  const archive=WeekwiseDrafts.exportHistory(localStorage,weekwiseRuntime.currentDataOwner);
  if(!archive.entries.length){weekwiseRuntime.showToast('No editor drafts or archived drafts are saved for this planner on this device.');return;}
  const filename='weekwise-editor-history-'+weekwiseRuntime.dateKey(weekwiseRuntime.now)+'.json';
  const blob=new Blob([JSON.stringify(archive,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  weekwiseRuntime.showToast('Exported '+archive.entries.length+' editor history '+(archive.entries.length===1?'record':'records')+'. Keep the file private.');
 }catch(error){weekwiseRuntime.showToast(error.message||'Could not export editor history. Existing drafts were preserved.');}
}

function exportBackup(){if(!root.WeekwiseJsonFiles.allowed(weekwiseRuntime.currentDataOwner))return;if(weekwiseRuntime.plannerStorageBlocked||WeekwiseData.blockedKeys().length){weekwiseRuntime.showToast('Download the original data from the recovery notice before restoring.');return;}const payload={...weekwiseRuntime.store,app:'Weekwise',version:6,exportedAt:new Date().toISOString(),settings:weekwiseRuntime.store.settings,weeks:weekwiseRuntime.store.weeks,recurringTemplates:weekwiseRuntime.store.recurringTemplates||[],customLists:weekwiseRuntime.store.customLists||[],reminders:weekwiseRuntime.reminders,focusSessions:weekwiseRuntime.focusSessions,habits:weekwiseRuntime.habits,countdowns:weekwiseRuntime.countdowns,savedTaskFilters:weekwiseRuntime.savedTaskFilters,taskTemplates:weekwiseRuntime.taskTemplates};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`weekwise-backup-${weekwiseRuntime.currentWeek}.json`;a.click();URL.revokeObjectURL(url);weekwiseRuntime.showToast('Backup exported');}

async function loadImport(file){
  if(!root.WeekwiseJsonFiles.allowed(weekwiseRuntime.currentDataOwner)||!weekwiseRuntime.dataCanWrite())return;
 const readingOwner=weekwiseRuntime.currentDataOwner,readingEpoch=weekwiseRuntime.cloudSessionEpoch,before=new Map(WeekwiseRecovery.keys.map(key=>[key,localStorage.getItem(key)]));
 const ownerChanged=()=>readingOwner!==weekwiseRuntime.currentDataOwner||readingEpoch!==weekwiseRuntime.cloudSessionEpoch||!!(weekwiseRuntime.cloudUser&&weekwiseRuntime.cloudUser.id!==readingOwner);
 const checkOwner=()=>{if(ownerChanged()||!root.WeekwiseJsonFiles.allowed(weekwiseRuntime.currentDataOwner))throw new Error('The planner owner changed during the import. Choose the file again.');if(readingOwner!=='local'&&(weekwiseRuntime.cloudBusy||weekwiseRuntime.cloudConflict))throw new Error('Cloud sync is busy or needs conflict review. Resolve sync before restoring a backup.');};
 const checkEntries=entries=>{checkOwner();if(entries.some(([key])=>localStorage.getItem(key)!==before.get(key)))throw new Error('Your planner changed while reading the backup. Choose it again to review the restore.');};
 try{
  if(file.size>WeekwiseData.MAX_BACKUP_BYTES)throw new Error('Backup must be smaller than 10 MB.');
  const raw=await file.text();checkOwner();const data=WeekwiseData.parseBackup(raw),entries=WeekwiseRecovery.entries(data);checkEntries(entries);
  const count=Object.values(data.weeks).reduce((sum,week)=>sum+week.tasks.length,0);
  if(!confirm('Restore this JSON backup with '+count+' tasks to '+(readingOwner==='local'?'the device-only planner':'your signed-in planner and its synced cloud copy')+'? The included records will replace the current ones. A local recovery checkpoint will be kept. Export a backup first if you need a separate copy.'))return;
  checkEntries(entries);
  const restored=WeekwiseData.storeFromBackup(data);
  WeekwiseData.commitStorage(localStorage,entries,'weekwise-pre-restore-v1');
  WeekwiseData.clearBlocked(entries.map(([key])=>key));weekwiseRuntime.plannerStorageBlocked=false;weekwiseRuntime.plannerStorageError='';weekwiseRuntime.store=restored;weekwiseRuntime.lastSavedStore=JSON.stringify(weekwiseRuntime.store);weekwiseRuntime.lastSavedDisk=localStorage.getItem(weekwiseRuntime.STORE_KEY);
  if(Array.isArray(data.reminders))weekwiseRuntime.reminders=data.reminders;
  if(Array.isArray(data.focusSessions))weekwiseRuntime.focusSessions=data.focusSessions;
  if(Array.isArray(data.habits))weekwiseRuntime.habits=data.habits;
  if(Array.isArray(data.countdowns))weekwiseRuntime.countdowns=data.countdowns;
  if(Array.isArray(data.savedTaskFilters))weekwiseRuntime.savedTaskFilters=data.savedTaskFilters;
  if(Array.isArray(data.taskTemplates))weekwiseRuntime.taskTemplates=data.taskTemplates;
  weekwiseRuntime.store.settings={...weekwiseRuntime.defaultSettings(),...weekwiseRuntime.store.settings,timeZone:weekwiseRuntime.store.settings.timeZone};
  weekwiseRuntime.syncWorkspaceLists();weekwiseRuntime.loadWeek(weekwiseRuntime.currentWeek);weekwiseRuntime.renderReminders();weekwiseRuntime.renderHabitTracker();weekwiseRuntime.renderCountdowns();weekwiseRuntime.renderTaskTemplateOptions();
  weekwiseRuntime.$('storageRecoveryNotice')?.remove();weekwiseRuntime.queueCloudSave();weekwiseRuntime.showToast('Backup restored. A pre-restore recovery checkpoint is kept on this device.');
 }catch(e){weekwiseRuntime.showToast(ownerChanged()?'Your account changed while this backup was being read. Choose it again.':e.message||'That file does not look like a Weekwise backup.');}
}

function showStorageRecoveryNotice(){
 if(weekwiseRuntime.$('storageRecoveryNotice'))return;
 if(!weekwiseRuntime.plannerStorageBlocked&&!WeekwiseData.blockedKeys().length)return;
 const banner=document.createElement('aside');banner.id='storageRecoveryNotice';banner.setAttribute('role','alert');
 banner.style.cssText='position:fixed;z-index:5000;bottom:16px;left:16px;right:16px;padding:16px;background:#fff3df;color:#382a15;border:2px solid #976519;border-radius:12px';
 const message=document.createElement('p');message.textContent='Your stored planner could not be read. Saving and cloud sync are paused to protect it. '+weekwiseRuntime.plannerStorageError+' Affected collections: '+WeekwiseData.blockedKeys().map(key=>key.replace('weekwise-','')).join(', ')+'. Download the original data before attempting recovery. Saving remains paused until the affected local data is safely repaired.';
 const button=document.createElement('button');button.className='btn';button.textContent='Download original local data';
 button.onclick=()=>{const raw=JSON.stringify(Object.fromEntries([weekwiseRuntime.STORE_KEY,'weekwise-planner-v1',...WeekwiseData.blockedKeys()].map(key=>[key,localStorage.getItem(key)])),null,2);const url=URL.createObjectURL(new Blob([raw],{type:'text/plain'}));const link=document.createElement('a');link.href=url;link.download='weekwise-recovery-original.txt';link.click();URL.revokeObjectURL(url);};
 banner.append(message,button);document.body.append(banner);
}

function plannerSnapshot(){const snapshot=JSON.parse(JSON.stringify(weekwiseRuntime.store));if(snapshot.weeks[weekwiseRuntime.currentWeek]||weekwiseRuntime.tasks.length)snapshot.weeks[weekwiseRuntime.currentWeek]={...snapshot.weeks[weekwiseRuntime.currentWeek],tasks:JSON.parse(JSON.stringify(weekwiseRuntime.tasks))};return {store:snapshot,currentWeek:weekwiseRuntime.currentWeek};}

function commitPlannerSnapshot(expected,account,next,checkpointKey,zoneReviewed=false){
  if(weekwiseRuntime.plannerStorageBlocked||WeekwiseData.blockedKeys().length)throw new Error('Stored planner data needs recovery before planning changes can be saved.');
  if(!zoneReviewed&&weekwiseRuntime.zoneNeedsReview())throw new Error('Review the time zone notice before applying a plan.');
  if(weekwiseRuntime.cloudConflict)throw new Error('Resolve the cloud conflict before applying a plan.');
  if(localStorage.getItem(weekwiseRuntime.STORE_KEY)!==weekwiseRuntime.lastSavedDisk)throw new Error('Another tab changed the saved planner. Reload and build a fresh preview.');
  if(account!==weekwiseRuntime.currentDataOwner||(weekwiseRuntime.cloudUser&&weekwiseRuntime.cloudUser.id!==weekwiseRuntime.currentDataOwner))throw new Error('Your account changed. Build a fresh preview.');
  const snapshot=JSON.parse(JSON.stringify(weekwiseRuntime.store));if(snapshot.weeks[weekwiseRuntime.currentWeek]||weekwiseRuntime.tasks.length)snapshot.weeks[weekwiseRuntime.currentWeek]={...snapshot.weeks[weekwiseRuntime.currentWeek],tasks:JSON.parse(JSON.stringify(weekwiseRuntime.tasks))};
  if(JSON.stringify({store:snapshot,currentWeek:weekwiseRuntime.currentWeek})!==expected)throw new Error('Your planner changed. Build a fresh preview.');
  WeekwiseData.validateStore(next);
  const entries=[[weekwiseRuntime.STORE_KEY,JSON.stringify(next)]];if(zoneReviewed)entries.push([WeekwiseZoneConversion.reviewKey(account),JSON.stringify({plannerZone:next.settings.timeZone,deviceZone:Intl.DateTimeFormat().resolvedOptions().timeZone})]);WeekwiseData.commitStorage(localStorage,entries,checkpointKey);
  weekwiseRuntime.store=next;weekwiseRuntime.lastSavedStore=JSON.stringify(weekwiseRuntime.store);weekwiseRuntime.lastSavedDisk=localStorage.getItem(weekwiseRuntime.STORE_KEY);weekwiseRuntime.tasks=JSON.parse(JSON.stringify(weekwiseRuntime.store.weeks[weekwiseRuntime.currentWeek]?.tasks||[]));
  weekwiseRuntime.syncSettingsForm();weekwiseRuntime.renderAll();weekwiseRuntime.queueCloudSave();
 
}
return Object.freeze({loadStore,loadReminders,saveReminders,storageSaveError,checkedCollectionSave,saveStore,reconcileSplitTasks,saveCurrent,exportEditorHistory,exportBackup,loadImport,showStorageRecoveryNotice,plannerSnapshot,commitPlannerSnapshot});
}
root.WeekwiseAppPersistence=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
