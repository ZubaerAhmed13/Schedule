/* cloud controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
let cloudReadInFlight=null,initializingEpoch=-1,failedOwner=null,failedEpoch=-1;
function cloudFailure(){return failedOwner===weekwiseRuntime.currentDataOwner&&failedEpoch===weekwiseRuntime.cloudSessionEpoch;}
const diagnosticClock=()=>root.performance?.now?.()??Date.now();
function diagnostic(operation,outcome,owner,started){try{if(owner!==weekwiseRuntime.currentDataOwner)return;if(outcome==='failed'){failedOwner=owner;failedEpoch=weekwiseRuntime.cloudSessionEpoch;}else if(operation==='sync-save'&&outcome==='success'){failedOwner=null;failedEpoch=-1;}const recorded=root.WeekwiseDiagnostics?.record(localStorage,owner,{operation,outcome,build:root.WeekwisePerformance?.build()||'development',durationMs:diagnosticClock()-started});if(recorded&&root.dispatchEvent&&root.Event)root.dispatchEvent(new root.Event('weekwise-diagnostics-change'));}catch(_){}}
function notifySync(){if(root.dispatchEvent&&root.Event)root.dispatchEvent(new root.Event('weekwise-sync-status'));}
function buildCloudPayload(){let view='week';try{const v=localStorage.getItem('weekwise-calendar-view-v1');if(['day','week','month','agenda','year'].includes(v))view=v;}catch(_){}return {version:1,store:weekwiseRuntime.store,reminders:weekwiseRuntime.reminders,focusSessions:weekwiseRuntime.focusSessions,habits:weekwiseRuntime.habits,countdowns:weekwiseRuntime.countdowns,savedTaskFilters:weekwiseRuntime.savedTaskFilters,taskTemplates:weekwiseRuntime.taskTemplates,calendarView:view};}

function localHasWeekwiseData(){const hasActivities=Object.values(weekwiseRuntime.store.weeks||{}).some(w=>Array.isArray(w&&w.tasks)&&w.tasks.length>0);const hasNotes=Array.isArray(weekwiseRuntime.reminders)&&weekwiseRuntime.reminders.length>0;const hasHabits=Array.isArray(weekwiseRuntime.habits)&&weekwiseRuntime.habits.length>0;const hasCountdowns=Array.isArray(weekwiseRuntime.countdowns)&&weekwiseRuntime.countdowns.length>0;const hasFilters=Array.isArray(weekwiseRuntime.savedTaskFilters)&&weekwiseRuntime.savedTaskFilters.length>0;const hasCustomLists=Array.isArray(weekwiseRuntime.store.customLists)&&weekwiseRuntime.store.customLists.length>0;let settingsChanged=false;try{settingsChanged=JSON.stringify(weekwiseRuntime.store.settings)!==JSON.stringify(weekwiseRuntime.defaultSettings());}catch(_){}return hasActivities||hasNotes||hasHabits||hasCountdowns||hasFilters||hasCustomLists||(Array.isArray(weekwiseRuntime.taskTemplates)&&weekwiseRuntime.taskTemplates.length>0)||settingsChanged;}

function readCloudMeta(){try{const meta=JSON.parse(localStorage.getItem(weekwiseRuntime.CLOUD_META_KEY)||'null');if(meta?.fingerprint&&root.WeekwiseCloudMerge){try{meta.fingerprint=root.WeekwiseCloudMerge.fingerprint(JSON.parse(meta.fingerprint));}catch(_){}}return meta;}catch(_){return null;}}

function writeCloudMeta(revision,payload){localStorage.setItem(weekwiseRuntime.CLOUD_META_KEY,JSON.stringify({userId:weekwiseRuntime.cloudUser?.id||'',revision:Number(revision)||0,fingerprint:weekwiseRuntime.cloudFingerprint(payload),syncedAt:new Date().toISOString()}));}

function setCloudStatus(message){const el=weekwiseRuntime.$('cloudStatus');if(el){el.textContent=message;const m=String(message||'').toLowerCase();el.dataset.tone=/fail|error|invalid|incorrect|do not match|unavailable|not confirmed|could not|rejected|unable/.test(m)?'error':/synced|success|sent|created|updated|signed out/.test(m)?'success':/signing|creating|sending|checking|syncing|saving|loading/.test(m)?'loading':'';}const badge=weekwiseRuntime.$('cloudMenuBadge');if(badge){badge.textContent=weekwiseRuntime.offlineAccountSelected()?'Offline':weekwiseRuntime.cloudUser&&!weekwiseRuntime.cloudReady?'Connecting':WeekwiseData.syncLabel(message,!!weekwiseRuntime.cloudUser,!!weekwiseRuntime.cloudConflict);badge.title=message;}
 notifySync();}

function offlineAccountSelected(){return !weekwiseRuntime.cloudUser&&weekwiseRuntime.currentDataOwner!=='local'&&localStorage.getItem('weekwise-offline-owner-v1')===weekwiseRuntime.currentDataOwner&&root.WeekwiseOfflineAccess.canOpenOffline(localStorage,weekwiseRuntime.currentDataOwner,navigator.onLine);}

function renderOfflineAccountGate(){
 const available=!weekwiseRuntime.cloudUser&&weekwiseRuntime.currentDataOwner!=='local'&&root.WeekwiseOfflineAccess.canOpenOffline(localStorage,weekwiseRuntime.currentDataOwner,navigator.onLine);
 weekwiseRuntime.$('signinOfflineAccount').hidden=!available;weekwiseRuntime.$('signinOfflineNote').hidden=!available;
 const accountDevice=root.WeekwiseOfflineAccess.isAccountDevice(localStorage);
 weekwiseRuntime.$('signinLocalContinue').hidden=accountDevice;
 const note=weekwiseRuntime.$('signinLocalNote');if(note)note.hidden=accountDevice;
}

function openOfflineAccount(){
 if(weekwiseRuntime.currentDataOwner==='local'||weekwiseRuntime.cloudUser||!root.WeekwiseOfflineAccess.canOpenOffline(localStorage,weekwiseRuntime.currentDataOwner,navigator.onLine))return;
 if(weekwiseRuntime.plannerStorageBlocked||WeekwiseData.blockedKeys().length){weekwiseRuntime.setCloudStatus('Recover the saved account copy before opening it offline.');return;}
 weekwiseRuntime.cloudSessionEpoch++;weekwiseRuntime.cloudReady=false;clearTimeout(weekwiseRuntime.cloudSyncTimer);weekwiseRuntime.cloudSyncTimer=null;
 localStorage.setItem('weekwise-offline-owner-v1',weekwiseRuntime.currentDataOwner);weekwiseRuntime.finishSignInLanding();weekwiseRuntime.renderCloudPanel();weekwiseRuntime.setCloudStatus('Saved account planner opened offline. Changes stay on this device until you sign in to this account again.');
}

function renderCloudPanel(){
  root.WeekwiseJsonFiles.render(weekwiseRuntime.currentDataOwner);
 root.WeekwiseEntry?.refresh();
 weekwiseRuntime.renderOfflineAccountGate();
 const form=weekwiseRuntime.$('cloudAuthForm'),signed=weekwiseRuntime.$('cloudSignedIn'),email=weekwiseRuntime.$('cloudUserEmail'),conflict=weekwiseRuntime.$('cloudConflict');
 const recovery=weekwiseRuntime.cloudAuthMode==='recovery';
 const title=weekwiseRuntime.$('cloudAuthTitle');if(title)title.textContent=recovery?'Reset your password.':weekwiseRuntime.cloudUser?'Your account.':weekwiseRuntime.cloudAuthMode==='signup'?'Make Weekwise yours.':'Welcome back.';
 if(form)form.hidden=!!weekwiseRuntime.cloudUser&&!recovery;
 if(signed)signed.hidden=!weekwiseRuntime.cloudUser||recovery;
 if(email)email.textContent=weekwiseRuntime.cloudUser?.email||'';
 if(conflict)conflict.hidden=!weekwiseRuntime.cloudConflict;
 const lock=weekwiseRuntime.$('cloudOfflineLock');if(lock)lock.hidden=!weekwiseRuntime.offlineAccountSelected();
 if(!weekwiseRuntime.cloudClient)weekwiseRuntime.setCloudStatus('Cloud sign-in is unavailable because the Supabase library did not load. Local planning still works.');
 if(weekwiseRuntime.cloudConflict)weekwiseRuntime.setCloudStatus('Sync paused to protect both versions. Choose which copy to keep.');
 if(weekwiseRuntime.offlineAccountSelected()){weekwiseRuntime.setCloudStatus('Saved account planner open offline. Changes stay on this device until this account is signed in again.');weekwiseRuntime.$('cloudMenuBadge').textContent='Offline';}
}

function validateCloudPayload(payload){
 if(!payload||!payload.store)throw new Error('The cloud planner snapshot is incomplete.');WeekwiseData.validateStore(payload.store);
 for(const name of ['reminders','focusSessions','habits','countdowns','savedTaskFilters','taskTemplates'])if(payload[name]!==undefined)WeekwiseData.validateCollection(payload[name],name);
 return payload;
}

function saveCloudLocalPayload(payload,preserveView=false){
 if(localStorage.getItem(weekwiseRuntime.STORE_KEY)!==weekwiseRuntime.lastSavedDisk)throw new Error('Another tab has local changes. Reload this tab before downloading cloud data.');
 if(weekwiseRuntime.plannerStorageBlocked||WeekwiseData.blockedKeys().length)throw new Error('Stored data needs recovery before cloud changes can be applied.');
 const safe=JSON.parse(JSON.stringify(weekwiseRuntime.validateCloudPayload(payload)));
 safe.store.settings={...weekwiseRuntime.defaultSettings(),...safe.store.settings,timeZone:safe.store.settings.timeZone};safe.store.customLists=safe.store.customLists||[];safe.store.recurringTemplates=safe.store.recurringTemplates||[];
 const pairs=[['reminders',weekwiseRuntime.REMINDERS_KEY],['focusSessions',weekwiseRuntime.FOCUS_SESSIONS_KEY],['habits',weekwiseRuntime.HABITS_KEY],['countdowns',weekwiseRuntime.COUNTDOWNS_KEY],['savedTaskFilters',weekwiseRuntime.TASK_FILTERS_KEY],['taskTemplates',weekwiseRuntime.TASK_TEMPLATES_KEY]];
 const entries=[[weekwiseRuntime.STORE_KEY,JSON.stringify(safe.store)],...pairs.filter(([name])=>Array.isArray(safe[name])).map(([name,key])=>[key,JSON.stringify(safe[name])])];
 if(['day','week','month','agenda','year'].includes(safe.calendarView))entries.push(['weekwise-calendar-view-v1',safe.calendarView]);
 WeekwiseData.commitStorage(localStorage,entries,'weekwise-pre-cloud-v1');
 weekwiseRuntime.cloudApplyingRemote=true;
 try{
  weekwiseRuntime.store=safe.store;weekwiseRuntime.lastSavedStore=JSON.stringify(weekwiseRuntime.store);weekwiseRuntime.lastSavedDisk=localStorage.getItem(weekwiseRuntime.STORE_KEY);
  if(safe.reminders)weekwiseRuntime.reminders=safe.reminders;if(safe.focusSessions)weekwiseRuntime.focusSessions=safe.focusSessions;if(safe.habits)weekwiseRuntime.habits=safe.habits;if(safe.countdowns)weekwiseRuntime.countdowns=safe.countdowns;if(safe.savedTaskFilters)weekwiseRuntime.savedTaskFilters=safe.savedTaskFilters;if(safe.taskTemplates)weekwiseRuntime.taskTemplates=safe.taskTemplates;
  weekwiseRuntime.syncWorkspaceLists();if(!preserveView){weekwiseRuntime.currentWeek=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(weekwiseRuntime.now));weekwiseRuntime.mobileDay=weekwiseRuntime.now.getDay();weekwiseRuntime.monthAnchor=new Date(weekwiseRuntime.now.getFullYear(),weekwiseRuntime.now.getMonth(),1);}weekwiseRuntime.loadWeek(weekwiseRuntime.currentWeek);weekwiseRuntime.renderReminders();
 }finally{weekwiseRuntime.cloudApplyingRemote=false;}
}

function isolatePlannerOwner(nextOwner){
 if(weekwiseRuntime.currentDataOwner===nextOwner)return;
 root.dispatchEvent(new root.Event('weekwise-settings-owner-change'));
 const previousOwner=weekwiseRuntime.currentDataOwner,payload=JSON.parse(JSON.stringify(weekwiseRuntime.buildCloudPayload()));
 if(weekwiseRuntime.focusState?.owner===previousOwner){weekwiseRuntime.focusState=WeekwiseFocus.pause(weekwiseRuntime.focusState);WeekwiseData.commitStorage(localStorage,[['weekwise-focus-active-v1:'+previousOwner,JSON.stringify(weekwiseRuntime.focusState)]]);}
 root.WeekwiseReviewUI?.checkpointForOwnerChange();
 weekwiseRuntime.checkpointEditorDraft();
 localStorage.setItem('weekwise-account-cache-v1:'+previousOwner,JSON.stringify({payload,meta:weekwiseRuntime.readCloudMeta()}));
 weekwiseRuntime.closeTaskModal(true);
 // First-time local capture belongs to the account the user deliberately signs into.
 if(previousOwner==='local'&&nextOwner!=='local'&&!weekwiseRuntime.readCloudMeta()?.userId&&Object.values(payload.store.weeks).some(w=>w.tasks?.length)&&confirm('Use your device-only planner with this account? Cancel keeps it separate on this device.')){weekwiseRuntime.currentDataOwner=nextOwner;root.WeekwiseInterface?.navigation(weekwiseRuntime.workspaceView);root.WeekwiseInterface?.renderPins();root.WeekwiseProductivity?.render();root.WeekwiseQuality?.ownerChanged();root.WeekwisePlanUI?.render();root.WeekwiseReviewUI?.ownerChanged(nextOwner);return;}
 const cached=WeekwiseData.readJSON(localStorage,'weekwise-account-cache-v1:'+nextOwner,value=>{weekwiseRuntime.validateCloudPayload(value.payload);return value;},null);
 if(WeekwiseData.blockedKeys().length)throw new Error('This account cache needs recovery. Export the original data before continuing.');
 const next=cached?.payload||{version:1,store:{settings:weekwiseRuntime.defaultSettings(),weeks:{},recurringTemplates:[],customLists:[]},reminders:[],focusSessions:[],habits:[],countdowns:[],savedTaskFilters:[],taskTemplates:[]};
 for(const name of ['reminders','focusSessions','habits','countdowns','savedTaskFilters','taskTemplates'])if(!Array.isArray(next[name]))next[name]=[];
 weekwiseRuntime.saveCloudLocalPayload(next);weekwiseRuntime.currentDataOwner=nextOwner;
 root.WeekwiseInterface?.navigation(weekwiseRuntime.workspaceView);root.WeekwiseInterface?.renderPins();root.WeekwiseProductivity?.render();root.WeekwiseQuality?.ownerChanged();root.WeekwisePlanUI?.render();root.WeekwiseReviewUI?.ownerChanged(nextOwner);
 localStorage.setItem(weekwiseRuntime.CLOUD_META_KEY,JSON.stringify(cached?.meta||{userId:nextOwner==='local'?'':nextOwner,revision:0,fingerprint:weekwiseRuntime.cloudFingerprint(weekwiseRuntime.buildCloudPayload())}));
 weekwiseRuntime.focusState=null;
}

async function requestCloudSave(payload,revision,userId){return WeekwiseCloudTransport.save({client:weekwiseRuntime.cloudClient,url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY,userId,payload,revision});}

function applyCloudRow(row){
 weekwiseRuntime.saveCloudLocalPayload(row.data||{},true);
 weekwiseRuntime.cloudRevision=Number(row.revision)||0;weekwiseRuntime.cloudReady=true;weekwiseRuntime.cloudConflict=null;
 // Record what the server actually acknowledged, before local defaults and
 // recurrence materialization. Those generated changes still need uploading.
 weekwiseRuntime.writeCloudMeta(weekwiseRuntime.cloudRevision,row.data);
 weekwiseRuntime.renderCloudPanel();
 weekwiseRuntime.setCloudStatus('All changes synced. Last saved '+new Date(row.updated_at||Date.now()).toLocaleString()+'.');
 weekwiseRuntime.queueCloudSave();
}

function reconcileCloudRow(row){
 if(!root.WeekwiseCloudMerge)return false;
 const meta=weekwiseRuntime.readCloudMeta();
 if(!meta||meta.userId!==weekwiseRuntime.cloudUser?.id||weekwiseRuntime.currentDataOwner!==meta.userId||Number(row.revision)<=Number(meta.revision||0))return false;
 try{
  const base=weekwiseRuntime.validateCloudPayload(JSON.parse(meta.fingerprint)),remote=weekwiseRuntime.validateCloudPayload(row.data);
  const result=root.WeekwiseCloudMerge.merge(base,weekwiseRuntime.buildCloudPayload(),remote);
  if(!result.merged)return false;
  weekwiseRuntime.validateCloudPayload(result.payload);weekwiseRuntime.saveCloudLocalPayload(result.payload,true);
  weekwiseRuntime.cloudRevision=Number(row.revision);weekwiseRuntime.cloudReady=true;weekwiseRuntime.cloudConflict=null;
  weekwiseRuntime.writeCloudMeta(weekwiseRuntime.cloudRevision,remote);weekwiseRuntime.renderCloudPanel();
  weekwiseRuntime.setCloudStatus('All changes synced. Independent device changes combined.');
  return true;
 }catch(_){return false;}
}

function showCloudConflict(row){
 weekwiseRuntime.cloudConflict=row;weekwiseRuntime.cloudRevision=Number(row?.revision)||0;
 weekwiseRuntime.renderCloudPanel();
 weekwiseRuntime.setCloudStatus('Both this device and the cloud have changes. Choose which version to keep.');
}

function queueCloudSave(){
 if(localStorage.getItem(weekwiseRuntime.STORE_KEY)!==weekwiseRuntime.lastSavedDisk||['weekwise-reminders-v1','weekwise-focus-sessions-v1','weekwise-habits-v1','weekwise-countdowns-v1','weekwise-saved-filters-v1','weekwise-task-templates-v1'].some(key=>WeekwiseData.unchanged?.(localStorage,key)===false)){weekwiseRuntime.setCloudStatus('Another tab changed this planner. Reload before syncing.');return;}
 if(weekwiseRuntime.plannerStorageBlocked||WeekwiseData.blockedKeys().length||!weekwiseRuntime.cloudClient||!weekwiseRuntime.cloudUser||!weekwiseRuntime.cloudReady||weekwiseRuntime.cloudApplyingRemote||weekwiseRuntime.cloudConflict){
  if(weekwiseRuntime.offlineAccountSelected())weekwiseRuntime.setCloudStatus('Saved offline · Waiting to sign in and sync.');
  return;
 }
 if(!navigator.onLine){weekwiseRuntime.setCloudStatus('Saved offline · Waiting to sync.');return;}
 const meta=weekwiseRuntime.readCloudMeta();if(meta?.userId===weekwiseRuntime.cloudUser.id&&meta.fingerprint===weekwiseRuntime.cloudFingerprint(weekwiseRuntime.buildCloudPayload())){if(weekwiseRuntime.cloudSyncTimer){clearTimeout(weekwiseRuntime.cloudSyncTimer);weekwiseRuntime.cloudSyncTimer=null;}return;}
 if(weekwiseRuntime.cloudSyncTimer)clearTimeout(weekwiseRuntime.cloudSyncTimer);
 weekwiseRuntime.setCloudStatus('Changes saved on this device. Syncing to cloud…');
 weekwiseRuntime.cloudSyncTimer=setTimeout(()=>{weekwiseRuntime.cloudSyncTimer=null;weekwiseRuntime.saveCloudSnapshot();},900);
}

async function saveCloudSnapshot(){
 if(localStorage.getItem(weekwiseRuntime.STORE_KEY)!==weekwiseRuntime.lastSavedDisk||['weekwise-reminders-v1','weekwise-focus-sessions-v1','weekwise-habits-v1','weekwise-countdowns-v1','weekwise-saved-filters-v1','weekwise-task-templates-v1'].some(key=>WeekwiseData.unchanged?.(localStorage,key)===false)){weekwiseRuntime.setCloudStatus('Another tab changed this planner. Reload before syncing.');return;}
 if(weekwiseRuntime.plannerStorageBlocked||WeekwiseData.blockedKeys().length||!weekwiseRuntime.cloudClient||!weekwiseRuntime.cloudUser||!weekwiseRuntime.cloudReady||weekwiseRuntime.cloudApplyingRemote||weekwiseRuntime.cloudConflict||weekwiseRuntime.cloudBusy)return;
 weekwiseRuntime.cloudBusy=true;notifySync();const diagnosticStart=diagnosticClock();
 const payload=JSON.parse(JSON.stringify(weekwiseRuntime.buildCloudPayload())),expectedRevision=weekwiseRuntime.cloudRevision,savingUserId=weekwiseRuntime.cloudUser.id,savingEpoch=weekwiseRuntime.cloudSessionEpoch;
 let savedPayload=null;
 let reconciled=false;
 try{
  const {data,error}=await weekwiseRuntime.requestCloudSave(payload,expectedRevision,savingUserId);
  if(savingEpoch!==weekwiseRuntime.cloudSessionEpoch||weekwiseRuntime.cloudUser?.id!==savingUserId)return;
  if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;
  if(!result)throw new Error('The cloud returned no save result.');
  if(!result.saved){diagnostic('sync-save','review',savingUserId,diagnosticStart);const row={data:result.data||{},revision:Number(result.revision)||0,updated_at:result.updated_at||null};reconciled=reconcileCloudRow(row);if(!reconciled)weekwiseRuntime.showCloudConflict(row);return;}
  weekwiseRuntime.cloudRevision=Number(result.revision)||expectedRevision+1;weekwiseRuntime.cloudReady=true;
  weekwiseRuntime.writeCloudMeta(weekwiseRuntime.cloudRevision,payload);
  savedPayload=payload;diagnostic('sync-save','success',savingUserId,diagnosticStart);
  weekwiseRuntime.setCloudStatus('All changes synced · '+new Date(result.updated_at||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
  const badge=weekwiseRuntime.$('cloudMenuBadge');if(badge)badge.textContent='Synced';
 }catch(error){
  if(savingEpoch!==weekwiseRuntime.cloudSessionEpoch||weekwiseRuntime.cloudUser?.id!==savingUserId)return;
  console.warn('Weekwise cloud save could not be confirmed.');diagnostic('sync-save','failed',savingUserId,diagnosticStart);
  weekwiseRuntime.setCloudStatus('Cloud save failed. Your changes remain on this device. Weekwise will retry automatically when you reconnect. '+(error?.message||''));
 }finally{
  weekwiseRuntime.cloudBusy=false;notifySync();
  if(reconciled)weekwiseRuntime.queueCloudSave();
  // Recheck only after releasing the save lock. A timer may have fired while the
  // previous request was still in flight, so schedule again if newer edits exist.
  if(savedPayload&&weekwiseRuntime.cloudUser&&weekwiseRuntime.cloudReady&&!weekwiseRuntime.cloudConflict&&weekwiseRuntime.cloudFingerprint(weekwiseRuntime.buildCloudPayload())!==weekwiseRuntime.cloudFingerprint(savedPayload))weekwiseRuntime.queueCloudSave();
  if(savingEpoch!==weekwiseRuntime.cloudSessionEpoch&&weekwiseRuntime.cloudUser&&weekwiseRuntime.cloudReady&&!weekwiseRuntime.cloudConflict)weekwiseRuntime.queueCloudSave();
 }
}

async function startCloudForUser(user,force=false){
 if(weekwiseRuntime.plannerStorageBlocked||WeekwiseData.blockedKeys().length){weekwiseRuntime.setCloudStatus('Cloud sync paused: stored data needs recovery.');return;}
 if(!weekwiseRuntime.cloudClient||!user||root.WeekwiseOfflineAccess.isSignedOut(localStorage))return;
 if(weekwiseRuntime.cloudUser?.id===user.id&&weekwiseRuntime.currentDataOwner===user.id&&weekwiseRuntime.cloudReady&&!force)return;
 const epoch=weekwiseRuntime.cloudSessionEpoch,userId=user.id;
 if(weekwiseRuntime.cloudInitPromise&&weekwiseRuntime.cloudInitializationUser===userId&&initializingEpoch===epoch)return weekwiseRuntime.cloudInitPromise;
 const needsLanding=weekwiseRuntime.currentDataOwner!==userId||!weekwiseRuntime.$('signinLanding')?.hidden||!!weekwiseRuntime.cloudAuthBusy;
 initializingEpoch=epoch;
 const initializing=(async()=>{
  weekwiseRuntime.cloudUser=user;weekwiseRuntime.cloudReady=false;weekwiseRuntime.cloudConflict=null;
  try{
   weekwiseRuntime.isolatePlannerOwner(userId);weekwiseRuntime.renderCloudPanel();weekwiseRuntime.setCloudStatus('Checking your cloud data…');
   const {data:row,error}=await weekwiseRuntime.cloudClient.from('weekwise_cloud_data').select('user_id,data,revision,updated_at').eq('user_id',userId).maybeSingle();
   if(epoch!==weekwiseRuntime.cloudSessionEpoch||weekwiseRuntime.cloudUser?.id!==userId)return;if(error)throw error;
   const payload=weekwiseRuntime.buildCloudPayload(),meta=weekwiseRuntime.readCloudMeta(),localFingerprint=weekwiseRuntime.cloudFingerprint(payload),hasLocal=weekwiseRuntime.localHasWeekwiseData();
   if(!row){weekwiseRuntime.cloudRevision=0;weekwiseRuntime.cloudReady=true;root.WeekwiseOfflineAccess.grant(localStorage,userId);localStorage.removeItem('weekwise-offline-owner-v1');await weekwiseRuntime.saveCloudSnapshot();return;}
   weekwiseRuntime.validateCloudPayload(row.data);weekwiseRuntime.cloudReady=true;weekwiseRuntime.cloudRevision=Number(row.revision)||0;root.WeekwiseOfflineAccess.grant(localStorage,userId);localStorage.removeItem('weekwise-offline-owner-v1');
   if(meta?.userId===userId){
    const localDirty=localFingerprint!==meta.fingerprint,remoteChanged=Number(row.revision)>Number(meta.revision||0);
    if(localDirty&&remoteChanged){if(reconcileCloudRow(row))weekwiseRuntime.queueCloudSave();else weekwiseRuntime.showCloudConflict(row);return;}
    if(localDirty){weekwiseRuntime.queueCloudSave();return;}
    weekwiseRuntime.applyCloudRow(row);return;
   }
   if(!hasLocal){weekwiseRuntime.applyCloudRow(row);return;}weekwiseRuntime.showCloudConflict(row);
  }catch(error){
    if(epoch!==weekwiseRuntime.cloudSessionEpoch||weekwiseRuntime.cloudUser?.id!==userId)return;
    weekwiseRuntime.cloudReady=false;weekwiseRuntime.setCloudStatus('Cloud sync could not be initialized. Your data is preserved on this device. '+error.message);weekwiseRuntime.renderCloudPanel();
  }
 })();
 weekwiseRuntime.cloudInitializationUser=userId;weekwiseRuntime.cloudInitPromise=initializing;
 try{await initializing;}finally{if(weekwiseRuntime.cloudInitPromise===initializing){weekwiseRuntime.cloudInitPromise=null;weekwiseRuntime.cloudInitializationUser=null;}}
 if(needsLanding&&epoch===weekwiseRuntime.cloudSessionEpoch&&weekwiseRuntime.cloudUser?.id===userId&&weekwiseRuntime.currentDataOwner===userId&&(weekwiseRuntime.cloudReady||(!navigator.onLine&&root.WeekwiseOfflineAccess.allows(localStorage,userId))))weekwiseRuntime.finishSignInLanding();
}

function localPlannerSelected(){
 const url=new URL(root.location.href),explicitSignIn=url.searchParams.get('page')==='signin'||url.hash==='#weekwiseAccess';
 return !explicitSignIn&&localStorage.getItem('weekwise-local-mode-v1')==='true'&&weekwiseRuntime.currentDataOwner==='local'&&!root.WeekwiseOfflineAccess.isAccountDevice(localStorage);
}

async function initializeCloud(){
 weekwiseRuntime.setCloudAuthMode('signin',false);
 const gate=weekwiseRuntime.$('signinLanding');if(gate){gate.hidden=false;document.body.classList.add('signin-required');window.signinGateInFlow=false;}
 if(!weekwiseRuntime.cloudClient){root.WeekwiseEntry?.ready();if(localPlannerSelected()||weekwiseRuntime.offlineAccountSelected())weekwiseRuntime.finishSignInLanding();weekwiseRuntime.setCloudStatus('Cloud library unavailable. Weekwise still saves locally. Check your internet connection and reload to enable cloud sync.');weekwiseRuntime.renderCloudPanel();return;}
 try{
  // Subscribe before reading the session so auth redirects such as password recovery are not missed.
  weekwiseRuntime.cloudClient.auth.onAuthStateChange((event,session)=>{
   if(session?.user?.id!==weekwiseRuntime.cloudUser?.id||event==='SIGNED_OUT'){weekwiseRuntime.cloudSessionEpoch++;weekwiseRuntime.cloudReady=false;if(weekwiseRuntime.cloudSyncTimer)clearTimeout(weekwiseRuntime.cloudSyncTimer);weekwiseRuntime.$('signinLanding').hidden=false;document.body.classList.add('signin-required');}
   setTimeout(async()=>{
    if(event==='PASSWORD_RECOVERY'&&session?.user){await weekwiseRuntime.startCloudForUser(session.user);weekwiseRuntime.cloudUser=session.user;const gate=weekwiseRuntime.$('signinLanding');if(gate){gate.hidden=true;document.body.classList.remove('signin-required');}weekwiseRuntime.setCloudAuthMode('recovery');weekwiseRuntime.openCloudPanel();return;}
    if(session?.user&&!root.WeekwiseOfflineAccess.isSignedOut(localStorage))weekwiseRuntime.startCloudForUser(session.user).catch(()=>{});
    else{
      if(!navigator.onLine&&!root.WeekwiseOfflineAccess.isSignedOut(localStorage)&&root.WeekwiseOfflineAccess.allows(localStorage,weekwiseRuntime.currentDataOwner)){
        weekwiseRuntime.cloudUser=null;weekwiseRuntime.cloudReady=false;
        localStorage.setItem('weekwise-offline-owner-v1',weekwiseRuntime.currentDataOwner);
        weekwiseRuntime.finishSignInLanding();weekwiseRuntime.renderCloudPanel();return;
      }
      if(localPlannerSelected()){weekwiseRuntime.finishSignInLanding();weekwiseRuntime.renderCloudPanel();return;}
      if(weekwiseRuntime.offlineAccountSelected()){weekwiseRuntime.finishSignInLanding();weekwiseRuntime.renderCloudPanel();return;}if(weekwiseRuntime.activeUtilityPanel===weekwiseRuntime.$('cloudPanel'))weekwiseRuntime.closeUtilityPanel(false);try{weekwiseRuntime.isolatePlannerOwner('local');}catch(error){weekwiseRuntime.setCloudStatus('Account data could not be isolated: '+error.message);return;}weekwiseRuntime.cloudUser=null;weekwiseRuntime.cloudReady=false;weekwiseRuntime.cloudRevision=0;weekwiseRuntime.cloudConflict=null;if(weekwiseRuntime.cloudSyncTimer)clearTimeout(weekwiseRuntime.cloudSyncTimer);weekwiseRuntime.renderCloudPanel();if(event==='SIGNED_OUT')weekwiseRuntime.setCloudStatus('Signed out. Your schedules remain saved on this device.');else if(event==='INITIAL_SESSION')weekwiseRuntime.setCloudStatus('');weekwiseRuntime.$('signinLanding').hidden=false;document.body.classList.add('signin-required');window.signinGateInFlow=false;}
   },0);
  });
  const {data:{session}}=await weekwiseRuntime.cloudClient.auth.getSession();
  if(session?.user&&!root.WeekwiseOfflineAccess.isSignedOut(localStorage))await weekwiseRuntime.startCloudForUser(session.user);else if(localPlannerSelected()||weekwiseRuntime.offlineAccountSelected()){weekwiseRuntime.finishSignInLanding();weekwiseRuntime.renderCloudPanel();}else weekwiseRuntime.renderOfflineAccountGate();
 }catch(error){
  console.warn('Account session could not be checked.');
  if(!navigator.onLine&&root.WeekwiseOfflineAccess.allows(localStorage,weekwiseRuntime.currentDataOwner)){
    weekwiseRuntime.renderOfflineAccountGate();
    weekwiseRuntime.setCloudStatus('Your verified account is saved here. Open the account planner offline to continue.');
  }else weekwiseRuntime.setCloudStatus('Could not check sign-in. Reconnect and sign in to continue.');
 }finally{root.WeekwiseEntry?.ready();}
}

function setCloudAuthMode(mode,resetStatus=true){
 weekwiseRuntime.cloudAuthMode=['signin','signup','recovery'].includes(mode)?mode:'signin';
 const signup=weekwiseRuntime.cloudAuthMode==='signup',recovery=weekwiseRuntime.cloudAuthMode==='recovery';
 const signInTab=weekwiseRuntime.$('cloudSignInMode'),signUpTab=weekwiseRuntime.$('cloudSignUpBtn'),tabs=document.querySelector('.cloud-auth-tabs');
 if(signInTab){signInTab.classList.toggle('active',weekwiseRuntime.cloudAuthMode==='signin');signInTab.setAttribute('aria-selected',weekwiseRuntime.cloudAuthMode==='signin'?'true':'false');signInTab.tabIndex=signup?-1:0;}
 if(signUpTab){signUpTab.classList.toggle('active',signup);signUpTab.setAttribute('aria-selected',signup?'true':'false');signUpTab.tabIndex=signup?0:-1;}
 if(tabs)tabs.hidden=recovery;
 const body=weekwiseRuntime.$('cloudAuthBody');if(body)body.setAttribute('aria-labelledby',recovery?'cloudAuthTitle':signup?'cloudSignUpBtn':'cloudSignInMode');
 const emailWrap=weekwiseRuntime.$('cloudEmailWrap');if(emailWrap)emailWrap.hidden=recovery;
 weekwiseRuntime.$('cloudEmail').required=!recovery;
 weekwiseRuntime.$('cloudAuthIntro').textContent=recovery?'Choose a new password to get back to your plans.':signup?'One account for your plans, on every device. An invite code is required to join.':'Sign in to bring your plans together, wherever you open Weekwise.';
 weekwiseRuntime.$('cloudSignInBtn').textContent=recovery?'Update password':signup?'Create account':'Sign in';
 weekwiseRuntime.$('cloudPasswordLabel').textContent=recovery?'New password':'Password';
 weekwiseRuntime.$('cloudPassword').placeholder=recovery?'Choose a new password':signup?'At least 8 characters':'Enter your password';
 weekwiseRuntime.$('cloudPassword').autocomplete=signup||recovery?'new-password':'current-password';
 weekwiseRuntime.$('cloudConfirmPasswordWrap').hidden=!(signup||recovery);
 weekwiseRuntime.$('cloudConfirmPassword').required=signup||recovery;
 weekwiseRuntime.$('cloudReferralCodeWrap').hidden=!signup;
 weekwiseRuntime.$('cloudReferralCode').required=signup;
 if(!signup)weekwiseRuntime.$('cloudReferralCode').value='';
 weekwiseRuntime.$('cloudConfirmPassword').autocomplete='new-password';
 weekwiseRuntime.$('cloudForgotPassword').hidden=signup||recovery;
 weekwiseRuntime.$('cloudPasswordHint').textContent=signup||recovery?'At least 8 characters.':'Your Weekwise password.';
 if(!signup&&!recovery){weekwiseRuntime.$('cloudConfirmPassword').value='';weekwiseRuntime.$('cloudConfirmPassword').setCustomValidity('');}
 weekwiseRuntime.$('cloudPassword').type='password';weekwiseRuntime.$('cloudTogglePassword').textContent='Show';weekwiseRuntime.$('cloudTogglePassword').setAttribute('aria-label','Show password');weekwiseRuntime.$('cloudTogglePassword').setAttribute('aria-pressed','false');
 if(resetStatus)weekwiseRuntime.setCloudStatus('');
 weekwiseRuntime.renderCloudPanel();
}

function setCloudAuthBusy(busy){
 weekwiseRuntime.cloudAuthBusy=busy;
 weekwiseRuntime.$('cloudAuthForm')?.setAttribute('aria-busy',String(busy));
 ['cloudEmail','cloudPassword','cloudConfirmPassword','cloudReferralCode','cloudSignInBtn','cloudSignUpBtn','cloudSignInMode','cloudForgotPassword','cloudTogglePassword','signinLocalContinue','signinOfflineAccount'].forEach(id=>{const el=weekwiseRuntime.$(id);if(el)el.disabled=busy;});
 const button=weekwiseRuntime.$('cloudSignInBtn');
 if(button&&busy){button.dataset.previousLabel=button.textContent;button.textContent=weekwiseRuntime.cloudAuthMode==='signup'?'Creating account…':weekwiseRuntime.cloudAuthMode==='recovery'?'Updating password…':'Signing in…';}
 else if(button&&!busy){button.textContent=weekwiseRuntime.cloudAuthMode==='signup'?'Create account':weekwiseRuntime.cloudAuthMode==='recovery'?'Update password':'Sign in';}
}

function validateCloudPassword(){
 const password=weekwiseRuntime.$('cloudPassword').value,confirmation=weekwiseRuntime.$('cloudConfirmPassword').value;
 if(password.length<8){weekwiseRuntime.setCloudStatus('Use a password with at least 8 characters.');weekwiseRuntime.$('cloudPassword').focus();return false;}
 if((weekwiseRuntime.cloudAuthMode==='signup'||weekwiseRuntime.cloudAuthMode==='recovery')&&password!==confirmation){weekwiseRuntime.setCloudStatus('The passwords do not match. Please check both fields.');weekwiseRuntime.$('cloudConfirmPassword').focus();return false;}
 return true;
}

async function cloudSignIn(){
 if(!weekwiseRuntime.cloudClient){weekwiseRuntime.setCloudStatus('Cloud library unavailable. Your local schedules are still saved.');return;}
 const email=weekwiseRuntime.$('cloudEmail').value.trim(),password=weekwiseRuntime.$('cloudPassword').value;
 if(!email||!password){weekwiseRuntime.$('cloudAuthForm').reportValidity();return;}
 weekwiseRuntime.setCloudAuthBusy(true);weekwiseRuntime.setCloudStatus('Signing in…');
 try{
  const {data,error}=await weekwiseRuntime.cloudClient.auth.signInWithPassword({email,password});
  if(error){
   const message=error.message||'Please try again.';
   if(/email not confirmed/i.test(message))weekwiseRuntime.setCloudStatus('Your email is not confirmed yet. Open the confirmation email from Supabase, then return and sign in.');
   else if(/invalid login credentials/i.test(message))weekwiseRuntime.setCloudStatus('Email or password is incorrect. Check your details or use Forgot password.');
   else weekwiseRuntime.setCloudStatus('Sign-in failed: '+message);
   return;
  }
  if(data?.user){root.WeekwiseOfflineAccess.unlockAfterPassword(localStorage);weekwiseRuntime.$('cloudPassword').value='';weekwiseRuntime.$('cloudConfirmPassword').value='';weekwiseRuntime.cloudUser=data.user;await weekwiseRuntime.startCloudForUser(data.user,true);}
 }catch(error){weekwiseRuntime.setCloudStatus('Could not sign in: '+(error?.message||'Please try again.'));}
 finally{weekwiseRuntime.setCloudAuthBusy(false);}
}

async function cloudSignUp(){
 if(!weekwiseRuntime.cloudClient){weekwiseRuntime.setCloudStatus('Cloud library unavailable. Your local schedules are still saved.');return;}
 const email=weekwiseRuntime.$('cloudEmail').value.trim();
 const referralCode=weekwiseRuntime.$('cloudReferralCode').value.trim().toUpperCase();
 if(!email||!referralCode){weekwiseRuntime.$('cloudAuthForm').reportValidity();if(!referralCode){weekwiseRuntime.setCloudStatus('A referral code from the Weekwise owner is required to create an account.');weekwiseRuntime.$('cloudReferralCode').focus();}return;}
 if(!weekwiseRuntime.validateCloudPassword())return;
 weekwiseRuntime.setCloudAuthBusy(true);weekwiseRuntime.setCloudStatus('Checking invite and creating your Weekwise account…');
 try{
  const {data,error}=await weekwiseRuntime.cloudClient.auth.signUp({email,password:weekwiseRuntime.$('cloudPassword').value,options:{emailRedirectTo:location.origin+location.pathname,data:{weekwise_referral_code:referralCode}}});
  if(error){weekwiseRuntime.setCloudStatus('Account creation failed: '+(error.message||'Check your referral code and try again.'));return;}
  weekwiseRuntime.$('cloudReferralCode').value='';
  weekwiseRuntime.$('cloudPassword').value='';weekwiseRuntime.$('cloudConfirmPassword').value='';weekwiseRuntime.$('cloudConfirmPassword').setCustomValidity('');
  if(data?.session&&data?.user){
   weekwiseRuntime.cloudUser=data.user;await weekwiseRuntime.startCloudForUser(data.user,true);if(weekwiseRuntime.cloudReady)weekwiseRuntime.setCloudStatus('Account created and cloud sync is ready.');
  }else{
   weekwiseRuntime.setCloudStatus('Account created. Check your inbox and spam folder for your confirmation email, then come back to sign in.');
   weekwiseRuntime.setCloudAuthMode('signin',false);
  }
 }catch(error){weekwiseRuntime.setCloudStatus('Could not create your account: '+(error?.message||'Please try again.'));}
 finally{weekwiseRuntime.setCloudAuthBusy(false);}
}

async function cloudResetPassword(){
 if(!weekwiseRuntime.cloudClient){weekwiseRuntime.setCloudStatus('Cloud library unavailable.');return;}
 const email=weekwiseRuntime.$('cloudEmail').value.trim();
 if(!email){weekwiseRuntime.setCloudStatus('Enter your email address first, then choose Forgot password.');weekwiseRuntime.$('cloudEmail').focus();return;}
 weekwiseRuntime.setCloudAuthBusy(true);weekwiseRuntime.setCloudStatus('Sending password-reset link…');
 try{
  const {error}=await weekwiseRuntime.cloudClient.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(error)throw error;
  weekwiseRuntime.setCloudStatus('Password-reset email sent if that account exists. Check your inbox and spam folder.');
 }catch(error){weekwiseRuntime.setCloudStatus('Could not send reset email: '+(error?.message||'Please try again.'));}
 finally{weekwiseRuntime.setCloudAuthBusy(false);}
}

async function cloudUpdatePassword(){
 if(!weekwiseRuntime.cloudClient||!weekwiseRuntime.cloudUser){weekwiseRuntime.setCloudStatus('Open the password-reset link from your email again to continue.');return;}
 if(!weekwiseRuntime.validateCloudPassword())return;
 weekwiseRuntime.setCloudAuthBusy(true);weekwiseRuntime.setCloudStatus('Updating your password…');
 try{
  const {error}=await weekwiseRuntime.cloudClient.auth.updateUser({password:weekwiseRuntime.$('cloudPassword').value});
  if(error)throw error;
  weekwiseRuntime.$('cloudPassword').value='';weekwiseRuntime.$('cloudConfirmPassword').value='';
  weekwiseRuntime.setCloudAuthMode('signin',false);weekwiseRuntime.setCloudStatus('Password updated successfully.');
  weekwiseRuntime.renderCloudPanel();
 }catch(error){weekwiseRuntime.setCloudStatus('Could not update password: '+(error?.message||'Please try again.'));}
 finally{weekwiseRuntime.setCloudAuthBusy(false);}
}

async function submitCloudAuth(){
 if(weekwiseRuntime.cloudAuthBusy)return;
 if(weekwiseRuntime.cloudAuthMode==='signup')return weekwiseRuntime.cloudSignUp();
 if(weekwiseRuntime.cloudAuthMode==='recovery')return weekwiseRuntime.cloudUpdatePassword();
 return weekwiseRuntime.cloudSignIn();
}

function wireCloudAuthControls(){
 weekwiseRuntime.$('cloudSignInMode').addEventListener('click',()=>weekwiseRuntime.setCloudAuthMode('signin'));
 weekwiseRuntime.$('cloudSignUpBtn').addEventListener('click',()=>weekwiseRuntime.setCloudAuthMode('signup'));
 document.querySelector('.cloud-auth-tabs')?.addEventListener('keydown',event=>{
  if(weekwiseRuntime.cloudAuthBusy||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const signup=event.key==='End'||(!['Home'].includes(event.key)&&weekwiseRuntime.cloudAuthMode!=='signup');
  weekwiseRuntime.setCloudAuthMode(signup?'signup':'signin');weekwiseRuntime.$(signup?'cloudSignUpBtn':'cloudSignInMode').focus();
 });
 weekwiseRuntime.$('cloudForgotPassword').addEventListener('click',weekwiseRuntime.cloudResetPassword);
 weekwiseRuntime.$('cloudTogglePassword').addEventListener('click',()=>{
  const input=weekwiseRuntime.$('cloudPassword'),show=input.type==='password';input.type=show?'text':'password';
  weekwiseRuntime.$('cloudTogglePassword').textContent=show?'Hide':'Show';
  weekwiseRuntime.$('cloudTogglePassword').setAttribute('aria-label',show?'Hide password':'Show password');
  weekwiseRuntime.$('cloudTogglePassword').setAttribute('aria-pressed',show?'true':'false');
 });
 weekwiseRuntime.$('cloudConfirmPassword').addEventListener('input',()=>{
  const input=weekwiseRuntime.$('cloudConfirmPassword');
  input.setCustomValidity(input.value&&input.value!==weekwiseRuntime.$('cloudPassword').value?'Passwords do not match.':'');
 });
 weekwiseRuntime.$('cloudPassword').addEventListener('input',()=>{
  const input=weekwiseRuntime.$('cloudConfirmPassword');
  if(input.value)input.setCustomValidity(input.value!==weekwiseRuntime.$('cloudPassword').value?'Passwords do not match.':'');
 });
 weekwiseRuntime.$('cloudAuthForm').addEventListener('submit',e=>{e.preventDefault();weekwiseRuntime.submitCloudAuth();});
 // The static form is visible before the SDK loads. Enable it only after its
 // submit handler is attached, so credentials cannot enter a native GET URL.
 const controls=weekwiseRuntime.$('cloudAuthControls');if(controls)controls.disabled=!weekwiseRuntime.cloudClient;
 weekwiseRuntime.$('cloudAuthForm').setAttribute('aria-busy','false');
}

async function cloudUseRemote(){
 if(!weekwiseRuntime.cloudConflict)return;
 const row=weekwiseRuntime.cloudConflict;weekwiseRuntime.cloudConflict=null;weekwiseRuntime.applyCloudRow(row);
}

async function cloudUseLocal(){
 if(!weekwiseRuntime.cloudConflict||!weekwiseRuntime.cloudUser)return;
 if(!confirm('Replace the cloud copy with the planner saved on this device? This cannot be automatically undone. Make sure you want to keep this version.'))return;
 const row=weekwiseRuntime.cloudConflict;weekwiseRuntime.cloudConflict=null;weekwiseRuntime.cloudRevision=Number(row.revision)||0;weekwiseRuntime.cloudReady=true;
 await weekwiseRuntime.saveCloudSnapshot();weekwiseRuntime.renderCloudPanel();
}

async function reconnectAccount(){
 if(!navigator.onLine||root.WeekwiseOfflineAccess.isSignedOut(localStorage))return;
 const owner=weekwiseRuntime.currentDataOwner;
 if(owner==='local')return;
 const waiting=localStorage.getItem('weekwise-offline-owner-v1')===owner;
 if(!waiting){await weekwiseRuntime.checkCloudForRemoteChanges(true);return;}
 if(!weekwiseRuntime.cloudClient){weekwiseRuntime.setCloudStatus('Saved offline. Sign in when the connection is available.');return;}
 try{
  const {data,error}=await weekwiseRuntime.cloudClient.auth.getSession();
  if(error||data?.session?.user?.id!==owner){
   weekwiseRuntime.cloudUser=null;weekwiseRuntime.cloudReady=false;
   weekwiseRuntime.$('signinLanding').hidden=false;document.body.classList.add('signin-required');
   weekwiseRuntime.renderCloudPanel();weekwiseRuntime.setCloudStatus('Your offline changes are saved. Sign in to the same account to sync them.');return;
  }
  await weekwiseRuntime.startCloudForUser(data.session.user,true);
  if(weekwiseRuntime.cloudReady)weekwiseRuntime.setCloudStatus('Your account has reconnected. Offline changes are being checked for sync.');
 }catch(_){weekwiseRuntime.setCloudStatus('Changes remain saved on this device. Reconnect when your account session is available.');}
}

async function cloudSyncNow(){
 if(!weekwiseRuntime.cloudUser){weekwiseRuntime.openUtilityPanel('cloudPanel','Cloud sync & account');weekwiseRuntime.setCloudStatus('Sign in to sync your schedules.');return;}
 if(weekwiseRuntime.cloudConflict){weekwiseRuntime.renderCloudPanel();weekwiseRuntime.setCloudStatus('Choose which version to keep before syncing.');return;}
 if(!weekwiseRuntime.cloudReady){await weekwiseRuntime.startCloudForUser(weekwiseRuntime.cloudUser,true);return;}
 await weekwiseRuntime.checkCloudForRemoteChanges(true);
}

async function checkCloudForRemoteChanges(force=false){
 if(!weekwiseRuntime.cloudClient||!weekwiseRuntime.cloudUser||weekwiseRuntime.plannerStorageBlocked||WeekwiseData.blockedKeys().length||weekwiseRuntime.cloudBusy||weekwiseRuntime.cloudConflict||(!force&&document.hidden))return;
 if(!weekwiseRuntime.cloudReady){await weekwiseRuntime.startCloudForUser(weekwiseRuntime.cloudUser,true);return;}
 const readUser=weekwiseRuntime.cloudUser.id,readEpoch=weekwiseRuntime.cloudSessionEpoch;
 if(cloudReadInFlight?.user===readUser&&cloudReadInFlight.epoch===readEpoch)return cloudReadInFlight.promise;
 const diagnosticStart=diagnosticClock();const reading=(async()=>{try{
  const {data:row,error}=await weekwiseRuntime.cloudClient.from('weekwise_cloud_data').select('user_id,data,revision,updated_at').eq('user_id',readUser).maybeSingle();
  if(readEpoch!==weekwiseRuntime.cloudSessionEpoch||weekwiseRuntime.cloudUser?.id!==readUser||weekwiseRuntime.currentDataOwner!==readUser||weekwiseRuntime.cloudBusy||weekwiseRuntime.cloudConflict)return;
  if(error)throw error;diagnostic('sync-read','success',readUser,diagnosticStart);
  const meta=weekwiseRuntime.readCloudMeta(),localFingerprint=weekwiseRuntime.cloudFingerprint(weekwiseRuntime.buildCloudPayload()),localDirty=meta?.userId!==readUser||localFingerprint!==meta.fingerprint;if(!localDirty){failedOwner=null;failedEpoch=-1;}
  if(row&&Number(row.revision)>weekwiseRuntime.cloudRevision){
   if(localDirty){if(reconcileCloudRow(row))weekwiseRuntime.queueCloudSave();else weekwiseRuntime.showCloudConflict(row);}else weekwiseRuntime.applyCloudRow(row);
  }else if(localDirty){
   // A failed upload leaves the cloud revision unchanged. Retry that local edit
   // even when there is nothing new to download; the RPC still checks revision.
   if(weekwiseRuntime.cloudSyncTimer){clearTimeout(weekwiseRuntime.cloudSyncTimer);weekwiseRuntime.cloudSyncTimer=null;}
   await weekwiseRuntime.saveCloudSnapshot();
  }else weekwiseRuntime.setCloudStatus('All changes synced. Checked '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'.');
 }catch(_){
  if(readEpoch===weekwiseRuntime.cloudSessionEpoch&&weekwiseRuntime.cloudUser?.id===readUser){diagnostic('sync-read','failed',readUser,diagnosticStart);weekwiseRuntime.setCloudStatus('Cloud check failed. Changes remain on this device; Weekwise will retry automatically when you reconnect.');}
 }})();
 const active={user:readUser,epoch:readEpoch,promise:reading};cloudReadInFlight=active;
 try{await reading;}finally{if(cloudReadInFlight===active)cloudReadInFlight=null;}
}

function openCloudPanel(){
 weekwiseRuntime.renderCloudPanel();
 if(!weekwiseRuntime.cloudUser&&weekwiseRuntime.cloudAuthMode!=='recovery'){
  if(weekwiseRuntime.activeUtilityPanel)weekwiseRuntime.closeUtilityPanel(false);
  weekwiseRuntime.openSignInFromLanding();return;
 }
 weekwiseRuntime.openUtilityPanel('cloudPanel',weekwiseRuntime.cloudAuthMode==='recovery'?'Reset your password':'Weekwise account');
}

function openSignInFromLanding(){const gate=weekwiseRuntime.$('signinLanding');if(gate){gate.hidden=false;document.body.classList.add('signin-required');}window.signinGateInFlow=false;root.WeekwiseEntry?.signIn();root.WeekwiseEntry?.refresh();weekwiseRuntime.$('cloudEmail').focus();}

function finishSignInLanding(){const gate=weekwiseRuntime.$('signinLanding');if(!gate)return;if(weekwiseRuntime.activeUtilityPanel===weekwiseRuntime.$('cloudPanel'))weekwiseRuntime.closeUtilityPanel(false);gate.hidden=true;root.WeekwiseEntry?.enterApp();document.body.classList.remove('signin-required');window.signinGateInFlow=false;weekwiseRuntime.setCloudStatus(weekwiseRuntime.$('cloudStatus')?.textContent||'');weekwiseRuntime.now=new Date();weekwiseRuntime.mobileDay=weekwiseRuntime.now.getDay();weekwiseRuntime.currentWeek=weekwiseRuntime.dateKey(weekwiseRuntime.sundayOf(weekwiseRuntime.now));weekwiseRuntime.monthAnchor=new Date(weekwiseRuntime.now.getFullYear(),weekwiseRuntime.now.getMonth(),1);weekwiseRuntime.loadWeek(weekwiseRuntime.currentWeek);weekwiseRuntime.setWorkspaceView('today');weekwiseRuntime.restoreFocusState();weekwiseRuntime.renderReminders();const heading=weekwiseRuntime.$('calendarInstruction');if(heading)heading.hidden=true;weekwiseRuntime.showToast('Welcome to Weekwise. Here is today’s plan.');}
return Object.freeze({reconnectAccount,cloudFailure,buildCloudPayload,localHasWeekwiseData,readCloudMeta,writeCloudMeta,setCloudStatus,offlineAccountSelected,renderOfflineAccountGate,openOfflineAccount,renderCloudPanel,validateCloudPayload,saveCloudLocalPayload,isolatePlannerOwner,requestCloudSave,applyCloudRow,showCloudConflict,queueCloudSave,saveCloudSnapshot,startCloudForUser,initializeCloud,setCloudAuthMode,setCloudAuthBusy,validateCloudPassword,cloudSignIn,cloudSignUp,cloudResetPassword,cloudUpdatePassword,submitCloudAuth,wireCloudAuthControls,cloudUseRemote,cloudUseLocal,cloudSyncNow,checkCloudForRemoteChanges,openCloudPanel,openSignInFromLanding,finishSignInLanding});
}
root.WeekwiseAppCloud=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
