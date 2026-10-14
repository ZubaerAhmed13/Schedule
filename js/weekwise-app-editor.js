/* editor controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function currentDayHasConfiguredShift(day){
  return weekwiseRuntime.tasks.some(t=>Number(t.day)===Number(day)&&(t.workday||/^work day$/i.test(t.title||'')));
}

function updateActivityTemplateStates(){
  const day=Number(weekwiseRuntime.$('modalDay')?.value??weekwiseRuntime.mobileDay);
  document.querySelectorAll('[data-template]').forEach(button=>{
    const isWorkday=button.dataset.template==='workday';
    const disabled=isWorkday&&weekwiseRuntime.currentDayHasConfiguredShift(day)&&!weekwiseRuntime.$('editTaskId')?.value;
    button.disabled=false;
    button.setAttribute('aria-disabled',disabled?'true':'false');
    const meta=button.querySelector('.activity-template-meta');
    if(meta&&isWorkday){
      const shift=weekwiseRuntime.store.settings.shifts?.[day];
      meta.textContent=disabled?'Already scheduled today':(shift?.enabled?'Uses your shift hours':(weekwiseRuntime.store.settings.shifts||[]).some(x=>x?.enabled)?'Copies your shift hours':'Default 09:00–17:00');
    }
  });
}

function chooseActivityTemplate(key){
  const day=Number(weekwiseRuntime.$('modalDay').value);
  if(key==='workday'&&weekwiseRuntime.currentDayHasConfiguredShift(day)){
    weekwiseRuntime.showToast(`A Work day block already exists on ${weekwiseRuntime.DAY_NAMES[day]}. Choose a non-workday or edit Work day settings.`);
    return;
  }
  let preset=weekwiseRuntime.ACTIVITY_TEMPLATE_PRESETS[key]?{...weekwiseRuntime.ACTIVITY_TEMPLATE_PRESETS[key]}:null;
  if(key==='class'){
    const t=weekwiseRuntime.store.settings.classTemplate||weekwiseRuntime.defaultClassTemplate();
    preset={title:String(t.title||'Course self-study'),type:'study',duration:Math.max(15,Math.min(240,Number(t.duration)||75)),start:t.start||'13:00',note:'Single session based on your saved class template.'};
  }
  if(key==='workday'){
    const shifts=weekwiseRuntime.store.settings.shifts||[];
    const sample=shifts[day]?.enabled?shifts[day]:shifts.find(x=>x?.enabled)||{start:'09:00',end:'17:00'};
    const start=sample.start||'09:00',end=sample.end||'17:00';
    let duration=weekwiseRuntime.timeMins(end)-weekwiseRuntime.timeMins(start);if(duration<=0)duration+=1440;
    preset={title:'Work day',type:'job',duration:Math.min(1440,duration||480),start,note:'Editable one-day work block. Recurring work shifts are managed in Work day settings.'};
  }
  if(!preset)return;
  weekwiseRuntime.$('modalTitleInput').value=preset.title;
  weekwiseRuntime.$('modalCategory').value=preset.type;
  const durationSelect=weekwiseRuntime.$('modalDuration'),duration=String(preset.duration);
  if(!Array.from(durationSelect.options).some(o=>o.value===duration)){
    const option=document.createElement('option');option.value=duration;option.textContent=weekwiseRuntime.durationLabel(Number(duration));durationSelect.add(option);
  }
  durationSelect.value=duration;
  weekwiseRuntime.$('modalTime').value=preset.start;
  weekwiseRuntime.updateEndTimeFromDuration();
  weekwiseRuntime.$('modalNote').value=preset.note||'';
  weekwiseRuntime.selectedActivitySuggestion=key;weekwiseRuntime.hideActivitySuggestions();const nameInput=weekwiseRuntime.$('modalTitleInput');if(document.activeElement!==nameInput){weekwiseRuntime.suppressActivitySuggestionFocus=true;nameInput.focus({preventScroll:true});}weekwiseRuntime.hideActivitySuggestions();
}

function hideActivitySuggestions(){const list=weekwiseRuntime.$('activitySuggestions'),input=weekwiseRuntime.$('modalTitleInput');if(list)list.hidden=true;if(input)input.setAttribute('aria-expanded','false');}

function renderActivitySuggestions(query=''){
 const list=weekwiseRuntime.$('activitySuggestions'),input=weekwiseRuntime.$('modalTitleInput');if(!list||!input)return;
 const q=String(query||'').trim().toLowerCase();
 const options=WeekwisePersonal.history(weekwiseRuntime.plannerSnapshot().store,q);
 if(!options.length){weekwiseRuntime.hideActivitySuggestions();return;}
 list.innerHTML=options.map((x,i)=>'<button type="button" class="activity-suggestion" role="option" aria-selected="false" data-activity-history="'+i+'"><span>'+weekwiseRuntime.escapeHtml(x.title)+'</span><small>Previously added · '+x.count+' saved '+(x.count===1?'activity':'activities')+'</small></button>').join('');
 list.hidden=false;input.setAttribute('aria-expanded','true');
 list.querySelectorAll('[data-activity-history]').forEach(button=>{button.addEventListener('pointerdown',e=>e.preventDefault());button.addEventListener('click',()=>{input.value=options[Number(button.dataset.activityHistory)].title;weekwiseRuntime.suppressActivitySuggestionFocus=true;input.focus({preventScroll:true});weekwiseRuntime.hideActivitySuggestions();input.dispatchEvent(new Event('input',{bubbles:true}));weekwiseRuntime.hideActivitySuggestions();});});
}

function clearActivityTemplateSelection(){weekwiseRuntime.selectedActivitySuggestion=null;weekwiseRuntime.hideActivitySuggestions();}

function inferredListId(t){
  if(t&&(['inbox','career','study','work','personal','language','hobbies','other'].includes(t.listId)||(Array.isArray(weekwiseRuntime.store.customLists)&&weekwiseRuntime.store.customLists.some(list=>list.id===t.listId))))return t.listId;
  if(!t||t.unscheduled||t.start==null)return 'inbox';
  if(t.workday||/^work day$/i.test(t.title||''))return 'work';
  return ({job:'career',study:'study',language:'language',life:'personal',hobby:'hobbies',other:'other'})[t.type]||'other';
}

function defaultFolderName(listId){
 const customList=Array.isArray(weekwiseRuntime.store.customLists)?weekwiseRuntime.store.customLists.find(list=>list.id===listId):null;
 if(customList)return customList.name;
 if(['career','work'].includes(listId))return 'Career & Work';
 if(['study','language'].includes(listId))return 'Learning';
 if(['personal','hobbies','other'].includes(listId))return 'Personal';
 return 'Inbox';
}

function taskReminderTimes(task){
 const source=Array.isArray(task?.reminderTimes)?task.reminderTimes:(task?.reminderAt?[task.reminderAt]:[]);
 return [...new Set(source.map(value=>String(value||'').trim()).filter(Boolean))].slice(0,5);
}

function updateModalScheduleVisibility(){
  const noSchedule=!!weekwiseRuntime.$('modalNoSchedule')?.checked,allDay=!!weekwiseRuntime.$('modalAllDay')?.checked;
  const fields=weekwiseRuntime.$('taskSchedulingFields');if(fields)fields.hidden=noSchedule||allDay;
  ['modalTime','modalEndTime','modalDuration'].forEach(id=>{const el=weekwiseRuntime.$(id);if(el)el.required=!noSchedule&&!allDay;});
  if(noSchedule||allDay){weekwiseRuntime.$('modalEndTime').setCustomValidity('');weekwiseRuntime.$('modalTime').setCustomValidity('');}
}

function taskModalFingerprint(){
  const form=weekwiseRuntime.$('taskForm');
  if(!form)return '';
  return JSON.stringify(Array.from(form.elements)
    .filter(el=>el.id&&['INPUT','SELECT','TEXTAREA'].includes(el.tagName))
    .map(el=>[el.id,el.type==='checkbox'||el.type==='radio'?el.checked:el.value]));
}

function draftFields(){return Object.fromEntries([...weekwiseRuntime.$('taskForm').elements].filter(el=>WeekwiseDrafts.FIELDS.has(el.id)).map(el=>[el.id,el.type==='checkbox'?el.checked:el.value]));}

function checkpointEditorDraft(){if(!weekwiseRuntime.editorSession||!weekwiseRuntime.$('taskModal').classList.contains('show')||weekwiseRuntime.editorSession.owner!==weekwiseRuntime.currentDataOwner||weekwiseRuntime.taskModalFingerprint()===weekwiseRuntime.taskModalInitialFingerprint)return;WeekwiseDrafts.save(localStorage,{version:2,...weekwiseRuntime.editorSession,fields:weekwiseRuntime.draftFields(),savedAt:new Date().toISOString()});weekwiseRuntime.renderDraftNotice();}

function renderDraftNotice(){const result=WeekwiseDrafts.read(localStorage,weekwiseRuntime.currentDataOwner);weekwiseRuntime.$('editorDraftNotice').hidden=!result;if(!result)return;weekwiseRuntime.$('editorDraftTitle').textContent=result.error?'Editor draft needs recovery':'Unsaved editor draft';weekwiseRuntime.$('editorDraftDescription').textContent=result.error?'The original draft is preserved. Download it before discarding or recovering it.':(result.draft.fields.modalTitleInput||'Untitled task')+' · saved on this device';weekwiseRuntime.$('restoreEditorDraft').disabled=!!result.error;}

function retireEditorDraft(){const result=WeekwiseDrafts.read(localStorage,weekwiseRuntime.currentDataOwner);if(result?.draft&&result.draft.sessionId===weekwiseRuntime.editorSession?.sessionId){WeekwiseDrafts.discard(localStorage,weekwiseRuntime.currentDataOwner,result.raw);weekwiseRuntime.renderDraftNotice();}}

function restoreEditorDraft(){try{const result=WeekwiseDrafts.read(localStorage,weekwiseRuntime.currentDataOwner);if(!result||result.error)throw new Error(result?.error||'No saved editor draft.');if(weekwiseRuntime.$('taskModal').classList.contains('show')&&weekwiseRuntime.taskModalFingerprint()!==weekwiseRuntime.taskModalInitialFingerprint){weekwiseRuntime.showToast('Save or close your current editor before restoring a draft.');return;}const draft=result.draft,id=draft.fields.editTaskId||'',record=id?weekwiseRuntime.workspaceRecords().find(r=>r.task.id===id&&r.week===draft.week):null,same=record&&draft.base===JSON.stringify(record.task);if(same){weekwiseRuntime.openWorkspaceRecord(id,draft.week);}else weekwiseRuntime.openTaskModal(null,Number(draft.fields.modalDay)||weekwiseRuntime.now.getDay(),null,'inbox');const fields={...draft.fields};if(!same){fields.editTaskId='';fields.modalNoSchedule=true;fields.modalAllDay=false;fields.modalRecurrence='none';fields.modalRecurrenceScope='occurrence';}for(const [name,value]of Object.entries(fields)){const el=weekwiseRuntime.$(name);if(!el||!weekwiseRuntime.$('taskForm').contains(el))continue;if(el.type==='checkbox')el.checked=!!value;else if(el.tagName==='SELECT'){if(![...el.options].some(o=>o.value===value)){if(name!=='modalDuration'||!/^\d+$/.test(value)||Number(value)>1440)continue;const option=document.createElement('option');option.value=value;option.textContent=weekwiseRuntime.durationLabel(Number(value));el.add(option);}el.value=value;}else el.value=value;}weekwiseRuntime.editorSession={owner:weekwiseRuntime.currentDataOwner,sessionId:draft.sessionId,week:weekwiseRuntime.currentWeek,base:same?draft.base:null};weekwiseRuntime.updateModalScheduleVisibility();weekwiseRuntime.updateRecurringBulkVisibility();WeekwiseInterface.prepareEditor();weekwiseRuntime.hideActivitySuggestions();weekwiseRuntime.showToast(same?'Draft restored to its original activity. Save when ready.':id?'The original activity changed. Recovered as a new unscheduled draft; review before saving.':'Draft restored. Review and save when ready.');weekwiseRuntime.$('modalTitleInput').focus({preventScroll:true});}catch(error){weekwiseRuntime.showToast(error.message);}}

function openTaskModal(id=null,day=weekwiseRuntime.mobileDay,startAt=null,defaultListId=null){
  weekwiseRuntime.pendingCalendarSlot=null;
  const modal=weekwiseRuntime.$('taskModal');const t=id?weekwiseRuntime.tasks.find(t=>t.id===id):null;
  weekwiseRuntime.editorSession={owner:weekwiseRuntime.currentDataOwner,sessionId:weekwiseRuntime.uid(),week:weekwiseRuntime.currentWeek,base:t?JSON.stringify(t):null};
  if(id&&!t){weekwiseRuntime.showToast('This activity is no longer available. It may have been moved or deleted. Refresh the list and try again.');return;}
  weekwiseRuntime.renderTaskTemplateOptions();weekwiseRuntime.$('taskTemplateSelect').value='';weekwiseRuntime.$('deleteTaskTemplateBtn').disabled=true;
  weekwiseRuntime.$('editTaskId').value=t?.id||'';if(!t)weekwiseRuntime.clearActivityTemplateSelection();else weekwiseRuntime.hideActivitySuggestions();weekwiseRuntime.$('modalTitle').textContent=t?'Edit task':'Add a task';
  weekwiseRuntime.$('modalDescription').textContent=t?'To move this activity, choose a new day and start time, then tap Save changes. If the time is busy, Weekwise will choose the nearest available slot.':'Choose the day, start time, and duration. Enter HH:MM (for example, 17:30), or type 1730 and it will format automatically.';
  weekwiseRuntime.$('modalDescription').textContent+=' Clock fields use '+(weekwiseRuntime.store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone)+'.';if(t?.recurrenceScheduleReview){const review=t.recurrenceScheduleReview;weekwiseRuntime.$('modalDescription').textContent+=' Recurring time needs review: '+(Number.isFinite(review.preferred)?weekwiseRuntime.minsTime(review.preferred)+' on '+review.date+' in '+review.zone+'. ':'')+(review.reason||'Choose reviewed hours.');}
  weekwiseRuntime.$('modalTitleInput').value=t?.title||'';weekwiseRuntime.$('modalDay').value=String(t?.day??day);weekwiseRuntime.$('modalCategory').value=t?.type||'life';
  const folderView=weekwiseRuntime.workspaceView.startsWith('folder:'),selectedFolder=folderView?weekwiseRuntime.workspaceView.slice(7):'';
  const folderExisting=folderView?weekwiseRuntime.workspaceRecords().find(r=>(r.task.folderName||weekwiseRuntime.defaultFolderName(r.listId))===selectedFolder):null;
  weekwiseRuntime.$('modalListId').value=t?weekwiseRuntime.inferredListId(t):(defaultListId||(folderExisting?.listId)||'career');
  if(!t&&!defaultListId&&!folderView)weekwiseRuntime.$('modalListId').value=({job:'career',study:'study',language:'language',life:'personal',hobby:'hobbies',other:'other'})[weekwiseRuntime.$('modalCategory').value]||'career';
  weekwiseRuntime.$('modalFolder').value=t?.folderName||(folderView?selectedFolder:weekwiseRuntime.defaultFolderName(weekwiseRuntime.$('modalListId').value));
  weekwiseRuntime.$('modalSection').value=t?.sectionName||'';
  weekwiseRuntime.$('modalSchedulingMode').value=t?.schedulingMode||((t?.fixed||t?.workday||t?.type==='fixed')?'fixed':'flexible');
  weekwiseRuntime.$('modalPriority').value=t?.priority||'none';weekwiseRuntime.$('modalStatus').value=t?.done?'done':(t?.status||'todo');weekwiseRuntime.$('modalDurationEstimate').value=t?.estimatedDurationMinutes??'';weekwiseRuntime.$('modalRequiresCompletion').checked=t?.requiresCompletion!==false;weekwiseRuntime.$('modalTodayPriority').checked=!!t?.todayPriority;
  weekwiseRuntime.$('modalFocusEstimate').value=t?.focusEstimateMinutes?String(t.focusEstimateMinutes):'';weekwiseRuntime.$('modalImportance').value=t?.importance||'unclassified';weekwiseRuntime.$('modalUrgency').value=t?.urgency||'unclassified';weekwiseRuntime.$('modalRecurrenceScope').value='occurrence';weekwiseRuntime.$('modalRecurrenceScope').disabled=!t?.seriesId;
  weekwiseRuntime.$('modalRecurrence').value=t?.recurrence||'none';weekwiseRuntime.$('modalRecurringBulkMetadata').checked=false;weekwiseRuntime.updateRecurringBulkVisibility();weekwiseRuntime.$('modalDueDate').value=t?.dueDate||'';const existingReminderTimes=weekwiseRuntime.taskReminderTimes(t);
  weekwiseRuntime.$('modalReminderAt').value=existingReminderTimes[0]?WeekwiseZoneConversion.reminderField(t,existingReminderTimes[0],weekwiseRuntime.store.settings.timeZone):'';
  [2,3,4,5].forEach((n,index)=>{const input=weekwiseRuntime.$('modalReminderAt'+n);if(input)input.value=existingReminderTimes[index+1]?WeekwiseZoneConversion.reminderField(t,existingReminderTimes[index+1],weekwiseRuntime.store.settings.timeZone):'';});
  const extraReminderDetails=document.querySelector('.task-extra-reminders');if(extraReminderDetails)extraReminderDetails.open=existingReminderTimes.length>1;
  weekwiseRuntime.$('modalTags').value=Array.isArray(t?.tags)?t.tags.join(', '):String(t?.tags||'');
  if(!t&&weekwiseRuntime.workspaceView.startsWith('tag:'))weekwiseRuntime.$('modalTags').value=weekwiseRuntime.workspaceView.slice(4);
  weekwiseRuntime.$('modalSubtasks').value=Array.isArray(t?.subtasks)?t.subtasks.map(s=>typeof s==='string'?s:s.title||'').join('\n'):'';
  weekwiseRuntime.$('modalAllDay').checked=!!t?.allDay;
  weekwiseRuntime.$('modalNoSchedule').checked=!!(t&&(t.unscheduled||t.start==null)&&!t.allDay)||(!t&&defaultListId==='inbox');
  const durationSelect=weekwiseRuntime.$('modalDuration'),duration=String(t?.duration||30);
  if(!Array.from(durationSelect.options).some(o=>o.value===duration)){const option=document.createElement('option');option.value=duration;option.textContent=weekwiseRuntime.durationLabel(Number(duration));durationSelect.add(option);}
  durationSelect.value=duration;const chosenStart=t?.start??(Number.isFinite(t?.recurrenceScheduleReview?.preferred)?t.recurrenceScheduleReview.preferred:(startAt===null||startAt===undefined?weekwiseRuntime.nextQuarterHour():startAt));weekwiseRuntime.$('modalTime').value=weekwiseRuntime.minsTime(chosenStart);weekwiseRuntime.updateEndTimeFromDuration();weekwiseRuntime.$('modalNote').value=t?.note||'';
  weekwiseRuntime.$('copyScheduleBtn').hidden=!t;weekwiseRuntime.$('saveTaskBtn').textContent=t?'Save changes':'Add task';weekwiseRuntime.$('deleteTaskBtn').style.display=t&&!t.fixed?'inline-flex':'none';weekwiseRuntime.$('archiveTaskBtn').hidden=!t||!!t.fixed;weekwiseRuntime.$('seriesScheduleOpen').hidden=!t?.seriesId||!!t.fixed;
  weekwiseRuntime.updateModalScheduleVisibility();
  WeekwiseInterface.prepareEditor();
  weekwiseRuntime.taskModalInitialFingerprint=weekwiseRuntime.taskModalFingerprint();
  modal.classList.add('show');
  (()=>{
    const titleInput=weekwiseRuntime.$('modalTitleInput');
    if(t){
      weekwiseRuntime.hideActivitySuggestions();
      if(document.activeElement!==titleInput){
        weekwiseRuntime.suppressActivitySuggestionFocus=true;
        titleInput.focus({preventScroll:true});
      }else{
        weekwiseRuntime.suppressActivitySuggestionFocus=false;
      }
      weekwiseRuntime.hideActivitySuggestions();
    }else{
      titleInput.focus();
    }
  })();
}

function closeTaskModal(force=false){
  const modal=weekwiseRuntime.$('taskModal');
  if(!modal||!modal.classList.contains('show'))return;
  if(!force&&weekwiseRuntime.taskModalFingerprint()!==weekwiseRuntime.taskModalInitialFingerprint){
    if(!window.confirm('Discard your unsaved changes?'))return;
    try{weekwiseRuntime.retireEditorDraft();}catch(error){weekwiseRuntime.showToast(error.message);return;}
  }
  modal.classList.remove('show');
  weekwiseRuntime.taskModalInitialFingerprint='';
  weekwiseRuntime.$('editTaskId').value='';
  weekwiseRuntime.hideActivitySuggestions();
}

function updateRecurringBulkVisibility(){const field=weekwiseRuntime.$('recurringBulkField'),checkbox=weekwiseRuntime.$('modalRecurringBulkMetadata');if(!field||!checkbox)return;const record=weekwiseRuntime.tasks.find(t=>t.id===weekwiseRuntime.$('editTaskId').value);const visible=!!record?.seriesId&&weekwiseRuntime.$('modalRecurrence').value!=='none'&&weekwiseRuntime.$('modalRecurrenceScope').value!=='occurrence';field.hidden=!visible;if(!visible)checkbox.checked=false;}

function saveModalTask(e){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
  e.preventDefault();
  const id=weekwiseRuntime.$('editTaskId').value,title=weekwiseRuntime.$('modalTitleInput').value.trim();if(!title)return;
  if(id){
    const existing=weekwiseRuntime.tasks.find(t=>t.id===id);
    if(!existing){weekwiseRuntime.showToast('This activity is no longer available. Refresh the current view before saving.');return;}
    if(existing.fixed){weekwiseRuntime.showToast('This time block is managed by Work day & weekly settings; no changes were saved.');return;}
  }
  const schedulingMode=weekwiseRuntime.$('modalSchedulingMode').value;
  const noSchedule=!!weekwiseRuntime.$('modalNoSchedule').checked,allDay=!!weekwiseRuntime.$('modalAllDay').checked&&!noSchedule;
  let preferred=null,duration=Math.max(10,Number(weekwiseRuntime.$('modalDuration').value)||30);
  if(!noSchedule&&!allDay){
    if(!weekwiseRuntime.validateTimeFields(['modalTime']))return;
    if(!weekwiseRuntime.normalizeEndTimeField(weekwiseRuntime.$('modalEndTime'))){weekwiseRuntime.$('modalEndTime').reportValidity?.();weekwiseRuntime.$('modalEndTime').focus();return;}
    const start=weekwiseRuntime.timeMins(weekwiseRuntime.$('modalTime').value||'10:00'),end=weekwiseRuntime.timeMins(weekwiseRuntime.$('modalEndTime').value);
    try{duration=WeekwiseTaskSchedule.duration(start,end,weekwiseRuntime.$('modalEndNextDay').checked);}catch(error){weekwiseRuntime.$('modalEndTime').setCustomValidity(error.message);weekwiseRuntime.$('modalEndTime').reportValidity?.();weekwiseRuntime.$('modalEndTime').focus();return;}
    weekwiseRuntime.$('modalEndTime').setCustomValidity('');preferred=start;
  }
  const day=Number(weekwiseRuntime.$('modalDay').value),type=weekwiseRuntime.$('modalCategory').value,note=weekwiseRuntime.$('modalNote').value.trim(),recurrence=weekwiseRuntime.$('modalRecurrence').value;
  const occurrenceDate=weekwiseRuntime.dateKey(weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,day));
  const listId=weekwiseRuntime.$('modalListId').value,folderName=weekwiseRuntime.$('modalFolder').value.trim()||weekwiseRuntime.defaultFolderName(weekwiseRuntime.$('modalListId').value),sectionName=weekwiseRuntime.$('modalSection').value.trim(),priority=weekwiseRuntime.$('modalPriority').value,status=weekwiseRuntime.$('modalStatus').value,importance=weekwiseRuntime.$('modalImportance').value,urgency=weekwiseRuntime.$('modalUrgency').value,dueDate=weekwiseRuntime.$('modalDueDate').value||null,reminderInputs=[1,2,3,4,5].map(n=>weekwiseRuntime.$('modalReminderAt'+(n===1?'':n)).value||'');
  let reminderFields;try{reminderFields=WeekwiseZoneConversion.readReminderFields(id?weekwiseRuntime.tasks.find(t=>t.id===id):{},reminderInputs,weekwiseRuntime.store.settings.timeZone);}catch(error){weekwiseRuntime.showToast('Reminder needs review: '+error.message);return;}const reminderTimes=reminderFields.values,reminderAt=reminderTimes[0]||null;
  const focusEstimateRaw=weekwiseRuntime.$('modalFocusEstimate').value.trim();
  const focusEstimateMinutes=focusEstimateRaw?Math.max(5,Math.min(1440,Math.round(Number(focusEstimateRaw)/5)*5)):null;
  const estimatedDurationMinutes=weekwiseRuntime.$('modalDurationEstimate').value?Number(weekwiseRuntime.$('modalDurationEstimate').value):null,requiresCompletion=weekwiseRuntime.$('modalRequiresCompletion').checked,todayPriority=weekwiseRuntime.$('modalTodayPriority').checked;
  const tags=[...new Set(weekwiseRuntime.$('modalTags').value.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean).slice(0,20))];
  const attachmentParse=weekwiseRuntime.parseTaskAttachmentInput(weekwiseRuntime.$('modalAttachments').value);
  if(attachmentParse.invalid.length){weekwiseRuntime.showToast('Use complete http:// or https:// URLs for attachments.');weekwiseRuntime.$('modalAttachments').focus();return;}
  const attachments=attachmentParse.valid;
  const subtasks=weekwiseRuntime.$('modalSubtasks').value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,40).map(title=>({id:weekwiseRuntime.uid(),title,done:false}));
  if(!id&&!noSchedule&&title.toLowerCase()==='work day'&&weekwiseRuntime.currentDayHasConfiguredShift(day)){weekwiseRuntime.showToast(`A Work day block is already scheduled on ${weekwiseRuntime.DAY_NAMES[day]}. Choose another day or use Work day settings.`);weekwiseRuntime.updateActivityTemplateStates();return;}
  let actualStart=null,seriesId=null,templateFields={title,type,schedulingMode,estimatedDurationMinutes,requiresCompletion,duration,start:preferred,allDay,note,recurrence,listId,folderName,sectionName,priority,status,focusEstimateMinutes,importance,urgency,dueDate,reminderAt,reminderTimes,tags,subtasks,attachments};
  const original=id?weekwiseRuntime.tasks.find(t=>t.id===id):null;
  let editorSlot=null;if(!noSchedule&&!allDay){try{editorSlot=WeekwiseTaskSchedule.placement(weekwiseRuntime.plannerSnapshot().store,{week:weekwiseRuntime.currentWeek,id:id||null,day,start:preferred,duration,exact:weekwiseRuntime.pendingCalendarSlot});}catch(error){weekwiseRuntime.showToast(error.message);return;}}
  if(original?.seriesId&&weekwiseRuntime.$('modalRecurringBulkMetadata').checked&&recurrence!=='none'&&weekwiseRuntime.$('modalRecurrenceScope').value!=='occurrence'){
    const snapshot=JSON.parse(JSON.stringify(weekwiseRuntime.store));
    snapshot.weeks[weekwiseRuntime.currentWeek]={...(snapshot.weeks[weekwiseRuntime.currentWeek]||{}),tasks:JSON.parse(JSON.stringify(weekwiseRuntime.tasks))};
    const metadata={title,note,type,listId,folderName,sectionName,priority,importance,urgency,estimatedDurationMinutes,focusEstimateMinutes,requiresCompletion,tags,attachments};
    const fromDate=original.occurrenceDate||weekwiseRuntime.dateKey(weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,original.day));
    let preview;
    try{preview=WeekwiseRecurringBulk.preview(snapshot,{seriesId:original.seriesId,fromDate,excludeId:id,fields:metadata});}
    catch(error){weekwiseRuntime.showToast(error.message);return;}
    if(preview.changes.length){
      const skipped=preview.skipped.completed+preview.skipped.customized+preview.skipped.other;
      if(!confirm('Update descriptive details on '+preview.changes.length+' unchanged future recurring '+(preview.changes.length===1?'activity':'activities')+'? '+skipped+' protected or completed occurrences will be left untouched. Existing scheduled times, due dates, reminders, IDs and completion history will not change. Cancel keeps the editor open.'))return;
      try{
        const staged=WeekwiseRecurringBulk.apply(snapshot,preview);
        weekwiseRuntime.store=staged;
        weekwiseRuntime.tasks=JSON.parse(JSON.stringify(staged.weeks[weekwiseRuntime.currentWeek]?.tasks||[]));
      }catch(error){weekwiseRuntime.showToast(error.message);return;}
    }else if(preview.skipped.completed+preview.skipped.customized>0)weekwiseRuntime.showToast('No unchanged future occurrences can be updated. Existing edits and history are protected.');
  }
  if(id){
    const t=weekwiseRuntime.tasks.find(x=>x.id===id);
    if(t&&!t.fixed){
      const oldSeriesId=t.seriesId||null;
      t.title=title;t.day=day;t.type=type;t.schedulingMode=schedulingMode;t.duration=duration;t.note=note;t.listId=listId;t.folderName=folderName;t.sectionName=sectionName;t.priority=priority;t.status=status;t.done=status==='done';t.focusEstimateMinutes=focusEstimateMinutes;t.estimatedDurationMinutes=estimatedDurationMinutes;t.requiresCompletion=requiresCompletion;t.todayPriority=todayPriority;t.importance=importance;t.urgency=urgency;t.dueDate=dueDate;t.reminderInstants=reminderFields.instants;t.reminderTimes=reminderTimes;t.reminderAt=reminderAt;t.reminderNotifiedTimes=(Array.isArray(t.reminderNotifiedTimes)?t.reminderNotifiedTimes:[]).filter(value=>reminderTimes.includes(value));if(t.reminderNotifiedAt&&reminderTimes.includes(t.reminderNotifiedAt)&&!t.reminderNotifiedTimes.includes(t.reminderNotifiedAt))t.reminderNotifiedTimes.push(t.reminderNotifiedAt);t.reminderNotifiedAt=t.reminderNotifiedAt===reminderAt?reminderAt:null;t.tags=tags;t.attachments=attachments;t.allDay=allDay;t.allDayDate=allDay?occurrenceDate:null;
      const prior=Array.isArray(t.subtasks)?t.subtasks:[];
      t.subtasks=subtasks.map(s=>{const old=prior.find(p=>typeof p==='object'&&p.title===s.title);return old?{...old,...s,id:old.id||s.id,done:!!old.done}:{...s};});
      t.start=noSchedule||allDay?null:editorSlot.start;t.scheduleInstant=editorSlot?.scheduleInstant;if(editorSlot?.start!=null||allDay||recurrence==='none')delete t.recurrenceScheduleReview;t.unscheduled=noSchedule||(!allDay&&t.start===null);actualStart=t.start;
      if(recurrence==='none'){
        if(oldSeriesId){if(weekwiseRuntime.$('modalRecurrenceScope').value==='occurrence'){const rule=weekwiseRuntime.store.recurringTemplates.find(r=>r.id===oldSeriesId);if(rule)rule.excludedDates=[...new Set([...(rule.excludedDates||[]),t.occurrenceDate||occurrenceDate])];t.seriesId=null;t.recurrence='none';t.occurrenceDate=null;}else weekwiseRuntime.stopRecurringSeries(t,occurrenceDate,weekwiseRuntime.$('modalRecurrenceScope').value);}
        else{t.recurrence='none';t.seriesId=null;t.occurrenceDate=null;}
      }else{
        seriesId=oldSeriesId||weekwiseRuntime.uid();t.seriesId=seriesId;t.occurrenceDate=occurrenceDate;t.recurrence=recurrence;
        if(oldSeriesId&&weekwiseRuntime.$('modalRecurrenceScope').value==='occurrence'){t.recurrenceOverride=true;}else{const anchor=weekwiseRuntime.$('modalRecurrenceScope').value==='series'?(weekwiseRuntime.store.recurringTemplates.find(r=>r.id===seriesId)?.startDate||occurrenceDate):occurrenceDate;weekwiseRuntime.upsertRecurringTemplate(seriesId,anchor,templateFields);}
      }
    }
  }else{
    weekwiseRuntime.createTask(day,title,type,duration,null,{min:0,max:1440,custom:true,note});
    const t=weekwiseRuntime.tasks[weekwiseRuntime.tasks.length-1];t.start=editorSlot?.start??null;t.scheduleInstant=editorSlot?.scheduleInstant;t.schedulingMode=schedulingMode;t.unscheduled=noSchedule||(!allDay&&t.start===null);t.allDay=allDay;t.allDayDate=allDay?occurrenceDate:null;t.listId=listId;t.folderName=folderName;t.sectionName=sectionName;t.priority=priority;t.status=status;t.done=status==='done';t.focusEstimateMinutes=focusEstimateMinutes;t.estimatedDurationMinutes=estimatedDurationMinutes;t.requiresCompletion=requiresCompletion;t.todayPriority=todayPriority;t.importance=importance;t.urgency=urgency;t.dueDate=dueDate;t.reminderInstants=reminderFields.instants;t.reminderTimes=reminderTimes;t.reminderAt=reminderAt;t.reminderNotifiedAt=null;t.reminderNotifiedTimes=[];t.tags=tags;t.attachments=attachments;t.subtasks=subtasks;actualStart=t.start;
    if(weekwiseRuntime.pendingCalendarSlot&&weekwiseRuntime.pendingCalendarSlot.week===weekwiseRuntime.currentWeek&&weekwiseRuntime.pendingCalendarSlot.day===day&&weekwiseRuntime.pendingCalendarSlot.start===t.start&&weekwiseRuntime.pendingCalendarSlot.duration===t.duration&&!noSchedule&&!allDay)t.scheduleInstant=weekwiseRuntime.pendingCalendarSlot.scheduleInstant;
    if(recurrence!=='none'){
      seriesId=weekwiseRuntime.uid();t.seriesId=seriesId;t.occurrenceDate=occurrenceDate;t.recurrence=recurrence;
      weekwiseRuntime.upsertRecurringTemplate(seriesId,occurrenceDate,templateFields);
    }else t.recurrence='none';
  }
  if(seriesId||recurrence!=='none')weekwiseRuntime.materializeRecurringRange(weekwiseRuntime.parseKey(weekwiseRuntime.currentWeek),weekwiseRuntime.parseKey(weekwiseRuntime.addDaysToKey(weekwiseRuntime.currentWeek,89)));
  weekwiseRuntime.saveCurrent();let retainedDraftMessage='';try{weekwiseRuntime.retireEditorDraft();}catch(error){retainedDraftMessage='Task saved; its draft is retained: '+error.message;}weekwiseRuntime.closeTaskModal(true);weekwiseRuntime.renderAll();
  if(retainedDraftMessage){weekwiseRuntime.showToast(retainedDraftMessage);return;}
  if(recurrence!=='none')weekwiseRuntime.showToast('Task saved · repeating '+recurrence+'.');
  else if(allDay)weekwiseRuntime.showToast('All-day event saved for '+weekwiseRuntime.fmtDate(weekwiseRuntime.dayDate(weekwiseRuntime.currentWeek,day),{weekday:'short',day:'numeric',month:'short'})+'.');
  else if(noSchedule)weekwiseRuntime.showToast('Task saved to '+(listId==='inbox'?'Inbox':'your list')+'.');
  else if(actualStart===null)weekwiseRuntime.showToast('No free slot on that day; task is in Needs a time.');
  else if(actualStart!==preferred)weekwiseRuntime.showToast(`That time was busy; scheduled at ${weekwiseRuntime.minsTime(actualStart)} instead.`);
  else weekwiseRuntime.showToast(id?`Task updated · ${weekwiseRuntime.DAY_SHORT[day]} ${weekwiseRuntime.minsTime(actualStart)}`:`Task added · ${weekwiseRuntime.DAY_SHORT[day]} ${weekwiseRuntime.minsTime(actualStart)}`);
}
return Object.freeze({currentDayHasConfiguredShift,updateActivityTemplateStates,chooseActivityTemplate,hideActivitySuggestions,renderActivitySuggestions,clearActivityTemplateSelection,inferredListId,defaultFolderName,taskReminderTimes,updateModalScheduleVisibility,taskModalFingerprint,draftFields,checkpointEditorDraft,renderDraftNotice,retireEditorDraft,restoreEditorDraft,openTaskModal,closeTaskModal,updateRecurringBulkVisibility,saveModalTask});
}
root.WeekwiseAppEditor=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
