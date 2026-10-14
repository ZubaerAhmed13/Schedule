/* focus controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function focusOwner(){return weekwiseRuntime.currentDataOwner;}

function focusStateKey(){return 'weekwise-focus-active-v1:'+weekwiseRuntime.focusOwner();}

function freshFocus(mode='focus',seconds=1500,task=null){return WeekwiseFocus.create({id:weekwiseRuntime.uid(),owner:weekwiseRuntime.focusOwner(),mode,seconds,task});}

function restoreFocusState(){
 const saved=WeekwiseData.readJSON(localStorage,weekwiseRuntime.focusStateKey(),WeekwiseFocus.validate,null);
 weekwiseRuntime.focusState=saved&&saved.owner===weekwiseRuntime.focusOwner()?saved:weekwiseRuntime.freshFocus();
 if(weekwiseRuntime.focusInterval!==null)clearInterval(weekwiseRuntime.focusInterval);
 weekwiseRuntime.focusInterval=setInterval(weekwiseRuntime.focusTick,1000);weekwiseRuntime.renderFocusPanel();if(WeekwiseData.blockedKeys().length)weekwiseRuntime.showStorageRecoveryNotice();
}

function ensureFocusState(){if(!weekwiseRuntime.focusState||weekwiseRuntime.focusState.owner!==weekwiseRuntime.focusOwner())weekwiseRuntime.restoreFocusState();return weekwiseRuntime.focusState;}

function persistActiveFocus(){try{WeekwiseData.commitStorage(localStorage,[[weekwiseRuntime.focusStateKey(),JSON.stringify(weekwiseRuntime.focusState)]]);return true;}catch(_){weekwiseRuntime.showToast('Could not save this focus timer. Your previous session remains on this device.');return false;}}

function renderMatrixTask(record){
 const t=record.task,attrs=' data-matrix-week="'+weekwiseRuntime.escapeHtml(record.week)+'"';
 return '<article class="matrix-task"><input type="checkbox" data-matrix-done="'+weekwiseRuntime.escapeHtml(t.id)+'"'+attrs+' '+(t.done?'checked':'')+' aria-label="Complete '+weekwiseRuntime.escapeHtml(t.title)+'"><div><button type="button" class="matrix-task-title" data-matrix-edit="'+weekwiseRuntime.escapeHtml(t.id)+'"'+attrs+'>'+weekwiseRuntime.escapeHtml(t.title)+'</button><div class="matrix-task-meta">'+weekwiseRuntime.escapeHtml(record.listId==='inbox'?'Inbox':(weekwiseRuntime.WORKSPACE_LISTS.find(x=>x.id===record.listId)?.label||'Task'))+(t.dueDate?' · Due '+weekwiseRuntime.escapeHtml(weekwiseRuntime.fmtDate(weekwiseRuntime.parseKey(t.dueDate),{day:'numeric',month:'short'})):'')+'</div></div><button type="button" class="matrix-task-edit" title="Edit classification" aria-label="Edit '+weekwiseRuntime.escapeHtml(t.title)+'" data-matrix-edit="'+weekwiseRuntime.escapeHtml(t.id)+'"'+attrs+'>✎</button></article>';
}

function renderPriorityMatrix(){
 const lists={do:[],schedule:[],delegate:[],later:[],unclassified:[]};
 weekwiseRuntime.workspaceRecords().filter(r=>!r.task.done).forEach(r=>{
  const imp=r.task.importance,urg=r.task.urgency;
  if(!['important','not-important'].includes(imp)||!['urgent','not-urgent'].includes(urg)){lists.unclassified.push(r);return;}
  if(imp==='important'&&urg==='urgent')lists.do.push(r);
  else if(imp==='important'&&urg==='not-urgent')lists.schedule.push(r);
  else if(imp==='not-important'&&urg==='urgent')lists.delegate.push(r);
  else lists.later.push(r);
 });
 [['matrixDoList',lists.do],['matrixScheduleList',lists.schedule],['matrixDelegateList',lists.delegate],['matrixLaterList',lists.later],['matrixUnclassifiedList',lists.unclassified]].forEach(([id,items])=>{const el=weekwiseRuntime.$(id),page=weekwiseRuntime.listPage('matrix:'+id,items);if(el)el.innerHTML=items.length?page.records.map(weekwiseRuntime.renderMatrixTask).join('')+weekwiseRuntime.listPageFooter(page):'<div class="matrix-empty">No tasks here yet.</div>';});
 weekwiseRuntime.$('matrixUnclassifiedCount').textContent=String(lists.unclassified.length);
}

function taskLoggedFocusMinutes(taskId){return Math.round(weekwiseRuntime.focusSessions.filter(s=>s.taskId===taskId).reduce((total,s)=>total+Number(s.minutes||0),0));}

function renderFocusPanel(){
 const select=weekwiseRuntime.$('focusTaskSelect');if(!select)return;
 if(weekwiseRuntime.focusPickerOwner!==weekwiseRuntime.currentDataOwner){clearTimeout(weekwiseRuntime.focusPickerTimer);weekwiseRuntime.focusPickerOwner=weekwiseRuntime.currentDataOwner;weekwiseRuntime.focusPickerIndex=0;weekwiseRuntime.$('focusTaskSearch').value='';select.value='';}
 const state=weekwiseRuntime.ensureFocusState();
 const prior=state.task?(state.task.week+'::'+state.task.id):select.value,records=weekwiseRuntime.workspaceRecords().sort((a,b)=>a.date-b.date);
 weekwiseRuntime.focusPickerPage=WeekwiseFocusPicker.page(records,{query:weekwiseRuntime.$('focusTaskSearch').value,index:weekwiseRuntime.focusPickerIndex,selectedRef:prior,sessionTask:state.task});weekwiseRuntime.focusPickerIndex=weekwiseRuntime.focusPickerPage.index;
 const option=(record,pinned=false)=>'<option value="'+weekwiseRuntime.escapeHtml(WeekwiseFocusPicker.ref(record))+'">'+weekwiseRuntime.escapeHtml((pinned?'Selected · ':'')+record.task.title+(record.date?' · '+weekwiseRuntime.fmtDate(record.date,{day:'numeric',month:'short'}):' · saved session task')+(record.task.done?' · completed':'')+(record.task.focusEstimateMinutes?' · target '+record.task.focusEstimateMinutes+'m':''))+'</option>';
 select.innerHTML='<option value="">No linked task</option>'+(weekwiseRuntime.focusPickerPage.pinned?option(weekwiseRuntime.focusPickerPage.pinned,true):'')+weekwiseRuntime.focusPickerPage.items.map(record=>option(record)).join('');
 if([...select.options].some(o=>o.value===prior))select.value=prior;
 weekwiseRuntime.$('focusTaskCount').textContent=(weekwiseRuntime.focusPickerPage.total?'Tasks '+weekwiseRuntime.focusPickerPage.start+'–'+weekwiseRuntime.focusPickerPage.end+' of '+weekwiseRuntime.focusPickerPage.total:'No matching unfinished tasks')+(weekwiseRuntime.focusPickerPage.pinned?' · selected task kept visible':'');
 const selectedRecord=records.find(record=>WeekwiseFocusPicker.ref(record)===select.value);
 const targetHelp=weekwiseRuntime.$('focusTaskEstimateHelp');
 if(targetHelp){
  if(!selectedRecord)targetHelp.textContent=state.task?'Your session keeps its original task link, even when that task is no longer in the planner.':'Choose a task to attach this focus session to.';
  else{
   const target=Number(selectedRecord.task.focusEstimateMinutes)||0,logged=weekwiseRuntime.taskLoggedFocusMinutes(selectedRecord.task.id);
   targetHelp.textContent=target?logged+' of '+target+' estimated focus minutes logged'+(logged>=target?' · estimate reached':''):'No focus estimate set. Edit the task to add one.';
  }
 }
 const focusClock=WeekwiseToday.clock(weekwiseRuntime.store,weekwiseRuntime.now.getTime()),totalFocus=weekwiseRuntime.focusSessions.reduce((n,s)=>n+Number(s.seconds!=null?s.seconds/60:s.minutes||0),0),todayFocus=weekwiseRuntime.focusSessions.filter(s=>WeekwiseInsights.localDay(s.endedAt,focusClock.zone)===focusClock.date).reduce((n,s)=>n+Number(s.seconds!=null?s.seconds/60:s.minutes||0),0);
 const summary=weekwiseRuntime.$('focusSummary');if(summary)summary.innerHTML='<div class="focus-stat"><small>Focus time today</small><strong>'+weekwiseRuntime.durationText(todayFocus)+'</strong></div><div class="focus-stat"><small>Total focus time</small><strong>'+weekwiseRuntime.durationText(totalFocus)+'</strong></div><div class="focus-stat"><small>Recorded sessions</small><strong>'+weekwiseRuntime.focusSessions.length+'</strong></div>';
 const history=weekwiseRuntime.$('focusHistory'),historyTotal=weekwiseRuntime.$('focusHistoryTotal');if(historyTotal)historyTotal.textContent=weekwiseRuntime.focusSessions.length+' session'+(weekwiseRuntime.focusSessions.length===1?'':'s');
 if(history)history.innerHTML=weekwiseRuntime.focusSessions.slice().reverse().slice(0,6).map(s=>'<div class="focus-history-row"><div><strong>'+weekwiseRuntime.escapeHtml(s.taskTitle||'Focus session')+'</strong><small>'+weekwiseRuntime.escapeHtml(new Date(s.endedAt).toLocaleString('en-GB',{timeZone:focusClock.zone,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+'</small></div><span>'+Math.round(Number(s.minutes)||0)+' min</span></div>').join('')||'<div class="matrix-empty">Your completed focus sessions will appear here.</div>';
 weekwiseRuntime.updateFocusDisplay();
}

function persistFocusSessions(){weekwiseRuntime.checkedCollectionSave(weekwiseRuntime.FOCUS_SESSIONS_KEY,weekwiseRuntime.focusSessions,value=>weekwiseRuntime.focusSessions=value);}

function updateFocusDisplay(){
 const state=weekwiseRuntime.ensureFocusState(),seconds=WeekwiseFocus.remaining(state),clock=weekwiseRuntime.$('focusClock');if(!clock)return;
 clock.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
 weekwiseRuntime.$('focusModeLabel').textContent=state.mode==='focus'?'FOCUS TIME':state.mode==='long-break'?'LONG BREAK':'SHORT BREAK';
 weekwiseRuntime.$('focusProgressBar').style.width=(seconds/state.totalSeconds*100)+'%';
 weekwiseRuntime.$('focusStartBtn').textContent=state.runningSince!==null?'Pause':state.activeMs>0?'Resume':'Start '+(state.mode==='focus'?'focus':'break');
 weekwiseRuntime.$('focusTimerMessage').textContent=state.runningSince!==null?'Your timer continues across reloads. Paused time is excluded.':'Choose one task. Your timer is saved on this device.';
 document.querySelectorAll('[data-focus-length]').forEach(button=>{button.setAttribute('aria-pressed',String(Number(button.dataset.focusLength)*60===state.totalSeconds));button.disabled=state.runningSince!==null||state.activeMs>0;});
 const selectionLocked=state.runningSince!==null||state.activeMs>0;
 weekwiseRuntime.$('focusTaskSelect').disabled=selectionLocked;weekwiseRuntime.$('focusTaskSearch').disabled=selectionLocked;weekwiseRuntime.$('focusPreset').disabled=selectionLocked;
 if(state.mode==='focus'&&[25,50,90].includes(state.totalSeconds/60))weekwiseRuntime.$('focusPreset').value=String(state.totalSeconds/60);
 weekwiseRuntime.$('focusTaskPrevious').disabled=selectionLocked||!weekwiseRuntime.focusPickerPage?.hasPrevious;
 weekwiseRuntime.$('focusTaskNext').disabled=selectionLocked||!weekwiseRuntime.focusPickerPage?.hasNext;
}

function focusComplete(){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const state=weekwiseRuntime.ensureFocusState();if(state.logged)return;
 const result=WeekwiseFocus.finish(state),next=weekwiseRuntime.focusSessions.slice();
 if(result.record&&!next.some(record=>record.id===result.record.id))next.push(result.record);
 const following=weekwiseRuntime.freshFocus(state.mode==='focus'?'break':'focus',state.mode==='focus'?300:Number(weekwiseRuntime.$('focusPreset').value||25)*60);
 try{WeekwiseData.commitStorage(localStorage,[[weekwiseRuntime.FOCUS_SESSIONS_KEY,JSON.stringify(next)],[weekwiseRuntime.focusStateKey(),JSON.stringify(following)]]);}
 catch(error){weekwiseRuntime.focusState=WeekwiseFocus.pause(state);weekwiseRuntime.showToast(error.message);weekwiseRuntime.updateFocusDisplay();return;}
 weekwiseRuntime.focusSessions=next;weekwiseRuntime.focusState=following;weekwiseRuntime.queueCloudSave();weekwiseRuntime.renderFocusPanel();weekwiseRuntime.renderWorkspaceTasks();
 weekwiseRuntime.showToast(result.record?'Focus time recorded. Take a break when you are ready.':'Break finished. Ready for another focus session?');
}

function focusTick(){if(!weekwiseRuntime.focusState||weekwiseRuntime.focusState.owner!==weekwiseRuntime.focusOwner())return;if(weekwiseRuntime.focusState.runningSince!==null&&WeekwiseFocus.remaining(weekwiseRuntime.focusState)===0)weekwiseRuntime.focusComplete();else weekwiseRuntime.updateFocusDisplay();}

function focusStartPause(){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 let state=weekwiseRuntime.ensureFocusState();
 if(state.runningSince===null&&state.activeMs===0&&state.mode==='focus'){
  const ref=weekwiseRuntime.$('focusTaskSelect').value,split=ref.indexOf('::'),week=split<0?'':ref.slice(0,split),id=split<0?'':ref.slice(split+2),record=weekwiseRuntime.workspaceRecords().find(r=>r.week===week&&r.task.id===id);
  state={...state,totalSeconds:Number(weekwiseRuntime.$('focusPreset').value||25)*60,task:record?{id,week,title:record.task.title}:null};
 }
 const prior=weekwiseRuntime.focusState;weekwiseRuntime.focusState=state.runningSince===null?WeekwiseFocus.resume(state):WeekwiseFocus.pause(state);
 if(!weekwiseRuntime.persistActiveFocus())weekwiseRuntime.focusState=prior;weekwiseRuntime.updateFocusDisplay();
}

function focusReset(){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}const state=weekwiseRuntime.ensureFocusState();if((state.runningSince!==null||state.activeMs>0)&&!confirm('Reset this timer? Unrecorded focus time will be discarded. Use Finish session to save it.'))return;weekwiseRuntime.focusState=weekwiseRuntime.freshFocus('focus',Number(weekwiseRuntime.$('focusPreset').value||25)*60);weekwiseRuntime.persistActiveFocus();weekwiseRuntime.renderFocusPanel();}

function focusTakeBreak(long=false){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}const state=weekwiseRuntime.ensureFocusState();if(state.mode==='focus'&&WeekwiseFocus.elapsed(state)>0&&!state.logged){if(!confirm('Finish and record the current focus session before your break?'))return;weekwiseRuntime.focusComplete();}weekwiseRuntime.focusState=weekwiseRuntime.freshFocus(long?'long-break':'break',long?900:300);weekwiseRuntime.persistActiveFocus();weekwiseRuntime.renderFocusPanel();}
return Object.freeze({focusOwner,focusStateKey,freshFocus,restoreFocusState,ensureFocusState,persistActiveFocus,renderMatrixTask,renderPriorityMatrix,taskLoggedFocusMinutes,renderFocusPanel,persistFocusSessions,updateFocusDisplay,focusComplete,focusTick,focusStartPause,focusReset,focusTakeBreak});
}
root.WeekwiseAppFocus=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
