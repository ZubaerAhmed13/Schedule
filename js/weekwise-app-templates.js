/* templates controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function templateDayChecks(selected){return weekwiseRuntime.DAY_NAMES.map((day,i)=>`<label class="template-day"><input type="checkbox" data-template-day="${i}" ${selected.includes(i)?'checked':''}><span>${day}</span></label>`).join('');}

function openTemplateEditor(kind){
  const fields=weekwiseRuntime.$('templateFields');if(!fields)return;
  weekwiseRuntime.$('templateModalTitle').textContent=kind==='workday'?'Work day template':'Course / class template';
  weekwiseRuntime.$('templateModalDescription').textContent=kind==='workday'?'Choose the days you work and set each shift’s start and end time.':'Edit the reusable class template used to plan your weekly coursework sessions.';
  if(kind==='workday'){
    const shifts=weekwiseRuntime.store.settings.shifts||weekwiseRuntime.defaultSettings().shifts;
    fields.innerHTML=`<div class="template-shifts">${weekwiseRuntime.DAY_NAMES.map((day,i)=>{const s=shifts[i]||{enabled:false,start:'09:00',end:'17:00'};return `<div class="template-shift"><label class="template-shift-enable"><input type="checkbox" data-template-shift-enabled="${i}" ${s.enabled?'checked':''}><span>${day}</span></label><div class="field"><label for="templateShiftStart${i}">Start</label><input id="templateShiftStart${i}" class="time24" data-time24 data-template-shift-start="${i}" inputmode="numeric" maxlength="5" value="${weekwiseRuntime.escapeHtml(s.start||'09:00')}" aria-label="${day} work start" placeholder="09:00"></div><div class="field"><label for="templateShiftEnd${i}">End</label><input id="templateShiftEnd${i}" class="time24" data-time24 data-template-shift-end="${i}" inputmode="numeric" maxlength="5" value="${weekwiseRuntime.escapeHtml(s.end||'17:00')}" aria-label="${day} work end" placeholder="17:00"></div></div>`;}).join('')}</div><p class="template-help">Enable only your actual workdays. Times use the 24-hour clock. Save updates the reusable template. Add workdays individually from Add an activity when ready.</p>`;
  }else{
    const t=weekwiseRuntime.store.settings.classTemplate||weekwiseRuntime.defaultClassTemplate();
    const durations=[30,35,45,60,75,90,120,150,180,240];
    fields.innerHTML=`<div class="template-fields-grid"><div class="field"><label for="classTemplateTitle">Class / activity name</label><input id="classTemplateTitle" maxlength="100" required value="${weekwiseRuntime.escapeHtml(t.title||'Master’s coursework self-study')}" placeholder="e.g. Course self-study"></div><div class="field"><label for="classTemplateDuration">Session duration</label><select id="classTemplateDuration">${durations.map(d=>`<option value="${d}" ${Number(t.duration||75)===d?'selected':''}>${weekwiseRuntime.durationLabel(d)}</option>`).join('')}</select></div><div class="field"><label for="classTemplateStart">Preferred start time</label><input id="classTemplateStart" class="time24" data-time24 inputmode="numeric" maxlength="5" required value="${weekwiseRuntime.escapeHtml(t.start||'13:00')}" placeholder="13:00"></div></div><div class="field" style="margin-top:16px"><label>Repeat on these days</label><div class="template-days">${weekwiseRuntime.templateDayChecks((Array.isArray(t.days)?t.days:[1,3,5,0]).map(Number))}</div></div><p class="template-help">This saves a reusable template only. Add each class from Add an activity when you are ready.</p>`;
  }
  weekwiseRuntime.$('templateModal').hidden=false;weekwiseRuntime.$('templateModal').classList.add('show');weekwiseRuntime.wireTime24Fields();setTimeout(()=>{const first=fields.querySelector('input:not([type=checkbox])');(first||weekwiseRuntime.$('closeTemplate')).focus();},25);
}

function closeTemplateEditor(){ weekwiseRuntime.$('templateModal').classList.remove('show');weekwiseRuntime.$('templateModal').hidden=true; }

function saveTemplateEditor(e){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
  e.preventDefault();
  const currentKind=weekwiseRuntime.$('templateModalTitle').textContent.startsWith('Work day')?'workday':'class';
  if(currentKind==='workday'){
    const shifts=weekwiseRuntime.DAY_NAMES.map((_,i)=>({enabled:!!document.querySelector(`[data-template-shift-enabled="${i}"]`)?.checked,start:document.querySelector(`[data-template-shift-start="${i}"]`)?.value||'09:00',end:document.querySelector(`[data-template-shift-end="${i}"]`)?.value||'17:00'}));
    for(let i=0;i<7;i++){if(!shifts[i].enabled)continue;const start=document.querySelector(`[data-template-shift-start="${i}"]`),end=document.querySelector(`[data-template-shift-end="${i}"]`);if(!weekwiseRuntime.normalizeTimeField(start)||!weekwiseRuntime.normalizeTimeField(end)){(start.validity.valid?end:start).reportValidity?.();(start.validity.valid?end:start).focus();return;}shifts[i].start=start.value;shifts[i].end=end.value;if(weekwiseRuntime.timeMins(shifts[i].start)===weekwiseRuntime.timeMins(shifts[i].end)){weekwiseRuntime.showToast(`${weekwiseRuntime.DAY_NAMES[i]} work shift needs a non-zero duration.`);return;}}
    weekwiseRuntime.store.settings.shifts=shifts;
  }else{
    if(!weekwiseRuntime.validateTimeFields(['classTemplateStart']))return;
    const title=weekwiseRuntime.$('classTemplateTitle').value.trim();const days=Array.from(document.querySelectorAll('[data-template-day]:checked')).map(el=>Number(el.dataset.templateDay));
    if(!title){weekwiseRuntime.$('classTemplateTitle').focus();return;}if(!days.length){weekwiseRuntime.showToast('Choose at least one class day.');return;}
    weekwiseRuntime.store.settings.classTemplate={title,days,duration:Number(weekwiseRuntime.$('classTemplateDuration').value)||75,start:weekwiseRuntime.$('classTemplateStart').value||'13:00'};
  }
  weekwiseRuntime.saveStore();weekwiseRuntime.saveCurrent();weekwiseRuntime.syncSettingsForm();weekwiseRuntime.renderAll();weekwiseRuntime.closeTemplateEditor();weekwiseRuntime.showToast(currentKind==='workday'?'Work day template saved. Add shifts when ready.':'Class template saved. Add classes when ready.');
}

function updateCalendarVisibility(){
 ['calendarToolbar','mobileDayPicker','mobileHelp','daysGrid','unscheduledBox'].forEach(id=>{const el=weekwiseRuntime.$(id);if(el)el.hidden=weekwiseRuntime.workspaceView!=='calendar'||(['mobileDayPicker','mobileHelp'].includes(id)&&(!['day','week'].includes(weekwiseRuntime.calendarView)||weekwiseRuntime.$('daysGrid').dataset.rangeActive==='true'));});
}

function readModalTaskTemplate(){
 return {title:weekwiseRuntime.$('modalTitleInput').value.trim(),type:weekwiseRuntime.$('modalCategory').value,listId:weekwiseRuntime.$('modalListId').value,
  folderName:weekwiseRuntime.$('modalFolder').value.trim(),sectionName:weekwiseRuntime.$('modalSection').value.trim(),priority:weekwiseRuntime.$('modalPriority').value,status:weekwiseRuntime.$('modalStatus').value,
  schedulingMode:weekwiseRuntime.$('modalSchedulingMode').value,importance:weekwiseRuntime.$('modalImportance').value,urgency:weekwiseRuntime.$('modalUrgency').value,duration:Math.max(10,Number(weekwiseRuntime.$('modalDuration').value)||30),focusEstimateMinutes:weekwiseRuntime.$('modalFocusEstimate').value.trim()?Math.max(5,Math.min(1440,Math.round(Number(weekwiseRuntime.$('modalFocusEstimate').value)/5)*5)):null,note:weekwiseRuntime.$('modalNote').value.trim(),
  recurrence:weekwiseRuntime.$('modalRecurrence').value,tags:[...new Set(weekwiseRuntime.$('modalTags').value.split(',').map(x=>x.trim().replace(/^#/,'')).filter(Boolean).slice(0,20))],
  subtasks:weekwiseRuntime.$('modalSubtasks').value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,40).map(title=>({id:weekwiseRuntime.uid(),title,done:false})),
  attachments:weekwiseRuntime.parseTaskAttachmentInput(weekwiseRuntime.$('modalAttachments').value).valid,
  noSchedule:!!weekwiseRuntime.$('modalNoSchedule').checked,allDay:!!weekwiseRuntime.$('modalAllDay').checked,createdAt:new Date().toISOString()};
}

function persistTaskTemplates(){weekwiseRuntime.checkedCollectionSave(weekwiseRuntime.TASK_TEMPLATES_KEY,weekwiseRuntime.taskTemplates,value=>weekwiseRuntime.taskTemplates=value);weekwiseRuntime.renderTaskTemplateOptions();}

function saveModalAsTaskTemplate(){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const attachmentParse=weekwiseRuntime.parseTaskAttachmentInput(weekwiseRuntime.$('modalAttachments').value);if(attachmentParse.invalid.length){weekwiseRuntime.$('modalAttachments').focus();weekwiseRuntime.showToast('Use complete http:// or https:// URLs for attachments.');return;}
 const fields=weekwiseRuntime.readModalTaskTemplate();if(!fields.title){weekwiseRuntime.$('modalTitleInput').focus();weekwiseRuntime.showToast('Enter a task name before saving a template.');return;}
 const raw=prompt('Name this task template:',fields.title);if(raw===null)return;
 const name=raw.trim().slice(0,70);if(!name){weekwiseRuntime.showToast('Template name cannot be empty.');return;}
 const existing=weekwiseRuntime.taskTemplates.find(t=>String(t.name).toLowerCase()===name.toLowerCase());
 if(existing&&!confirm('A template with this name already exists. Replace it?'))return;
 const nowIso=new Date().toISOString(),template={id:existing?.id||'tpl'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),name,...fields,updatedAt:nowIso};
 if(existing)weekwiseRuntime.taskTemplates=weekwiseRuntime.taskTemplates.map(t=>t.id===existing.id?template:t);else weekwiseRuntime.taskTemplates.push(template);
 weekwiseRuntime.persistTaskTemplates();weekwiseRuntime.$('taskTemplateSelect').value=template.id;weekwiseRuntime.$('deleteTaskTemplateBtn').disabled=false;weekwiseRuntime.showToast(existing?'Template updated':'Template saved');
}

function applySelectedTaskTemplate(){
 const template=weekwiseRuntime.taskTemplates.find(t=>t.id===weekwiseRuntime.$('taskTemplateSelect').value);if(!template){weekwiseRuntime.showToast('Choose a task template first.');return;}
 weekwiseRuntime.$('modalTitleInput').value=template.title||'';weekwiseRuntime.$('modalCategory').value=template.type||'other';
 const listId=template.listId||'inbox';weekwiseRuntime.$('modalListId').value=[...weekwiseRuntime.$('modalListId').options].some(o=>o.value===listId)?listId:'other';
 weekwiseRuntime.$('modalFolder').value=template.folderName||weekwiseRuntime.defaultFolderName(weekwiseRuntime.$('modalListId').value);weekwiseRuntime.$('modalSection').value=template.sectionName||'';
 weekwiseRuntime.$('modalPriority').value=template.priority||'none';weekwiseRuntime.$('modalStatus').value=template.status||'todo';
 weekwiseRuntime.$('modalSchedulingMode').value=template.schedulingMode||'flexible';
 weekwiseRuntime.$('modalImportance').value=template.importance||'unclassified';weekwiseRuntime.$('modalUrgency').value=template.urgency||'unclassified';weekwiseRuntime.$('modalFocusEstimate').value=template.focusEstimateMinutes?String(template.focusEstimateMinutes):'';
 weekwiseRuntime.$('modalRecurrence').value=['none','daily','weekly','monthly','yearly'].includes(template.recurrence)?template.recurrence:'none';
 const duration=String(template.duration||30);
 if(![...weekwiseRuntime.$('modalDuration').options].some(o=>o.value===duration)){const option=document.createElement('option');option.value=duration;option.textContent=weekwiseRuntime.durationLabel(Number(duration));weekwiseRuntime.$('modalDuration').add(option);}
 weekwiseRuntime.$('modalDuration').value=duration;weekwiseRuntime.updateEndTimeFromDuration();weekwiseRuntime.$('modalNote').value=template.note||'';
 weekwiseRuntime.$('modalTags').value=Array.isArray(template.tags)?template.tags.join(', '):'';
 weekwiseRuntime.$('modalSubtasks').value=Array.isArray(template.subtasks)?template.subtasks.map(s=>typeof s==='string'?s:s.title||'').join('\n'):'';
 weekwiseRuntime.$('modalAttachments').value=Array.isArray(template.attachments)?template.attachments.join('\n'):'';
 weekwiseRuntime.$('modalNoSchedule').checked=!!template.noSchedule;weekwiseRuntime.$('modalAllDay').checked=!!template.allDay&&!template.noSchedule;
 weekwiseRuntime.$('modalDueDate').value='';[1,2,3,4,5].forEach(n=>{const el=weekwiseRuntime.$('modalReminderAt'+(n===1?'':n));if(el)el.value='';});
 weekwiseRuntime.updateModalScheduleVisibility();weekwiseRuntime.clearActivityTemplateSelection();weekwiseRuntime.hideActivitySuggestions();weekwiseRuntime.$('modalTitleInput').focus();
 weekwiseRuntime.showToast('Template applied. Choose the date and time, then save.');
}

function deleteSelectedTaskTemplate(){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const id=weekwiseRuntime.$('taskTemplateSelect').value,template=weekwiseRuntime.taskTemplates.find(t=>t.id===id);if(!template)return;
 if(!confirm('Delete task template "'+template.name+'"?'))return;
 weekwiseRuntime.taskTemplates=weekwiseRuntime.taskTemplates.filter(t=>t.id!==id);weekwiseRuntime.persistTaskTemplates();weekwiseRuntime.showToast('Template deleted');
}

function parseTaskAttachmentInput(value){
 const valid=[],invalid=[];
 String(value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).forEach(line=>{
  try{const url=new URL(line);if(url.protocol!=='https:'&&url.protocol!=='http:'){invalid.push(line);return;}if(!valid.includes(url.href))valid.push(url.href);}
  catch(_){invalid.push(line);}
 });
 return {valid:valid.slice(0,10),invalid};
}

function renderTaskAttachments(attachments){
 const links=Array.isArray(attachments)?attachments.filter(Boolean).slice(0,10):[];
 if(!links.length)return '';
 return '<div class="workspace-task-links">'+links.map((link,index)=>{
  let label='Attachment '+(index+1);try{const url=new URL(link);label=url.hostname+((url.pathname&&url.pathname!=='/')?url.pathname:'');}catch(_){}
  return '<a href="'+weekwiseRuntime.escapeHtml(link)+'" target="_blank" rel="noopener noreferrer" title="Open link in a new tab">↗ '+weekwiseRuntime.escapeHtml(label)+'</a>';
 }).join('')+'</div>';
}

function shareViewTitle(){
 const known={today:'Today',tomorrow:'Tomorrow',inbox:'Inbox',upcoming:'Upcoming',board:'Board',filters:'Saved filters',calendar:'Calendar',matrix:'Priority matrix',search:'Search results'};
 if(known[weekwiseRuntime.workspaceView])return weekwiseRuntime.workspaceView==='filters'?(weekwiseRuntime.savedTaskFilters.find(f=>f.id===weekwiseRuntime.activeSavedFilterId)?.title||'Saved filters'):known[weekwiseRuntime.workspaceView];
 return weekwiseRuntime.$('taskWorkspaceTitle')?.textContent||'Weekwise tasks';
}

function recordsForListTransfer(){
 const all=weekwiseRuntime.workspaceRecords();
 if(weekwiseRuntime.workspaceView==='board'||weekwiseRuntime.workspaceView==='calendar'||weekwiseRuntime.workspaceView==='matrix')return all;
 if(weekwiseRuntime.workspaceView==='filters'){
  const active=weekwiseRuntime.savedTaskFilters.find(f=>f.id===weekwiseRuntime.activeSavedFilterId);
  return active?all.filter(record=>weekwiseRuntime.savedFilterMatches(record,active)):[];
 }
 let records=all.filter(record=>weekwiseRuntime.workspaceRecordMatches(record,weekwiseRuntime.workspaceView));
 if(weekwiseRuntime.workspaceView==='search'||weekwiseRuntime.$('workspaceSearch').value.trim()){
  const query=String(weekwiseRuntime.$('workspaceSearch').value||'').trim().toLowerCase();
  if(query)records=records.filter(r=>[
   r.task.title,r.task.note,r.task.folderName,r.task.sectionName,r.task.dueDate,r.task.priority,r.task.status,r.task.listId,
   weekwiseRuntime.WORKSPACE_LISTS.find(list=>list.id===r.listId)?.label,
   ...(Array.isArray(r.task.tags)?r.task.tags:[]),
   ...(Array.isArray(r.task.attachments)?r.task.attachments:[])
  ].join(' ').toLowerCase().includes(query));
 }
 return records;
}
return Object.freeze({templateDayChecks,openTemplateEditor,closeTemplateEditor,saveTemplateEditor,updateCalendarVisibility,readModalTaskTemplate,persistTaskTemplates,saveModalAsTaskTemplate,applySelectedTaskTemplate,deleteSelectedTaskTemplate,parseTaskAttachmentInput,renderTaskAttachments,shareViewTitle,recordsForListTransfer});
}
root.WeekwiseAppTemplates=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
