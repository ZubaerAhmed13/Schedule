/* workspace controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function syncWorkspaceListOptions(){
 const customs=Array.isArray(weekwiseRuntime.store.customLists)?weekwiseRuntime.store.customLists:[];
 for(const select of [weekwiseRuntime.$('modalListId'),weekwiseRuntime.$('filterList')]){
  if(!select)continue;
  select.querySelectorAll('option[data-custom-list-option]').forEach(option=>option.remove());
  customs.forEach(item=>{if(!item||!item.id||!item.name)return;const option=document.createElement('option');option.value=item.id;option.textContent=item.name;option.dataset.customListOption='true';select.appendChild(option);});
 }
}

function renderWorkspaceCustomLists(){
 const nav=weekwiseRuntime.$('workspaceCustomListsNav');if(!nav)return;
 const customLists=Array.isArray(weekwiseRuntime.store.customLists)?weekwiseRuntime.store.customLists:[];
 if(!customLists.length){nav.innerHTML='';return;}
 const counts=new Map();weekwiseRuntime.workspaceRecords().forEach(record=>counts.set(record.listId,(counts.get(record.listId)||0)+1));
 nav.innerHTML=customLists.map(item=>{
  const view='list-'+item.id,active=weekwiseRuntime.workspaceView===view;
  return '<div class="workspace-custom-list-row"><button type="button" class="workspace-nav-btn '+(active?'active':'')+'" data-workspace-view="'+weekwiseRuntime.escapeHtml(view)+'" aria-current="'+(active?'page':'false')+'"><span class="list-colour-dot custom-list-dot"></span><span title="'+weekwiseRuntime.escapeHtml(item.name)+'">'+weekwiseRuntime.escapeHtml(item.name)+'</span><span class="workspace-nav-count">'+(counts.get(item.id)||0)+'</span></button><button type="button" class="workspace-list-action" data-custom-list-rename="'+weekwiseRuntime.escapeHtml(item.id)+'" title="Rename '+weekwiseRuntime.escapeHtml(item.name)+'" aria-label="Rename '+weekwiseRuntime.escapeHtml(item.name)+'">✎</button><button type="button" class="workspace-list-action" data-custom-list-delete="'+weekwiseRuntime.escapeHtml(item.id)+'" title="Delete '+weekwiseRuntime.escapeHtml(item.name)+'" aria-label="Delete '+weekwiseRuntime.escapeHtml(item.name)+'">'+WeekwiseInterface.icon('remove')+'</button><button type="button" class="workspace-pin-button" data-pin-list="'+weekwiseRuntime.escapeHtml(item.id)+'" aria-label="Pin '+weekwiseRuntime.escapeHtml(item.name)+'"></button></div>';
 }).join('');
}

function syncWorkspaceLists(){
 if(!Array.isArray(weekwiseRuntime.store.customLists))weekwiseRuntime.store.customLists=[];
 weekwiseRuntime.WORKSPACE_LISTS=weekwiseRuntime.BUILTIN_WORKSPACE_LISTS.concat(weekwiseRuntime.store.customLists.filter(item=>item&&item.id&&item.name).map(item=>({id:item.id,label:item.name,view:'list-'+item.id,custom:true})));
 weekwiseRuntime.syncWorkspaceListOptions();weekwiseRuntime.renderWorkspaceCustomLists();
}

function workspaceRecords(){
 const records=[],keys=new Set([...Object.keys(weekwiseRuntime.store.weeks||{}),weekwiseRuntime.currentWeek]);
 [...keys].sort().forEach(week=>{const rows=week===weekwiseRuntime.currentWeek?weekwiseRuntime.tasks:(Array.isArray(weekwiseRuntime.store.weeks[week]?.tasks)?weekwiseRuntime.store.weeks[week].tasks:[]);rows.forEach(task=>{if(!task)return;let date;try{date=weekwiseRuntime.dayDate(week,Number(task.day)||0);}catch(_){return;}records.push({task,week,date,listId:weekwiseRuntime.inferredListId(task)});});});
 return records.sort((a,b)=>a.date-b.date||(a.task.start==null?1:b.task.start==null?-1:Number(a.task.start)-Number(b.task.start)));
}

function workspaceFolderSummary(){
 const counts=new Map();
 weekwiseRuntime.workspaceRecords().forEach(record=>{
  const name=String(record.task.folderName||weekwiseRuntime.defaultFolderName(record.listId)||'Personal').trim()||'Personal';
  counts.set(name,(counts.get(name)||0)+1);
 });
 return [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}

function renderWorkspaceFolders(){
 const nav=weekwiseRuntime.$('workspaceFolderNav');if(!nav)return;
 const folders=weekwiseRuntime.workspaceFolderSummary();
 if(!folders.length){nav.innerHTML='<p class="workspace-folder-empty">Folders appear here when you assign them to a task.</p>';return;}
 nav.innerHTML=folders.map(([name,count])=>{
  const view='folder:'+name,active=weekwiseRuntime.workspaceView===view;
  return '<button type="button" class="workspace-nav-btn workspace-folder-btn '+(active?'active':'')+'" data-workspace-view="'+weekwiseRuntime.escapeHtml(view)+'" aria-current="'+(active?'page':'false')+'"><span class="workspace-nav-icon" aria-hidden="true">▰</span><span title="'+weekwiseRuntime.escapeHtml(name)+'">'+weekwiseRuntime.escapeHtml(name)+'</span><span class="workspace-nav-count">'+count+'</span></button>';
 }).join('');
}

function workspaceTagSummary(){
 const counts=new Map();
 weekwiseRuntime.workspaceRecords().forEach(record=>{
  (Array.isArray(record.task.tags)?record.task.tags:[]).forEach(raw=>{
   const name=String(raw||'').trim().replace(/^#/,'');if(!name)return;
   const key=name.toLowerCase(),existing=counts.get(key);
   if(existing)existing.count++;else counts.set(key,{name,count:1});
  });
 });
 return [...counts.values()].sort((a,b)=>a.name.localeCompare(b.name));
}

function renderWorkspaceTags(){
 const nav=weekwiseRuntime.$('workspaceTagNav');if(!nav)return;
 const tags=weekwiseRuntime.workspaceTagSummary();
 if(!tags.length){nav.innerHTML='<p class="workspace-tag-empty">Tags appear here when you add them to tasks.</p>';return;}
 nav.innerHTML=tags.map(item=>{
  const view='tag:'+item.name,active=weekwiseRuntime.workspaceView.toLowerCase()===view.toLowerCase();
  return '<button type="button" class="workspace-nav-btn workspace-tag-btn '+(active?'active':'')+'" data-workspace-view="'+weekwiseRuntime.escapeHtml(view)+'" aria-current="'+(active?'page':'false')+'"><span class="workspace-tag-hash">#</span><span title="'+weekwiseRuntime.escapeHtml(item.name)+'">'+weekwiseRuntime.escapeHtml(item.name)+'</span><span class="workspace-nav-count">'+item.count+'</span></button>';
 }).join('');
}

function workspaceRecordMatches(record,view,todayKey){
 if(view==='search')return true;
 if(view==='inbox')return record.listId==='inbox';
 if(view.startsWith('list-'))return record.listId===view.slice(5);
 if(view.startsWith('folder:'))return (record.task.folderName||weekwiseRuntime.defaultFolderName(record.listId))===view.slice(7);
 if(view.startsWith('tag:'))return Array.isArray(record.task.tags)&&record.task.tags.some(tag=>String(tag).replace(/^#/,'').toLowerCase()===view.slice(4).toLowerCase());
 todayKey=todayKey||WeekwiseToday.clock(weekwiseRuntime.store,weekwiseRuntime.now.getTime()).date;const t=record.task,endKey=WeekwisePlanning.dateAt(todayKey,7);
 const recordKey=weekwiseRuntime.dateKey(record.date),listId=record.listId;
 if(view==='today')return ((listId!=='inbox'||!!t.allDay||(!t.unscheduled&&t.start!==null&&t.start!==undefined))&&WeekwiseToday.occursOn(record,todayKey))||(!t.done&&!!t.dueDate&&t.dueDate<=todayKey);
 const tomorrowKey=WeekwisePlanning.dateAt(todayKey,1);
 if(view==='tomorrow')return (WeekwiseToday.occursOn(record,tomorrowKey)&&(!!t.allDay||(!t.unscheduled&&t.start!=null)))||(!t.done&&t.dueDate===tomorrowKey);
 if(view==='upcoming'){
  const scheduledSoon=((recordKey>=todayKey&&recordKey<endKey)||WeekwiseToday.occursOn(record,todayKey))&&(!!t.allDay||(!t.unscheduled&&t.start!=null));
  const dueSoon=!!t.dueDate&&t.dueDate>todayKey&&t.dueDate<endKey;
  return !t.done&&(scheduledSoon||dueSoon);
 }
 return false;
}

function workspacePriorityValue(priority){return ({high:3,medium:2,low:1})[priority]||0;}

function workspaceDateLabel(record){
 if(record.task.start==null||record.task.unscheduled)return 'Not scheduled';
 const todayKey=WeekwiseToday.clock(weekwiseRuntime.store,weekwiseRuntime.now.getTime()).date,tomorrow=WeekwisePlanning.dateAt(todayKey,1);
 const dateLabel=weekwiseRuntime.dateKey(record.date)===todayKey?'Today':weekwiseRuntime.dateKey(record.date)===tomorrow?'Tomorrow':weekwiseRuntime.fmtDate(record.date,{weekday:'short',day:'numeric',month:'short'});
 return dateLabel+' · '+weekwiseRuntime.formatTime(record.task);
}

function workspaceTaskRow(record){
 const t=record.task,priority=t.priority||'none',tags=Array.isArray(t.tags)?t.tags.filter(Boolean):[],subtasks=Array.isArray(t.subtasks)?t.subtasks:[];
 const completedSubtasks=subtasks.filter(s=>typeof s==='object'&&s.done).length;
 const priorityHtml=priority!=='none'?'<span class="workspace-meta-pill priority-'+weekwiseRuntime.escapeHtml(priority)+'">'+({high:'↑ High',medium:'→ Medium',low:'↓ Low'}[priority]||'Priority')+'</span>':'';
 const dueHtml=t.dueDate?'<span class="workspace-meta-pill">Due '+weekwiseRuntime.escapeHtml(weekwiseRuntime.fmtDate(weekwiseRuntime.parseKey(t.dueDate),{day:'numeric',month:'short'}))+'</span>':'';
 const scheduleHtml=t.allDay?'<span class="workspace-meta-pill">All day</span>':(t.unscheduled||t.start==null?'<span class="workspace-meta-pill">Not scheduled</span>':'<span>'+weekwiseRuntime.escapeHtml(weekwiseRuntime.workspaceDateLabel(record))+'</span>');
 const status=weekwiseRuntime.taskBoardStatus(t),statusHtml=status==='in-progress'?'<span class="workspace-meta-pill">In progress</span>':'';
 const focusTarget=Number(t.focusEstimateMinutes)||0,focusLogged=weekwiseRuntime.taskLoggedFocusMinutes(t.id);
 const focusEstimateHtml=focusTarget?'<span class="workspace-meta-pill task-focus-estimate" title="Estimated focus '+focusTarget+' minutes">'+String(focusTarget)+'m focus target'+(focusLogged?' · '+focusLogged+'m logged':'')+'</span>':'';
 const tagsHtml=tags.length?'<div class="workspace-task-tags">'+tags.map(tag=>'<span>#'+weekwiseRuntime.escapeHtml(tag)+'</span>').join('')+'</div>':'';
 const attachmentsHtml=weekwiseRuntime.renderTaskAttachments(t.attachments);
 const reminderList=weekwiseRuntime.taskReminderTimes(t),pendingReminderList=reminderList.filter(value=>!((Array.isArray(t.reminderNotifiedTimes)&&t.reminderNotifiedTimes.includes(value))||t.reminderNotifiedAt===value));
 const reminderPreview=pendingReminderList[0]||reminderList[0]||'';
 const reminderLabel=reminderList.length>1?(pendingReminderList.length||reminderList.length)+' reminders':reminderPreview?new Date(reminderPreview).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
 const reminderHtml=reminderList.length?'<span class="workspace-meta-pill task-reminder-pill" title="'+weekwiseRuntime.escapeHtml(reminderList.map(value=>new Date(value).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})).join(' · '))+'">◷ '+weekwiseRuntime.escapeHtml(reminderLabel)+'</span>':'';
 const organizationHtml='<span class="workspace-meta-pill workspace-folder-pill">'+weekwiseRuntime.escapeHtml(t.folderName||weekwiseRuntime.defaultFolderName(record.listId))+'</span>'+(t.sectionName?'<span class="workspace-meta-pill workspace-section-pill">§ '+weekwiseRuntime.escapeHtml(t.sectionName)+'</span>':'');
 const label=weekwiseRuntime.WORKSPACE_LISTS.find(x=>x.id===record.listId)?.label||'Inbox',attrs=' data-workspace-week="'+weekwiseRuntime.escapeHtml(record.week)+'"';
 const subtasksHtml=subtasks.length?'<details class="workspace-subtasks"><summary>☷ '+completedSubtasks+'/'+subtasks.length+' subtasks</summary><div class="workspace-subtask-list">'+subtasks.map((sub,index)=>{const title=typeof sub==='string'?sub:(sub.title||'Untitled step'),checked=typeof sub==='object'&&!!sub.done;return '<label class="workspace-subtask-row"><input type="checkbox" data-workspace-subtask="'+weekwiseRuntime.escapeHtml(t.id)+'" data-workspace-subtask-index="'+index+'"'+attrs+' '+(checked?'checked':'')+' aria-label="Complete subtask '+weekwiseRuntime.escapeHtml(title)+'"><span class="'+(checked?'is-complete':'')+'">'+weekwiseRuntime.escapeHtml(title)+'</span></label>';}).join('')+'</div></details>':'';
 return '<article class="workspace-task-row '+(t.done?'is-done':'')+'" data-workspace-id="'+weekwiseRuntime.escapeHtml(t.id)+'"'+attrs+WeekwiseTaskOptions.attributes(t)+'>'+WeekwiseProductivity.rowSelection(record)+
  '<input class="workspace-task-check" type="checkbox" data-workspace-done="'+weekwiseRuntime.escapeHtml(t.id)+'"'+attrs+' aria-label="Mark '+weekwiseRuntime.escapeHtml(t.title)+' complete" '+(t.done?'checked':'')+'>'+
  '<div class="workspace-task-main"><button type="button" class="workspace-task-title" data-workspace-edit="'+weekwiseRuntime.escapeHtml(t.id)+'"'+attrs+'>'+weekwiseRuntime.escapeHtml(t.title)+'</button>'+
  '<div class="workspace-task-meta">'+scheduleHtml+'<span class="workspace-meta-pill">'+weekwiseRuntime.escapeHtml(label)+'</span>'+organizationHtml+statusHtml+priorityHtml+dueHtml+reminderHtml+focusEstimateHtml+'</div>'+tagsHtml+attachmentsHtml+subtasksHtml+(t.note?'<div class="workspace-task-subtasks">'+weekwiseRuntime.escapeHtml(t.note)+'</div>':'')+'</div>'+
  '<div class="workspace-task-actions">'+WeekwiseProductivity.rowActions(record)+'<button type="button" title="Edit task" aria-label="Edit '+weekwiseRuntime.escapeHtml(t.title)+'" data-workspace-edit="'+weekwiseRuntime.escapeHtml(t.id)+'"'+attrs+'>'+WeekwiseInterface.icon('edit')+'</button><button type="button" title="Delete task" aria-label="Delete '+weekwiseRuntime.escapeHtml(t.title)+'" data-workspace-delete="'+weekwiseRuntime.escapeHtml(t.id)+'"'+attrs+'>'+WeekwiseInterface.icon('remove')+'</button></div></article>';
}

function updateWorkspaceCounts(){
 const all=weekwiseRuntime.workspaceRecords(),todayKey=WeekwiseToday.clock(weekwiseRuntime.store,weekwiseRuntime.now.getTime()).date;
 const ids={Today:'navCountToday',Tomorrow:'navCountTomorrow',Inbox:'navCountInbox',Upcoming:'navCountUpcoming',Career:'navCountCareer',Study:'navCountStudy',Work:'navCountWork',Personal:'navCountPersonal',Languages:'navCountLanguage',Hobbies:'navCountHobbies',Other:'navCountOther'};
 const listIds={Career:'career',Study:'study',Work:'work',Personal:'personal',Languages:'language',Hobbies:'hobbies',Other:'other'};
 Object.entries(ids).forEach(([key,id])=>{
  const el=weekwiseRuntime.$(id);if(!el)return;
  const view=({Today:'today',Tomorrow:'tomorrow',Inbox:'inbox',Upcoming:'upcoming'})[key]||'list-'+listIds[key];const count=all.filter(r=>weekwiseRuntime.workspaceRecordMatches(r,view,todayKey)).length;
  el.textContent=String(count);
 });
}

function renderWorkspaceTaskGroups(items){
 const groups=new Map();
 items.forEach(record=>{
  const section=String(record.task.sectionName||'').trim()||'No section';
  if(!groups.has(section))groups.set(section,[]);
  groups.get(section).push(record);
 });
 return [...groups.entries()].sort((a,b)=>{
  if(a[0]==='No section')return -1;
  if(b[0]==='No section')return 1;
  return a[0].localeCompare(b[0]);
 }).map(([section,records])=>'<section class="workspace-section-group"><header><span>§ '+weekwiseRuntime.escapeHtml(section)+'</span><span>'+records.length+'</span></header>'+records.map(weekwiseRuntime.workspaceTaskRow).join('')+'</section>').join('');
}

function experienceData(){const clock=WeekwiseToday.clock(weekwiseRuntime.store,weekwiseRuntime.now.getTime());return {active:weekwiseRuntime.workspaceView==='insights',owner:weekwiseRuntime.currentDataOwner,week:WeekwiseCalendarRange.range(clock.date,weekwiseRuntime.store.settings.weekStartsOn===1?1:0)[0],today:clock.date,minute:clock.minute,epoch:clock.epoch,zone:clock.zone,store:weekwiseRuntime.store,records:weekwiseRuntime.workspaceRecords().map(r=>({...r,dateKey:weekwiseRuntime.dateKey(r.date)})),focusSessions:weekwiseRuntime.focusSessions,habits:weekwiseRuntime.habits,signedIn:!!weekwiseRuntime.cloudUser,syncLabel:weekwiseRuntime.$('cloudMenuBadge').textContent};}

function renderExperience(){weekwiseRuntime.renderDraftNotice();weekwiseRuntime.renderZoneNotice();if(!window.WeekwiseExperience)return;const data=weekwiseRuntime.experienceData();WeekwiseExperience.renderInsights(data);WeekwiseExperience.renderSettings(data);}

function renderTodayOverview(){const panel=weekwiseRuntime.$('todayOverview');panel.hidden=weekwiseRuntime.workspaceView!=='today';if(!panel.hidden)WeekwiseExperience.renderToday({...weekwiseRuntime.experienceData(),active:true});}

function listPage(key,items){const scoped=weekwiseRuntime.currentDataOwner+'::'+key,page=WeekwiseListWindow.page(scoped,items);return {...page,key:scoped};}

function listPageFooter(page){return page.total>WeekwiseListWindow.SIZE?'<div class="list-page-footer" role="status"><span>Showing '+page.shown+' of '+page.total+' tasks</span>'+(page.hasMore?'<button class="btn" type="button" data-list-more="'+weekwiseRuntime.escapeHtml(page.key)+'">Show '+Math.min(WeekwiseListWindow.SIZE,page.total-page.shown)+' more</button>':'')+'</div>':'';}

function renderWorkspaceTasks(){
 const list=weekwiseRuntime.$('workspaceTaskList');if(!list)return;
 const search=String(weekwiseRuntime.$('workspaceSearch')?.value||'').trim().toLowerCase(),sort=weekwiseRuntime.$('workspaceSort')?.value||'date';
 const todayKey=WeekwiseToday.clock(weekwiseRuntime.store,weekwiseRuntime.now.getTime()).date;let items=weekwiseRuntime.workspaceRecords().filter(r=>weekwiseRuntime.workspaceRecordMatches(r,weekwiseRuntime.workspaceView,todayKey));
 if(search)items=items.filter(r=>[r.task.title,r.task.note,r.task.folderName,r.task.sectionName,r.task.dueDate,r.task.priority,r.task.status,r.task.listId,weekwiseRuntime.WORKSPACE_LISTS.find(list=>list.id===r.listId)?.label,...(Array.isArray(r.task.tags)?r.task.tags:[]),...(Array.isArray(r.task.attachments)?r.task.attachments:[])].join(' ').toLowerCase().includes(search));
 if(sort==='priority')items.sort((a,b)=>weekwiseRuntime.workspacePriorityValue(b.task.priority)-weekwiseRuntime.workspacePriorityValue(a.task.priority)||a.date-b.date||(Number(a.task.start??9999)-Number(b.task.start??9999)));
 else if(sort==='title')items.sort((a,b)=>String(a.task.title).localeCompare(String(b.task.title)));
 else items.sort((a,b)=>a.date-b.date||(a.task.start==null?1:b.task.start==null?-1:Number(a.task.start)-Number(b.task.start)));
 const folderView=weekwiseRuntime.workspaceView.startsWith('folder:'),folderTitle=folderView?weekwiseRuntime.workspaceView.slice(7):'';
 const tagView=weekwiseRuntime.workspaceView.startsWith('tag:'),tagTitle=tagView?weekwiseRuntime.workspaceView.slice(4):'';
 const info=weekwiseRuntime.WORKSPACE_VIEW_INFO[weekwiseRuntime.workspaceView]||{title:tagView?'#'+tagTitle:folderView?folderTitle:(weekwiseRuntime.WORKSPACE_LISTS.find(x=>x.view===weekwiseRuntime.workspaceView)?.label||'Tasks'),description:tagView?'Tasks tagged #'+tagTitle:folderView?'Tasks organized in this folder.':'Tasks in this list.',emptyTitle:tagView?'No tasks with this tag':folderView?'This folder is empty':'No tasks in this list yet',emptyText:tagView?'Add this tag to a task to make it appear here.':folderView?'Edit any task to place it in this folder, or create a task with this folder name.':'Add a task to this list or edit an existing task to move it here.'};
 weekwiseRuntime.$('taskWorkspaceTitle').textContent=info.title;weekwiseRuntime.$('taskWorkspaceDescription').textContent=info.description||'';
 weekwiseRuntime.$('workspaceCaptureInput').placeholder=weekwiseRuntime.workspaceView==='inbox'?'Quick capture to Inbox…':weekwiseRuntime.workspaceView.startsWith('folder:')?'Add a task to '+weekwiseRuntime.workspaceView.slice(7)+'…':weekwiseRuntime.workspaceView.startsWith('tag:')?'Add a task tagged #'+weekwiseRuntime.workspaceView.slice(4)+'…':'Add a task to your inbox…';weekwiseRuntime.$('workspaceAddTaskBtn').innerHTML='<svg class="ww-icon action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>'+(weekwiseRuntime.workspaceView==='inbox'?'Add to Inbox':'Add task')+'</span>';
 weekwiseRuntime.$('workspaceSearch').placeholder=weekwiseRuntime.workspaceView==='search'?'Search every list, folder, tag and deadline…':'Search tasks in this view';
 const shouldGroupSections=(weekwiseRuntime.workspaceView.startsWith('list-')||weekwiseRuntime.workspaceView.startsWith('folder:')||weekwiseRuntime.workspaceView.startsWith('tag:'))&&items.some(record=>String(record.task.sectionName||'').trim());
 const page=weekwiseRuntime.listPage('workspace:'+weekwiseRuntime.workspaceView+'|'+search+'|'+sort,items);const renderedItems=(shouldGroupSections?weekwiseRuntime.renderWorkspaceTaskGroups(page.records):page.records.map(weekwiseRuntime.workspaceTaskRow).join(''))+weekwiseRuntime.listPageFooter(page);
 weekwiseRuntime.renderTodayOverview();
 list.innerHTML=items.length?renderedItems:'<div class="workspace-empty"><div><div class="workspace-empty-icon">✓</div><h3>'+weekwiseRuntime.escapeHtml(search?'No matching tasks':info.emptyTitle)+'</h3><p>'+weekwiseRuntime.escapeHtml(search?'Try another search term.':info.emptyText)+'</p></div></div>';
 WeekwiseProductivity.render();
}

function renderWorkspaceView(){
 WeekwiseInterface.navigation(weekwiseRuntime.workspaceView);
 const isInsights=weekwiseRuntime.workspaceView==='insights',isSettings=weekwiseRuntime.workspaceView==='settings',isPlan=weekwiseRuntime.workspaceView==='plan',isCalendar=weekwiseRuntime.workspaceView==='calendar',isMatrix=weekwiseRuntime.workspaceView==='matrix',isBoard=weekwiseRuntime.workspaceView==='board',isFilters=weekwiseRuntime.workspaceView==='filters';
 const taskWorkspace=weekwiseRuntime.$('taskWorkspace'),matrix=weekwiseRuntime.$('priorityMatrix'),board=weekwiseRuntime.$('kanbanBoard'),filters=weekwiseRuntime.$('filtersWorkspace');
 if(taskWorkspace)taskWorkspace.hidden=isInsights||isSettings||isPlan||isCalendar||isMatrix||isBoard||isFilters;
 weekwiseRuntime.$('insightsWorkspace').hidden=!isInsights;weekwiseRuntime.$('settingsWorkspace').hidden=!isSettings;weekwiseRuntime.renderExperience();
 if(weekwiseRuntime.$('planWorkspace'))weekwiseRuntime.$('planWorkspace').hidden=!isPlan;
 if(isPlan)window.WeekwisePlanUI?.render();
 if(matrix)matrix.hidden=!isMatrix;
 if(board)board.hidden=!isBoard;
 if(filters)filters.hidden=!isFilters;
 ['calendarToolbar','mobileDayPicker','mobileHelp','daysGrid','dashboard','unscheduledBox'].forEach(id=>{const el=weekwiseRuntime.$(id);if(el)el.hidden=!isCalendar;});
 document.querySelectorAll('[data-workspace-view]').forEach(button=>{const active=button.dataset.workspaceView===weekwiseRuntime.workspaceView;button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false');});
 weekwiseRuntime.syncWorkspaceLists();weekwiseRuntime.renderWorkspaceFolders();weekwiseRuntime.renderWorkspaceTags();weekwiseRuntime.renderWorkspaceTasks();weekwiseRuntime.updateWorkspaceCounts();
 if(isMatrix)weekwiseRuntime.renderPriorityMatrix();
 if(isBoard)weekwiseRuntime.renderKanbanBoard();
 if(isFilters)weekwiseRuntime.renderSavedFilters();
 WeekwiseInterface.renderPins();
}

function setWorkspaceView(view){
 if(!['search','today','tomorrow','inbox','upcoming','board','filters','plan','insights','settings','calendar','matrix','list-career','list-study','list-work','list-personal','list-language','list-hobbies','list-other'].includes(view)&&!weekwiseRuntime.WORKSPACE_LISTS.some(list=>list.view===view)&&!(typeof view==='string'&&(view.startsWith('folder:')||view.startsWith('tag:'))))return;
 const finishMeasurement=root.WeekwisePerformance?.beginView(view);
 const changed=weekwiseRuntime.workspaceView!==view;
 if(weekwiseRuntime.workspaceView!==view)weekwiseRuntime.saveCurrent();weekwiseRuntime.workspaceView=view;try{localStorage.setItem('weekwise-workspace-view-v1',view);}catch(_){}
 weekwiseRuntime.renderWorkspaceView();if(view==='calendar')weekwiseRuntime.renderAll();if(view==='search')setTimeout(()=>weekwiseRuntime.$('workspaceSearch')?.focus(),0);if(changed)root.WeekwiseMotion?.enter(view);finishMeasurement?.();
}

function openWorkspaceRecord(id,week){
 if(week!==weekwiseRuntime.currentWeek){weekwiseRuntime.saveCurrent();weekwiseRuntime.loadWeek(week);}
 const t=weekwiseRuntime.tasks.find(x=>x.id===id);if(!t)return;if(t.fixed){weekwiseRuntime.openFixedSettings(id);return;}
 const viewDefault=weekwiseRuntime.workspaceView==='inbox'?'inbox':weekwiseRuntime.workspaceView.startsWith('list-')?weekwiseRuntime.workspaceView.slice(5):null;
 weekwiseRuntime.openTaskModal(id,t.day,t.start,viewDefault);
}

function updateWorkspaceRecord(id,week,action,subtaskIndex=null){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 let item=null;
 if(week!==weekwiseRuntime.currentWeek){const saved=weekwiseRuntime.store.weeks[week];item=Array.isArray(saved?.tasks)?saved.tasks.find(t=>t.id===id):null;}
 else item=weekwiseRuntime.tasks.find(t=>t.id===id);
 if(!item)return;
 if(action==='delete'){WeekwiseTaskHistoryUI.remove(id,week);return;
 }else if(action==='toggle'){
  item.done=!item.done;item.status=item.done?'done':(item.status==='done'?'todo':(item.status||'todo'));
 }else if(action==='toggle-subtask'){
  const index=Number(subtaskIndex),subs=Array.isArray(item.subtasks)?item.subtasks:[];
  if(!Number.isInteger(index)||index<0||index>=subs.length)return;
  const sub=subs[index];
  if(typeof sub==='string')subs[index]={id:weekwiseRuntime.uid(),title:sub,done:true};else sub.done=!sub.done;
  item.subtasks=subs;
  const allDone=subs.length>0&&subs.every(s=>typeof s==='object'&&!!s.done);
  item.done=allDone;item.status=allDone?'done':'todo';
 }
 if(action==='toggle-subtask'){const sub=item.subtasks?.[Number(subtaskIndex)];if(sub?.taskId){const child=weekwiseRuntime.workspaceRecords().find(r=>r.task.id===sub.taskId);if(child){child.task.done=!!sub.done;child.task.status=sub.done?'done':'todo';}}}weekwiseRuntime.reconcileSplitTasks();weekwiseRuntime.saveCurrent();
 weekwiseRuntime.renderAll();
}

function wireWorkspaceControls(){
 weekwiseRuntime.$('workspaceSidebar').addEventListener('click',e=>{
  const rename=e.target.closest('[data-custom-list-rename]');if(rename){weekwiseRuntime.renameCustomList(rename.dataset.customListRename);return;}
  const remove=e.target.closest('[data-custom-list-delete]');if(remove){weekwiseRuntime.deleteCustomList(remove.dataset.customListDelete);return;}
  const button=e.target.closest('[data-workspace-view]');if(button){weekwiseRuntime.setWorkspaceView(button.dataset.workspaceView);return;}
  const action=e.target.closest('[data-workspace-action]')?.dataset.workspaceAction;
  if(action==='create-list')weekwiseRuntime.createCustomList();
  if(action==='habits'){weekwiseRuntime.renderHabitTracker();weekwiseRuntime.openUtilityPanel('routineDetails','Habits & routines');}
  if(action==='focus'){weekwiseRuntime.renderFocusPanel();weekwiseRuntime.openUtilityPanel('focusPanel','Focus timer');}
  if(action==='countdowns'){weekwiseRuntime.renderCountdowns();weekwiseRuntime.openUtilityPanel('countdownsPanel','Countdowns');}
  if(action==='statistics')weekwiseRuntime.openDashboard();
 });
 weekwiseRuntime.$('workspaceCaptureForm').addEventListener('submit',e=>{e.preventDefault();weekwiseRuntime.quickCaptureWorkspaceTask();});
 weekwiseRuntime.$('workspaceExportListBtn').addEventListener('click',weekwiseRuntime.exportCurrentTaskList);
 weekwiseRuntime.$('workspaceImportListBtn').addEventListener('click',()=>weekwiseRuntime.$('workspaceImportListFile').click());
 weekwiseRuntime.$('workspaceImportListFile').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await weekwiseRuntime.importSharedTaskList(file);});
 weekwiseRuntime.$('copyTaskPlanningPromptBtn').addEventListener('click',weekwiseRuntime.copyTaskPlanningPrompt);
 weekwiseRuntime.$('voiceCaptureBtn').addEventListener('click',weekwiseRuntime.toggleVoiceCapture);
 weekwiseRuntime.$('workspaceAddTaskBtn').addEventListener('click',()=>{const def=weekwiseRuntime.workspaceView==='inbox'?'inbox':weekwiseRuntime.workspaceView.startsWith('list-')?weekwiseRuntime.workspaceView.slice(5):weekwiseRuntime.workspaceView.startsWith('folder:')?(weekwiseRuntime.workspaceRecords().find(r=>(r.task.folderName||weekwiseRuntime.defaultFolderName(r.listId))===weekwiseRuntime.workspaceView.slice(7))?.listId||'other'):weekwiseRuntime.workspaceView.startsWith('tag:')?(weekwiseRuntime.workspaceRecords().find(r=>(Array.isArray(r.task.tags)?r.task.tags:[]).some(tag=>String(tag).replace(/^#/,'').toLowerCase()===weekwiseRuntime.workspaceView.slice(4).toLowerCase()))?.listId||'other'):null;const tomorrow=weekwiseRuntime.workspaceView==='tomorrow';const targetDay=tomorrow?weekwiseRuntime.addDaysForView(weekwiseRuntime.now,1).getDay():weekwiseRuntime.workspaceView==='today'?weekwiseRuntime.now.getDay():weekwiseRuntime.mobileDay;const targetStart=weekwiseRuntime.workspaceView==='inbox'?null:tomorrow?10*60:weekwiseRuntime.nextQuarterHour();weekwiseRuntime.openTaskModal(null,targetDay,targetStart,def);});
 weekwiseRuntime.$('addCustomListBtn').addEventListener('click',weekwiseRuntime.createCustomList);
 weekwiseRuntime.$('workspaceSearch').addEventListener('input',weekwiseRuntime.renderWorkspaceTasks);weekwiseRuntime.$('workspaceSort').addEventListener('change',weekwiseRuntime.renderWorkspaceTasks);
 weekwiseRuntime.$('workspaceTaskList').addEventListener('change',e=>{const sub=e.target.closest('[data-workspace-subtask]');if(sub){weekwiseRuntime.updateWorkspaceRecord(sub.dataset.workspaceSubtask,sub.dataset.workspaceWeek,'toggle-subtask',Number(sub.dataset.workspaceSubtaskIndex));return;}const control=e.target.closest('[data-workspace-done]');if(control)weekwiseRuntime.updateWorkspaceRecord(control.dataset.workspaceDone,control.dataset.workspaceWeek,'toggle');});
 weekwiseRuntime.$('workspaceTaskList').addEventListener('click',e=>{const edit=e.target.closest('[data-workspace-edit]');if(edit){weekwiseRuntime.openWorkspaceRecord(edit.dataset.workspaceEdit,edit.dataset.workspaceWeek);return;}const del=e.target.closest('[data-workspace-delete]');if(del)weekwiseRuntime.updateWorkspaceRecord(del.dataset.workspaceDelete,del.dataset.workspaceWeek,'delete');});
weekwiseRuntime.$('kanbanBoard').addEventListener('change',e=>{const select=e.target.closest('[data-board-status]');if(select)weekwiseRuntime.updateBoardTaskStatus(select.dataset.boardStatus,select.dataset.boardWeek,select.value);});
weekwiseRuntime.$('kanbanBoard').addEventListener('click',e=>{const edit=e.target.closest('[data-board-edit]');if(edit)weekwiseRuntime.openWorkspaceRecord(edit.dataset.boardEdit,edit.dataset.boardWeek);});
weekwiseRuntime.$('kanbanAddTaskBtn').addEventListener('click',()=>weekwiseRuntime.openTaskModal(null,weekwiseRuntime.mobileDay,weekwiseRuntime.nextQuarterHour()));
weekwiseRuntime.$('savedFilterForm').addEventListener('submit',weekwiseRuntime.saveFilterForm);
weekwiseRuntime.$('savedFilterForm').addEventListener('input',previewFilterDraft);weekwiseRuntime.$('resetFilterBtn').addEventListener('click',resetFilterForm);
document.querySelectorAll('[data-filter-preset]').forEach(button=>button.addEventListener('click',()=>{resetFilterForm();const kind=button.dataset.filterPreset;weekwiseRuntime.$('filterName').value=kind==='priority'?'High priority':kind==='deadline'?'Upcoming deadlines':'Ready to focus';weekwiseRuntime.$('filterStatus').value='todo';if(kind==='priority'){weekwiseRuntime.$('filterPriority').value='high';weekwiseRuntime.$('filterSort').value='priority';}if(kind==='deadline'){weekwiseRuntime.$('filterDue').value='7days';weekwiseRuntime.$('filterSort').value='due';}if(kind==='focus')weekwiseRuntime.$('filterSchedule').value='unscheduled';previewFilterDraft();}));
weekwiseRuntime.$('savedFilterList').addEventListener('click',e=>{
 const edit=e.target.closest('[data-filter-edit]');if(edit){editSavedFilter(edit.dataset.filterEdit);return;}
 const open=e.target.closest('[data-filter-open]');
 if(open){weekwiseRuntime.activeSavedFilterId=open.dataset.filterOpen;weekwiseRuntime.renderSavedFilters();return;}
 const remove=e.target.closest('[data-filter-delete]');if(remove)weekwiseRuntime.deleteSavedFilter(remove.dataset.filterDelete);
});
weekwiseRuntime.$('savedFilterResults').addEventListener('click',e=>{
 const edit=e.target.closest('[data-workspace-edit]');if(edit){weekwiseRuntime.openWorkspaceRecord(edit.dataset.workspaceEdit,edit.dataset.workspaceWeek);return;}
 const del=e.target.closest('[data-workspace-delete]');if(del)weekwiseRuntime.updateWorkspaceRecord(del.dataset.workspaceDelete,del.dataset.workspaceWeek,'delete');
});
weekwiseRuntime.$('savedFilterResults').addEventListener('change',e=>{
 const sub=e.target.closest('[data-workspace-subtask]');if(sub){weekwiseRuntime.updateWorkspaceRecord(sub.dataset.workspaceSubtask,sub.dataset.workspaceWeek,'toggle-subtask',Number(sub.dataset.workspaceSubtaskIndex));return;}
 const control=e.target.closest('[data-workspace-done]');if(control)weekwiseRuntime.updateWorkspaceRecord(control.dataset.workspaceDone,control.dataset.workspaceWeek,'toggle');
});
weekwiseRuntime.$('priorityMatrix').addEventListener('change',e=>{const c=e.target.closest('[data-matrix-done]');if(c)weekwiseRuntime.updateWorkspaceRecord(c.dataset.matrixDone,c.dataset.matrixWeek,'toggle');});
weekwiseRuntime.$('priorityMatrix').addEventListener('click',e=>{const b=e.target.closest('[data-matrix-edit]');if(b)weekwiseRuntime.openWorkspaceRecord(b.dataset.matrixEdit,b.dataset.matrixWeek);});
weekwiseRuntime.$('matrixAddTaskBtn').addEventListener('click',()=>weekwiseRuntime.openTaskModal(null,weekwiseRuntime.mobileDay,weekwiseRuntime.nextQuarterHour()));
weekwiseRuntime.$('focusPreset').addEventListener('change',()=>{const state=weekwiseRuntime.ensureFocusState();if(state.runningSince===null&&state.activeMs===0){weekwiseRuntime.focusState=weekwiseRuntime.freshFocus('focus',Number(weekwiseRuntime.$('focusPreset').value)*60);weekwiseRuntime.persistActiveFocus();weekwiseRuntime.renderFocusPanel();}});
weekwiseRuntime.$('focusTaskSelect').addEventListener('change',weekwiseRuntime.renderFocusPanel);
weekwiseRuntime.$('focusTaskSearch').addEventListener('input',()=>{clearTimeout(weekwiseRuntime.focusPickerTimer);const owner=weekwiseRuntime.currentDataOwner;weekwiseRuntime.focusPickerTimer=setTimeout(()=>{if(owner!==weekwiseRuntime.currentDataOwner)return;weekwiseRuntime.focusPickerIndex=0;weekwiseRuntime.renderFocusPanel();},150);});
weekwiseRuntime.$('focusTaskPrevious').addEventListener('click',()=>{weekwiseRuntime.focusPickerIndex--;weekwiseRuntime.renderFocusPanel();});
weekwiseRuntime.$('focusTaskNext').addEventListener('click',()=>{weekwiseRuntime.focusPickerIndex++;weekwiseRuntime.renderFocusPanel();});
weekwiseRuntime.$('focusStartBtn').addEventListener('click',weekwiseRuntime.focusStartPause);
weekwiseRuntime.$('focusResetBtn').addEventListener('click',weekwiseRuntime.focusReset);
weekwiseRuntime.$('focusBreakBtn').addEventListener('click',()=>weekwiseRuntime.focusTakeBreak(false));
 weekwiseRuntime.$('focusLongBreakBtn')?.addEventListener('click',()=>weekwiseRuntime.focusTakeBreak(true));
 weekwiseRuntime.$('focusFinishBtn')?.addEventListener('click',weekwiseRuntime.focusComplete);
weekwiseRuntime.$('enableTaskNotificationsBtn').addEventListener('click',weekwiseRuntime.enableTaskNotifications);
weekwiseRuntime.renderTaskNotificationSettings();
weekwiseRuntime.$('habitForm').addEventListener('submit',weekwiseRuntime.saveHabitForm);weekwiseRuntime.$('habitFrequencyMode').addEventListener('change',weekwiseRuntime.updateHabitFrequencyVisibility);
weekwiseRuntime.$('cancelHabitEdit').addEventListener('click',weekwiseRuntime.habitFormReset);
weekwiseRuntime.$('habitTrackerList').addEventListener('click',e=>{
 const skip=e.target.closest('[data-habit-skip]');if(skip){weekwiseRuntime.skipHabitToday(skip.dataset.habitSkip);return;}const check=e.target.closest('[data-habit-check]');if(check){weekwiseRuntime.toggleHabitCheck(check.dataset.habitCheck,check.dataset.habitDate);return;}
 const edit=e.target.closest('[data-habit-edit]');if(edit){weekwiseRuntime.editHabit(edit.dataset.habitEdit);return;}
 const del=e.target.closest('[data-habit-delete]');if(del)weekwiseRuntime.deleteHabit(del.dataset.habitDelete);
});
}

function renderKanbanBoard(){
 const board=weekwiseRuntime.$('kanbanBoard');if(!board)return;
 const groups={'todo':[],'in-progress':[],'done':[]};
 weekwiseRuntime.workspaceRecords().forEach(record=>groups[weekwiseRuntime.taskBoardStatus(record.task)].push(record));
 [['todo','kanbanListTodo','kanbanCountTodo'],['in-progress','kanbanListProgress','kanbanCountProgress'],['done','kanbanListDone','kanbanCountDone']].forEach(([status,listId,countId])=>{
  const list=weekwiseRuntime.$(listId),count=weekwiseRuntime.$(countId),items=groups[status].sort((a,b)=>a.date-b.date||(a.task.start==null?1:b.task.start==null?-1:Number(a.task.start)-Number(b.task.start)));
  if(count)count.textContent=String(items.length);
  const page=weekwiseRuntime.listPage('board:'+status,items);if(list)list.innerHTML=items.length?page.records.map(weekwiseRuntime.renderKanbanCard).join('')+weekwiseRuntime.listPageFooter(page):'<div class="kanban-empty">No tasks in this column.</div>';
 });
}

function updateBoardTaskStatus(id,week,status){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 if(!['todo','in-progress','done'].includes(status))return;
 let item=null;
 if(week!==weekwiseRuntime.currentWeek){const saved=weekwiseRuntime.store.weeks[week];item=Array.isArray(saved?.tasks)?saved.tasks.find(t=>t.id===id):null;if(!item)return;item.status=status;item.done=status==='done';weekwiseRuntime.saveStore();}
 else{item=weekwiseRuntime.tasks.find(t=>t.id===id);if(!item)return;item.status=status;item.done=status==='done';weekwiseRuntime.saveCurrent();}
 weekwiseRuntime.renderAll();
}

function savedFilterMatches(record,filter){
 const t=record.task;
 if(filter.query&&!([t.title,t.note].join(' ').toLowerCase().includes(filter.query.toLowerCase())))return false;
 const scheduled=!!t.allDay||t.start!=null&&!t.unscheduled;
 if(filter.schedule==='scheduled'&&!scheduled||filter.schedule==='unscheduled'&&scheduled)return false;
 if(filter.listId&&filter.listId!=='all'&&record.listId!==filter.listId)return false;
 const priority=t.priority||'none';
 if(filter.priority&&filter.priority!=='all'&&priority!==filter.priority)return false;
 const status=t.done||t.status==='done'?'done':(t.status==='in-progress'?'in-progress':'todo');
 if(filter.status&&filter.status!=='all'&&status!==filter.status)return false;
 const today=weekwiseRuntime.dateKey(weekwiseRuntime.now),due=t.dueDate||'';
 if(filter.due==='overdue'&&(!due||due>=today||status==='done'))return false;
 if(filter.due==='7days'&&(!due||due<today||due>weekwiseRuntime.addDaysToKey(today,7)))return false;
 if(filter.due==='30days'&&(!due||due<today||due>weekwiseRuntime.addDaysToKey(today,30)))return false;
 if(filter.due==='no-date'&&due)return false;
 if(filter.tag){
  const tags=Array.isArray(t.tags)?t.tags:[];
  if(!tags.some(tag=>String(tag).toLowerCase().includes(String(filter.tag).toLowerCase())))return false;
 }
 return true;
}

function readFilterDraft(){return {title:weekwiseRuntime.$('filterName').value.trim(),listId:weekwiseRuntime.$('filterList').value,priority:weekwiseRuntime.$('filterPriority').value,status:weekwiseRuntime.$('filterStatus').value,due:weekwiseRuntime.$('filterDue').value,tag:weekwiseRuntime.$('filterTag').value.trim().replace(/^#/,'').toLowerCase(),query:weekwiseRuntime.$('filterQuery').value.trim(),schedule:weekwiseRuntime.$('filterSchedule').value,sort:weekwiseRuntime.$('filterSort').value};}
function previewFilterDraft(){const draft=readFilterDraft(),count=weekwiseRuntime.workspaceRecords().filter(record=>savedFilterMatches(record,draft)).length;weekwiseRuntime.$('filterLiveCount').textContent=count+' matching '+(count===1?'task':'tasks')+' · preview only';}
function resetFilterForm(){weekwiseRuntime.$('savedFilterForm').reset();weekwiseRuntime.$('filterEditId').value='';delete weekwiseRuntime.$('savedFilterForm').dataset.base;weekwiseRuntime.$('saveFilterBtn').textContent='Save filter';previewFilterDraft();}
function editSavedFilter(id){const filter=weekwiseRuntime.savedTaskFilters.find(item=>item.id===id);if(!filter)return;weekwiseRuntime.$('filterEditId').value=id;weekwiseRuntime.$('savedFilterForm').dataset.base=JSON.stringify(filter);for(const [field,value]of Object.entries({filterName:filter.title,filterList:filter.listId||'all',filterPriority:filter.priority||'all',filterStatus:filter.status||'all',filterDue:filter.due||'all',filterTag:filter.tag||'',filterQuery:filter.query||'',filterSchedule:filter.schedule||'all',filterSort:filter.sort||'date'}))weekwiseRuntime.$(field).value=value;weekwiseRuntime.$('saveFilterBtn').textContent='Save changes';previewFilterDraft();weekwiseRuntime.$('filterName').focus();}
function sortFilterRecords(records,sort){const ranks={high:0,medium:1,low:2,none:3};return records.sort((a,b)=>sort==='title'?a.task.title.localeCompare(b.task.title):sort==='priority'?(ranks[a.task.priority||'none']??3)-(ranks[b.task.priority||'none']??3)||a.date-b.date:sort==='due'?String(a.task.dueDate||'9999-12-31').localeCompare(String(b.task.dueDate||'9999-12-31')):a.date-b.date||(a.task.start==null?1:b.task.start==null?-1:Number(a.task.start)-Number(b.task.start)));}
function renderSavedFilters(){
 const list=weekwiseRuntime.$('savedFilterList'),results=weekwiseRuntime.$('savedFilterResults');
 if(!list||!results)return;
 const form=weekwiseRuntime.$('savedFilterForm');if(form.dataset.owner!==weekwiseRuntime.currentDataOwner){form.dataset.owner=weekwiseRuntime.currentDataOwner;resetFilterForm();}previewFilterDraft();
 const active=weekwiseRuntime.savedTaskFilters.find(filter=>filter.id===weekwiseRuntime.activeSavedFilterId)||null;
 weekwiseRuntime.$('savedFilterCount').textContent=String(weekwiseRuntime.savedTaskFilters.length);
 list.innerHTML=weekwiseRuntime.savedTaskFilters.length?weekwiseRuntime.savedTaskFilters.map(filter=>{
  const count=weekwiseRuntime.workspaceRecords().filter(record=>weekwiseRuntime.savedFilterMatches(record,filter)).length;
  return '<div class="saved-filter-choice-wrap"><button type="button" class="saved-filter-choice '+(active&&active.id===filter.id?'active':'')+'" data-filter-open="'+weekwiseRuntime.escapeHtml(filter.id)+'"><span>'+weekwiseRuntime.escapeHtml(filter.title)+'</span><span>'+count+'</span></button><button type="button" class="saved-filter-edit" data-filter-edit="'+weekwiseRuntime.escapeHtml(filter.id)+'" aria-label="Edit '+weekwiseRuntime.escapeHtml(filter.title)+'">Edit</button><button type="button" class="saved-filter-delete" data-filter-delete="'+weekwiseRuntime.escapeHtml(filter.id)+'" aria-label="Delete '+weekwiseRuntime.escapeHtml(filter.title)+'">×</button></div>';
 }).join(''):'<div class="saved-filter-empty">Build your first filter above.</div>';
 if(!active){
  weekwiseRuntime.$('activeFilterTitle').textContent='Choose a filter';
  weekwiseRuntime.$('activeFilterDescription').textContent='Save a filter above, then select it to see matching tasks.';
  weekwiseRuntime.$('activeFilterResultCount').textContent='0 tasks';
  results.innerHTML='<div class="workspace-empty"><div><div class="workspace-empty-icon">⏷</div><h3>No filter selected</h3><p>Combine due dates, status, priority, list and tags.</p></div></div>';
  return;
 }
 const records=sortFilterRecords(weekwiseRuntime.workspaceRecords().filter(record=>weekwiseRuntime.savedFilterMatches(record,active)),active.sort||'date');
 const description=[];
 if(active.listId!=='all')description.push(active.listId);
 if(active.priority!=='all')description.push(active.priority+' priority');
 if(active.status!=='all')description.push(active.status.replace('-',' '));
 if(active.due!=='all')description.push(active.due);
 if(active.tag)description.push('#'+active.tag);if(active.query)description.push('Contains '+active.query);if(active.schedule&&active.schedule!=='all')description.push(active.schedule);
 weekwiseRuntime.$('activeFilterTitle').textContent=active.title;
 weekwiseRuntime.$('activeFilterDescription').textContent=description.length?description.join(' · '):'All tasks';
 weekwiseRuntime.$('activeFilterResultCount').textContent=records.length+' task'+(records.length===1?'':'s');
 const page=weekwiseRuntime.listPage('filter:'+active.id,records);results.innerHTML=records.length?page.records.map(weekwiseRuntime.workspaceTaskRow).join('')+weekwiseRuntime.listPageFooter(page):'<div class="workspace-empty"><div><div class="workspace-empty-icon">✓</div><h3>No matching tasks</h3><p>Try changing the criteria or update a task’s details.</p></div></div>';
}

function saveFilterForm(e){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 e.preventDefault();
 const title=weekwiseRuntime.$('filterName').value.trim();
 if(!title){weekwiseRuntime.$('filterName').focus();return;}
 const editId=weekwiseRuntime.$('filterEditId').value,existing=weekwiseRuntime.savedTaskFilters.find(filter=>filter.id===editId);
 if(editId&&(!existing||JSON.stringify(existing)!==weekwiseRuntime.$('savedFilterForm').dataset.base)){weekwiseRuntime.showToast('This filter changed. Choose Edit again before saving.');return;}
 const filter={...existing,...readFilterDraft(),id:editId||'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(existing)weekwiseRuntime.savedTaskFilters=weekwiseRuntime.savedTaskFilters.map(item=>item.id===editId?filter:item);else weekwiseRuntime.savedTaskFilters.push(filter);weekwiseRuntime.activeSavedFilterId=filter.id;
 weekwiseRuntime.checkedCollectionSave(weekwiseRuntime.TASK_FILTERS_KEY,weekwiseRuntime.savedTaskFilters,value=>weekwiseRuntime.savedTaskFilters=value);
 resetFilterForm();
 weekwiseRuntime.renderSavedFilters();weekwiseRuntime.showToast('Filter saved');
}

function deleteSavedFilter(id){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const filter=weekwiseRuntime.savedTaskFilters.find(item=>item.id===id);if(!filter)return;
 if(!confirm('Delete saved filter "'+filter.title+'"?'))return;
 weekwiseRuntime.savedTaskFilters=weekwiseRuntime.savedTaskFilters.filter(item=>item.id!==id);
 if(weekwiseRuntime.activeSavedFilterId===id)weekwiseRuntime.activeSavedFilterId='';
 weekwiseRuntime.checkedCollectionSave(weekwiseRuntime.TASK_FILTERS_KEY,weekwiseRuntime.savedTaskFilters,value=>weekwiseRuntime.savedTaskFilters=value);
 if(!weekwiseRuntime.cloudApplyingRemote)weekwiseRuntime.queueCloudSave();
 weekwiseRuntime.renderSavedFilters();weekwiseRuntime.showToast('Filter deleted');
}

function renderTaskNotificationSettings(){
 const button=weekwiseRuntime.$('enableTaskNotificationsBtn'),status=weekwiseRuntime.$('taskNotificationStatus');if(!button||!status)return;
 if(!('Notification' in window)){button.disabled=true;button.textContent='Not supported';status.textContent='This browser does not support desktop notifications. In-app task alerts still appear while Weekwise is open.';return;}
 const permission=Notification.permission;
 if(permission==='granted'){button.disabled=true;button.textContent='Browser alerts enabled';status.textContent='Browser notifications are enabled. Scheduled task reminders can show a system alert while Weekwise is running.';}
 else if(permission==='denied'){button.disabled=true;button.textContent='Permission blocked';status.textContent='Browser alerts are blocked by this site. Change Weekwise notification permissions in browser settings; in-app alerts still work while it is open.';}
 else{button.disabled=false;button.textContent='Enable browser alerts';status.textContent='Task alerts can appear while Weekwise is open. Allow browser notifications for system-level alerts.';}
}

function deleteCustomList(id){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 const list=(weekwiseRuntime.store.customLists||[]).find(item=>item.id===id);if(!list)return;
 if(!confirm('Delete the list "'+list.name+'"? Its tasks will be moved to Inbox, not deleted.'))return;
 weekwiseRuntime.workspaceRecords().forEach(record=>{
  if(record.task.listId===id){record.task.listId='inbox';if(record.task.folderName===list.name)record.task.folderName='Inbox';record.task.sectionName='';}
 });
 (weekwiseRuntime.store.recurringTemplates||[]).forEach(template=>{if(template.listId===id){template.listId='inbox';if(template.folderName===list.name)template.folderName='Inbox';template.sectionName='';}});
 if(Array.isArray(weekwiseRuntime.savedTaskFilters))weekwiseRuntime.savedTaskFilters.forEach(filter=>{if(filter.listId===id)filter.listId='inbox';});
 weekwiseRuntime.store.customLists=weekwiseRuntime.store.customLists.filter(item=>item.id!==id);
 if(weekwiseRuntime.workspaceView==='list-'+id){weekwiseRuntime.workspaceView='inbox';try{localStorage.setItem('weekwise-workspace-view-v1','inbox');}catch(_){}}
 weekwiseRuntime.syncWorkspaceLists();weekwiseRuntime.saveCurrent();weekwiseRuntime.saveStore();
 try{localStorage.setItem(weekwiseRuntime.TASK_FILTERS_KEY,JSON.stringify(weekwiseRuntime.savedTaskFilters||[]));}catch(_){}
 if(!weekwiseRuntime.cloudApplyingRemote)weekwiseRuntime.queueCloudSave();
 weekwiseRuntime.renderAll();weekwiseRuntime.renderWorkspaceView();weekwiseRuntime.showToast('List deleted. Its tasks are in Inbox.');
}

function renderTaskTemplateOptions(){
 const select=weekwiseRuntime.$('taskTemplateSelect');if(!select)return;
 const prior=select.value;
 select.innerHTML='<option value="">Choose a saved template…</option>'+weekwiseRuntime.taskTemplates.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(t=>'<option value="'+weekwiseRuntime.escapeHtml(t.id)+'">'+weekwiseRuntime.escapeHtml(t.name)+'</option>').join('');
 if(weekwiseRuntime.taskTemplates.some(t=>t.id===prior))select.value=prior;
 weekwiseRuntime.$('taskTemplateCount').textContent=weekwiseRuntime.taskTemplates.length+' saved';
 weekwiseRuntime.$('deleteTaskTemplateBtn').disabled=!select.value;
}
return Object.freeze({syncWorkspaceListOptions,renderWorkspaceCustomLists,syncWorkspaceLists,workspaceRecords,workspaceFolderSummary,renderWorkspaceFolders,workspaceTagSummary,renderWorkspaceTags,workspaceRecordMatches,workspacePriorityValue,workspaceDateLabel,workspaceTaskRow,updateWorkspaceCounts,renderWorkspaceTaskGroups,experienceData,renderExperience,renderTodayOverview,listPage,listPageFooter,renderWorkspaceTasks,renderWorkspaceView,setWorkspaceView,openWorkspaceRecord,updateWorkspaceRecord,wireWorkspaceControls,renderKanbanBoard,updateBoardTaskStatus,savedFilterMatches,renderSavedFilters,saveFilterForm,deleteSavedFilter,renderTaskNotificationSettings,deleteCustomList,renderTaskTemplateOptions});
}
root.WeekwiseAppWorkspace=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
