/* Fast task controls use the same snapshot, owner and transaction guard as Plan. */
(function(root){
 'use strict';let app=null,owner=null,scope='',selecting=false,selected=new Map(),editing=null,bulk=null,undo=null,highlightsOwner=null;
 const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key=ref=>ref.week+'::'+ref.id,fingerprint=()=>JSON.stringify(app.snapshot());
 const controls=['taskQuickPriority','taskQuickDue','taskQuickEstimate','taskQuickUnscheduled','taskQuickDate','taskQuickTime','taskQuickDuration'];
 const values=()=>Object.fromEntries(controls.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));
 const dirty=()=>!!editing&&JSON.stringify(values())!==editing.initial;
 function syncTiming(){if(!editing)return;const protectedTiming=!!(editing.task.seriesId||editing.task.recurrence&&editing.task.recurrence!=='none'||editing.task.planningChildren?.length),allDay=!!editing.task.allDay;for(const id of ['taskQuickDate','taskQuickTime','taskQuickDuration'])$(id).disabled=protectedTiming||$('taskQuickUnscheduled').checked||allDay&&id!=='taskQuickDate';}
 const announce=message=>{$('taskActionsStatus').textContent=message;if($('todayHighlightDialog').open)$('todayHighlightStatus').textContent=message;app.announce(message);};
 const draftKey=account=>'weekwise-quick-edit-v1:'+encodeURIComponent(account);
 function readDraft(account){const raw=localStorage.getItem(draftKey(account));if(!raw)return null;const draft=JSON.parse(raw);if(draft.version!==1||draft.account!==account||!draft.ref||!draft.fields||typeof draft.base!=='string'||typeof draft.sessionId!=='string')throw new Error('The saved quick edit needs review; download it before discarding.');return {raw,draft};}
 function saveDraft(){if(!dirty())return;try{const stored=localStorage.getItem(draftKey(editing.account));if(stored!==editing.draftRaw)throw new Error('Another tab changed this quick-edit draft. Your fields remain open.');if(stored&&JSON.stringify(JSON.parse(stored).fields)===JSON.stringify(values()))return;const raw=JSON.stringify({version:1,account:editing.account,sessionId:editing.sessionId,ref:editing.ref,base:JSON.stringify(editing.task),fields:values(),savedAt:new Date().toISOString()});localStorage.setItem(draftKey(editing.account),raw);editing.draftRaw=raw;}catch(error){announce('Quick edit remains open, but its draft could not be saved: '+error.message);}}
 function removeDraft(session){const stored=localStorage.getItem(draftKey(session.account));if(stored&&stored!==session.draftRaw)throw new Error('Another tab saved a newer quick-edit draft; it was retained.');if(stored)localStorage.removeItem(draftKey(session.account));}
 function clearEditor(){editing=null;$('taskQuickEdit').hidden=true;$('taskQuickForm').reset();$('taskQuickTitle').textContent='Quick edit';$('taskQuickError').textContent='';}
 function commit(snapshot,account,next,message){
  app.commit(JSON.stringify(snapshot),account,next);
  undo={account,store:snapshot.store,expected:fingerprint()};render();announce(message+' Undo is available until another planner change or reload.');
 }
 function rowSelection(record){return '<input type="checkbox" class="task-selection-check" data-task-select="'+esc(record.task.id)+'" data-task-week="'+esc(record.week)+'" aria-label="Select '+esc(record.task.title)+'" '+(selected.has(key({id:record.task.id,week:record.week}))?'checked ':'')+(!root.WeekwiseTaskActions.eligible(record.task)?'disabled ':'')+'>';}
 function rowActions(record){
  if(!root.WeekwiseTaskActions.eligible(record.task))return '';
  const attrs=' data-task-week="'+esc(record.week)+'"';
  return '<button type="button" class="task-highlight-button" data-task-highlight="'+esc(record.task.id)+'"'+attrs+' aria-pressed="'+(record.task.todayPriority?'true':'false')+'" aria-label="'+(record.task.todayPriority?'Remove Today highlight from ':'Highlight today: ')+esc(record.task.title)+'" title="Today highlight">'+root.WeekwiseInterface.icon('star')+'</button><button type="button" data-task-quick="'+esc(record.task.id)+'"'+attrs+' aria-label="Quick edit '+esc(record.task.title)+'" title="Quick edit">'+root.WeekwiseInterface.icon('sliders')+'</button>';
 }
 function openEditor(ref,restoring=false){
  if(dirty()){announce('Save or cancel your current quick edit first.');$('taskQuickEdit').scrollIntoView({block:'nearest'});return;}
  if(!restoring&&localStorage.getItem(draftKey(app.account()))){announce('Restore or discard your saved quick edit before starting another.');return;}
  const snapshot=app.snapshot(),task=snapshot.store.weeks[ref.week]?.tasks.find(t=>t.id===ref.id);if(!root.WeekwiseTaskActions.eligible(task)){app.edit(ref.id,ref.week);return;}
  editing={ref,snapshot,account:app.account(),task,sessionId:crypto.randomUUID(),draftRaw:restoring?localStorage.getItem(draftKey(app.account())):null};
  $('taskQuickTitle').textContent='Quick edit · '+task.title;
  $('taskQuickPriority').value=task.priority||'none';$('taskQuickDue').value=task.dueDate||'';$('taskQuickEstimate').value=task.estimatedDurationMinutes??'';
  $('taskQuickUnscheduled').checked=!!(task.unscheduled||task.start==null)&&!task.allDay;
  $('taskQuickDate').value=root.WeekwisePlanning.dateAt(ref.week,task.day);
  $('taskQuickTime').value=task.start==null?'09:00':String(Math.floor(task.start/60)).padStart(2,'0')+':'+String(task.start%60).padStart(2,'0');
  $('taskQuickDuration').value=task.duration||30;
  const protectedTiming=!!(task.seriesId||task.recurrence&&task.recurrence!=='none'||task.planningChildren?.length);
  for(const id of ['taskQuickUnscheduled','taskQuickDate','taskQuickTime','taskQuickDuration'])$(id).disabled=protectedTiming||!!task.allDay&&id!=='taskQuickDate';
  $('taskQuickTimingNote').textContent=protectedTiming?'Recurring and linked timing uses the full reviewed editor. These changes apply to this task only.':'Times use '+(snapshot.store.settings.timeZone||'the planner zone')+'. Existing reminders keep their exact instants.';
  syncTiming();$('taskQuickError').textContent='';$('taskQuickEdit').hidden=false;editing.initial=JSON.stringify(values());
  $('taskQuickPriority').focus({preventScroll:true});$('taskQuickEdit').scrollIntoView({block:'nearest'});
 }
 function saveEditor(event){event.preventDefault();if(!editing)return;
  try{
   if(editing.account!==app.account())throw new Error('Your account changed. Reopen quick edit.');
   const v=values(),original=JSON.parse(editing.initial),patch={};
   if(v.taskQuickPriority!==original.taskQuickPriority)patch.priority=v.taskQuickPriority;
   if(v.taskQuickDue!==original.taskQuickDue)patch.dueDate=v.taskQuickDue||null;
   if(v.taskQuickEstimate!==original.taskQuickEstimate)patch.estimatedDurationMinutes=v.taskQuickEstimate?Number(v.taskQuickEstimate):null;
   if(['taskQuickUnscheduled','taskQuickDate','taskQuickTime','taskQuickDuration'].some(id=>v[id]!==original[id])){
    if(!/^\d{2}:\d{2}$/.test(v.taskQuickTime))throw new Error('Enter a 24-hour start time, for example 17:30.');
    const [h,m]=v.taskQuickTime.split(':').map(Number);if(h>23||m>59)throw new Error('Enter a valid 24-hour start time.');
    patch.schedule={date:v.taskQuickDate,start:h*60+m,duration:Number(v.taskQuickDuration),unscheduled:v.taskQuickUnscheduled,allDay:!!editing.task.allDay};
   }
   if(!Object.keys(patch).length){removeDraft(editing);clearEditor();render();announce('No task details changed.');return;}
   const session=editing,current=app.snapshot(),live=current.store.weeks[session.ref.week]?.tasks.find(task=>task.id===session.ref.id);
   if(!live||JSON.stringify(live)!==JSON.stringify(session.task))throw new Error('This task changed while you were editing. Your draft is retained; reopen it for review.');
   if(patch.schedule&&current.store.settings.timeZone!==session.snapshot.store.settings.timeZone)throw new Error('The planner time zone changed. Review the timing in a fresh quick edit.');
   const next=root.WeekwiseTaskActions.apply(current.store,[session.ref],patch);
   commit(current,session.account,next,'Task updated.');try{removeDraft(session);}catch(error){announce(error.message);}clearEditor();render();
  }catch(error){$('taskQuickError').textContent=error.message;announce(error.message);}
 }
 function highlight(ref){
  if(dirty()){announce('Save your quick edit before changing highlights.');return;}
  try{const snapshot=app.snapshot(),task=snapshot.store.weeks[ref.week]?.tasks.find(t=>t.id===ref.id);if(!task)return;
   const next=root.WeekwiseTaskActions.apply(snapshot.store,[ref],{todayPriority:!task.todayPriority});commit(snapshot,app.account(),next,task.todayPriority?'Today highlight removed.':'Today highlight chosen.');
  }catch(error){announce(error.message);}
 }
 function renderHighlights(){
  if(!$('todayHighlightDialog').open)return;
  const active=document.activeElement?.dataset.taskHighlight,query=$('todayHighlightSearch').value.trim().toLowerCase(),store=app.snapshot().store;
  const eligible=Object.entries(store.weeks).flatMap(([week,value])=>value.tasks.map(task=>({week,task}))).filter(r=>root.WeekwiseTaskActions.eligible(r.task)&&!r.task.done&&r.task.status!=='done'&&r.task.requiresCompletion!==false);
  const selected=eligible.filter(r=>r.task.todayPriority).length,today=root.WeekwiseToday.clock(store).date;
  const rows=eligible.filter(r=>!query||r.task.title.toLowerCase().includes(query));
  rows.sort((a,b)=>Number(!!b.task.todayPriority)-Number(!!a.task.todayPriority)||Number(!!a.task.unscheduled)-Number(!!b.task.unscheduled)||a.task.title.localeCompare(b.task.title));
  $('todayHighlightCount').textContent=selected+' / 3 highlights chosen · '+Math.min(100,rows.length)+' of '+rows.length+' matching tasks shown';
  $('todayHighlightList').innerHTML=rows.slice(0,100).map(r=>{
   const t=r.task,scheduled=!!t.allDay||(!t.unscheduled&&t.start!=null),label=scheduled?'On calendar':(t.dueDate&&t.dueDate<today?'Overdue · not scheduled':t.dueDate===today?'Due today · not scheduled':(t.listId==='inbox'?'Inbox · not scheduled':'Not scheduled'));
   const disabled=!t.todayPriority&&selected>=3;
   return '<article><div><strong>'+esc(t.title)+'</strong><small>'+esc(label)+(t.dueDate&&scheduled?' · Due '+esc(t.dueDate):'')+'</small></div><button class="btn" type="button" data-task-highlight="'+esc(t.id)+'" data-task-week="'+esc(r.week)+'" aria-pressed="'+String(!!t.todayPriority)+'"'+(disabled?' disabled title="Remove a highlight first"':'')+'>'+(t.todayPriority?'Remove highlight':'Choose highlight')+'</button></article>';
  }).join('')||'<p>No unfinished tasks match. Capture a task in Inbox to begin.</p>';
  if(active)[...$('todayHighlightList').querySelectorAll('[data-task-highlight]')].find(el=>el.dataset.taskHighlight===active)?.focus({preventScroll:true});
 }
 function openBulk(){
  if(dirty()){announce('Save your quick edit before editing several tasks.');return;}if(!selected.size)return;
  bulk={snapshot:app.snapshot(),account:app.account(),refs:[...selected.values()]};
  $('taskBulkCount').textContent=bulk.refs.length+' selected task'+(bulk.refs.length===1?'':'s');$('taskBulkTags').value='';$('taskBulkStatus').textContent='';$('taskBulkAction').value='done';
  $('taskBulkList').innerHTML=app.lists().map(list=>'<option value="'+esc(list.id)+'">'+esc(list.label)+'</option>').join('');
  bulkFields();$('taskBulkDialog').showModal();
 }
 function bulkFields(){const action=$('taskBulkAction').value;for(const [field,mode] of [['taskBulkListField','list'],['taskBulkTagsField','tags'],['taskBulkPriorityField','priority']])$(field).hidden=action!==mode;$('taskBulkTags').required=action==='tags';}
 function saveBulk(event){event.preventDefault();if(!bulk)return;
  try{const action=$('taskBulkAction').value,patch=action==='done'?{done:true}:action==='reopen'?{done:false}:action==='list'?{listId:$('taskBulkList').value}:action==='priority'?{priority:$('taskBulkPriority').value}:{addTags:[...new Set($('taskBulkTags').value.split(',').map(tag=>tag.trim().replace(/^#/,'' )).filter(Boolean))]};
   const next=root.WeekwiseTaskActions.apply(bulk.snapshot.store,bulk.refs,patch);commit(bulk.snapshot,bulk.account,next,bulk.refs.length+' tasks updated.');selected.clear();bulk=null;$('taskBulkDialog').close();render();
  }catch(error){$('taskBulkStatus').textContent=error.message;announce(error.message);}
 }
 function render(){
  if(!app)return;const nextOwner=app.account(),nextScope=app.view()+'::'+$('workspaceSearch').value;
  if(owner!==nextOwner){saveDraft();owner=nextOwner;selected.clear();selecting=false;clearEditor();bulk=null;undo=null;if($('taskBulkDialog').open)$('taskBulkDialog').close();if($('todayHighlightDialog').open)$('todayHighlightDialog').close();highlightsOwner=null;$('taskActionsStatus').textContent='';}
  if(scope!==nextScope){scope=nextScope;selected.clear();selecting=false;}
  const store=app.snapshot().store;for(const [id,ref]of selected)if(!store.weeks[ref.week]?.tasks.some(task=>task.id===ref.id))selected.delete(id);
  $('taskWorkspace').dataset.selectionMode=selecting?'on':'off';$('taskSelectMode').textContent=selecting?'Done selecting':'Select tasks';$('taskSelectMode').setAttribute('aria-pressed',String(selecting));
  $('taskBulkToolbar').hidden=!selecting;$('taskSelectedCount').textContent=selected.size+' selected';$('taskBulkReview').disabled=!selected.size;
  $('taskActionUndo').hidden=!undo;$('taskActionUndo').disabled=!!undo&&(undo.account!==nextOwner||undo.expected!==fingerprint());
  document.querySelectorAll('[data-task-select]').forEach(el=>el.checked=selected.has(key({id:el.dataset.taskSelect,week:el.dataset.taskWeek})));
  if(editing)$('taskQuickSave').disabled=editing.account!==nextOwner;
  $('taskQuickDraftNotice').hidden=!!editing||!localStorage.getItem(draftKey(nextOwner));
  renderHighlights();
 }
 function init(bridge){
  app=bridge;
  document.addEventListener('click',event=>{
   const quick=event.target.closest('[data-task-quick]');if(quick)openEditor({id:quick.dataset.taskQuick,week:quick.dataset.taskWeek});
   const star=event.target.closest('[data-task-highlight]');if(star){if(star.closest('#todayHighlightDialog')&&highlightsOwner!==app.account()){announce('Your account changed. Reopen the highlight picker.');return;}highlight({id:star.dataset.taskHighlight,week:star.dataset.taskWeek});}
   if(event.target.closest('[data-choose-highlights]')){highlightsOwner=app.account();$('todayHighlightSearch').value='';$('todayHighlightDialog').showModal();renderHighlights();}
  });
  $('taskSelectMode').onclick=()=>{selecting=!selecting;if(!selecting)selected.clear();render();};
  $('workspaceTaskList').addEventListener('change',event=>{const control=event.target.closest('[data-task-select]');if(!control)return;const ref={id:control.dataset.taskSelect,week:control.dataset.taskWeek};if(control.checked){if(selected.size>=500){control.checked=false;announce('Select up to 500 tasks at a time.');return;}selected.set(key(ref),ref);}else selected.delete(key(ref));render();});
  $('taskSelectShown').onclick=()=>{for(const control of document.querySelectorAll('#workspaceTaskList [data-task-select]:not(:disabled)')){if(selected.size>=500)break;const ref={id:control.dataset.taskSelect,week:control.dataset.taskWeek};selected.set(key(ref),ref);}render();};
  $('taskClearSelection').onclick=()=>{selected.clear();render();};$('taskBulkReview').onclick=openBulk;$('taskBulkAction').onchange=bulkFields;$('taskBulkForm').onsubmit=saveBulk;$('taskBulkCancel').onclick=()=>{$('taskBulkDialog').close();bulk=null;};
  $('taskQuickForm').onsubmit=saveEditor;$('taskQuickForm').addEventListener('input',()=>{syncTiming();saveDraft();});$('taskQuickCancel').onclick=()=>{if(dirty()&&!confirm('Discard your unsaved quick edit?'))return;try{if(editing)removeDraft(editing);clearEditor();render();}catch(error){announce(error.message);}};
  $('taskQuickRestoreDraft').onclick=()=>{try{const entry=readDraft(app.account());if(!entry)return;const task=app.snapshot().store.weeks[entry.draft.ref.week]?.tasks.find(task=>task.id===entry.draft.ref.id);if(!task||JSON.stringify(task)!==entry.draft.base)throw new Error('The original task changed. Your draft is retained; download it and review the task in the full editor.');openEditor(entry.draft.ref,true);editing.sessionId=entry.draft.sessionId;for(const id of controls){const value=entry.draft.fields[id];if($(id).type==='checkbox')$(id).checked=!!value;else $(id).value=value??'';}syncTiming();render();}catch(error){announce(error.message);}};
  $('taskQuickDiscardDraft').onclick=()=>{if(!confirm('Discard this saved quick-edit draft?'))return;localStorage.removeItem(draftKey(app.account()));render();};
  $('taskQuickDownloadDraft').onclick=()=>{const raw=localStorage.getItem(draftKey(app.account()));if(!raw)return;const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='weekwise-quick-edit-draft.json';a.click();URL.revokeObjectURL(url);};
  $('taskQuickFullEditor').onclick=()=>{if(dirty()){announce('Save or cancel this quick edit first.');return;}const ref=editing?.ref;if(ref){clearEditor();app.edit(ref.id,ref.week);}};
  $('taskActionUndo').onclick=()=>{try{if(!undo)return;app.commit(undo.expected,undo.account,undo.store);undo=null;render();announce('Last task action undone.');}catch(error){announce(error.message);render();}};
  window.addEventListener('beforeunload',event=>{if(dirty()){saveDraft();event.preventDefault();event.returnValue='';}});
  $('todayHighlightSearch').oninput=renderHighlights;$('todayHighlightClose').onclick=()=>{$('todayHighlightDialog').close();highlightsOwner=null;};
  document.addEventListener('click',event=>{const button=event.target.closest('[data-focus-length]');if(!button)return;const select=$('focusPreset');if(select.disabled||app.focusActive()){app.announce('Finish or reset the current focus session before choosing another length.');return;}select.value=button.dataset.focusLength;select.dispatchEvent(new Event('change',{bubbles:true}));});
  render();
 }
 root.WeekwiseProductivity=Object.freeze({init,render,rowSelection,rowActions,hasPending:dirty});
})(window);
