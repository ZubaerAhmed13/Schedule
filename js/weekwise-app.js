(()=>{
'use strict';
// Shared state stays private to this startup scope. Components use explicit live accessors.
const weekwiseRuntime={
 get $(){return $;},
 get ACTIVITY_SUGGESTIONS(){return ACTIVITY_SUGGESTIONS;},
 get ACTIVITY_TEMPLATE_PRESETS(){return ACTIVITY_TEMPLATE_PRESETS;},
 get BUILTIN_WORKSPACE_LISTS(){return BUILTIN_WORKSPACE_LISTS;},
 get CLOUD_META_KEY(){return CLOUD_META_KEY;},
 get COUNTDOWNS_KEY(){return COUNTDOWNS_KEY;},
 get DAY_NAMES(){return DAY_NAMES;},
 get DAY_SHORT(){return DAY_SHORT;},
 get FOCUS_SESSIONS_KEY(){return FOCUS_SESSIONS_KEY;},
 get HABITS_KEY(){return HABITS_KEY;},
 get REMINDERS_KEY(){return REMINDERS_KEY;},
 get STORE_KEY(){return STORE_KEY;},
 get TASK_FILTERS_KEY(){return TASK_FILTERS_KEY;},
 get TASK_TEMPLATES_KEY(){return TASK_TEMPLATES_KEY;},
 get TYPE_LABELS(){return TYPE_LABELS;},
 get WORKSPACE_LISTS(){return WORKSPACE_LISTS;}, set WORKSPACE_LISTS(value){WORKSPACE_LISTS=value;},
 get WORKSPACE_VIEW_INFO(){return WORKSPACE_VIEW_INFO;},
 get activeSavedFilterId(){return activeSavedFilterId;}, set activeSavedFilterId(value){activeSavedFilterId=value;},
 get activeUtilityPanel(){return activeUtilityPanel;}, set activeUtilityPanel(value){activeUtilityPanel=value;},
 get activeVoiceRecognition(){return activeVoiceRecognition;}, set activeVoiceRecognition(value){activeVoiceRecognition=value;},
 get addCapturedTaskForDate(){return addCapturedTaskForDate;}, set addCapturedTaskForDate(value){addCapturedTaskForDate=value;},
 get addDaysForView(){return addDaysForView;}, set addDaysForView(value){addDaysForView=value;},
 get addDaysToKey(){return addDaysToKey;}, set addDaysToKey(value){addDaysToKey=value;},
 get addQuick(){return addQuick;}, set addQuick(value){addQuick=value;},
 get agendaAnchor(){return agendaAnchor;}, set agendaAnchor(value){agendaAnchor=value;},
 get analyticsGroup(){return analyticsGroup;}, set analyticsGroup(value){analyticsGroup=value;},
 get applyCloudRow(){return applyCloudRow;}, set applyCloudRow(value){applyCloudRow=value;},
 get applySelectedTaskTemplate(){return applySelectedTaskTemplate;}, set applySelectedTaskTemplate(value){applySelectedTaskTemplate=value;},
 get applyThemePreference(){return applyThemePreference;}, set applyThemePreference(value){applyThemePreference=value;},
 get buildCloudPayload(){return buildCloudPayload;}, set buildCloudPayload(value){buildCloudPayload=value;},
 get calendarView(){return calendarView;}, set calendarView(value){calendarView=value;},
 get calendarYear(){return calendarYear;}, set calendarYear(value){calendarYear=value;},
 get canPlace(){return canPlace;}, set canPlace(value){canPlace=value;},
 get categoryClass(){return categoryClass;}, set categoryClass(value){categoryClass=value;},
 get checkCloudForRemoteChanges(){return checkCloudForRemoteChanges;}, set checkCloudForRemoteChanges(value){checkCloudForRemoteChanges=value;},
 get checkTaskReminders(){return checkTaskReminders;}, set checkTaskReminders(value){checkTaskReminders=value;},
 get checkedCollectionSave(){return checkedCollectionSave;}, set checkedCollectionSave(value){checkedCollectionSave=value;},
 get checkpointEditorDraft(){return checkpointEditorDraft;}, set checkpointEditorDraft(value){checkpointEditorDraft=value;},
 get chooseActivityTemplate(){return chooseActivityTemplate;}, set chooseActivityTemplate(value){chooseActivityTemplate=value;},
 get clearActivityTemplateSelection(){return clearActivityTemplateSelection;}, set clearActivityTemplateSelection(value){clearActivityTemplateSelection=value;},
 get closeTaskModal(){return closeTaskModal;}, set closeTaskModal(value){closeTaskModal=value;},
 get closeTemplateEditor(){return closeTemplateEditor;}, set closeTemplateEditor(value){closeTemplateEditor=value;},
 get closeUtilityPanel(){return closeUtilityPanel;}, set closeUtilityPanel(value){closeUtilityPanel=value;},
 get cloudApplyingRemote(){return cloudApplyingRemote;}, set cloudApplyingRemote(value){cloudApplyingRemote=value;},
 get cloudAuthBusy(){return cloudAuthBusy;}, set cloudAuthBusy(value){cloudAuthBusy=value;},
 get cloudAuthMode(){return cloudAuthMode;}, set cloudAuthMode(value){cloudAuthMode=value;},
 get cloudBusy(){return cloudBusy;}, set cloudBusy(value){cloudBusy=value;},
 get cloudClient(){return cloudClient;}, set cloudClient(value){cloudClient=value;},
 get cloudConflict(){return cloudConflict;}, set cloudConflict(value){cloudConflict=value;},
 get cloudFingerprint(){return cloudFingerprint;}, set cloudFingerprint(value){cloudFingerprint=value;},
 get cloudInitPromise(){return cloudInitPromise;}, set cloudInitPromise(value){cloudInitPromise=value;},
 get cloudInitializationUser(){return cloudInitializationUser;}, set cloudInitializationUser(value){cloudInitializationUser=value;},
 get cloudReady(){return cloudReady;}, set cloudReady(value){cloudReady=value;},
 get cloudResetPassword(){return cloudResetPassword;}, set cloudResetPassword(value){cloudResetPassword=value;},
 get cloudRevision(){return cloudRevision;}, set cloudRevision(value){cloudRevision=value;},
 get cloudSessionEpoch(){return cloudSessionEpoch;}, set cloudSessionEpoch(value){cloudSessionEpoch=value;},
 get cloudSignIn(){return cloudSignIn;}, set cloudSignIn(value){cloudSignIn=value;},
 get cloudSignUp(){return cloudSignUp;}, set cloudSignUp(value){cloudSignUp=value;},
 get cloudSyncNow(){return cloudSyncNow;}, set cloudSyncNow(value){cloudSyncNow=value;},
 get cloudSyncTimer(){return cloudSyncTimer;}, set cloudSyncTimer(value){cloudSyncTimer=value;},
 get cloudUpdatePassword(){return cloudUpdatePassword;}, set cloudUpdatePassword(value){cloudUpdatePassword=value;},
 get cloudUseLocal(){return cloudUseLocal;}, set cloudUseLocal(value){cloudUseLocal=value;},
 get cloudUseRemote(){return cloudUseRemote;}, set cloudUseRemote(value){cloudUseRemote=value;},
 get cloudUser(){return cloudUser;}, set cloudUser(value){cloudUser=value;},
 get copyTaskPlanningPrompt(){return copyTaskPlanningPrompt;}, set copyTaskPlanningPrompt(value){copyTaskPlanningPrompt=value;},
 get countdownDays(){return countdownDays;}, set countdownDays(value){countdownDays=value;},
 get countdownWords(){return countdownWords;}, set countdownWords(value){countdownWords=value;},
 get countdowns(){return countdowns;}, set countdowns(value){countdowns=value;},
 get createCustomList(){return createCustomList;}, set createCustomList(value){createCustomList=value;},
 get createTask(){return createTask;}, set createTask(value){createTask=value;},
 get currentDataOwner(){return currentDataOwner;}, set currentDataOwner(value){currentDataOwner=value;},
 get currentDayHasConfiguredShift(){return currentDayHasConfiguredShift;}, set currentDayHasConfiguredShift(value){currentDayHasConfiguredShift=value;},
 get currentWeek(){return currentWeek;}, set currentWeek(value){currentWeek=value;},
 get dataCanWrite(){return dataCanWrite;}, set dataCanWrite(value){dataCanWrite=value;},
 get dateKey(){return dateKey;}, set dateKey(value){dateKey=value;},
 get dateOnly(){return dateOnly;}, set dateOnly(value){dateOnly=value;},
 get dayDate(){return dayDate;}, set dayDate(value){dayDate=value;},
 get defaultCaptureList(){return defaultCaptureList;}, set defaultCaptureList(value){defaultCaptureList=value;},
 get defaultClassTemplate(){return defaultClassTemplate;}, set defaultClassTemplate(value){defaultClassTemplate=value;},
 get defaultFolderName(){return defaultFolderName;}, set defaultFolderName(value){defaultFolderName=value;},
 get defaultSettings(){return defaultSettings;}, set defaultSettings(value){defaultSettings=value;},
 get deleteCountdown(){return deleteCountdown;}, set deleteCountdown(value){deleteCountdown=value;},
 get deleteCustomList(){return deleteCustomList;}, set deleteCustomList(value){deleteCustomList=value;},
 get deleteHabit(){return deleteHabit;}, set deleteHabit(value){deleteHabit=value;},
 get deleteSavedFilter(){return deleteSavedFilter;}, set deleteSavedFilter(value){deleteSavedFilter=value;},
 get deleteSelectedTaskTemplate(){return deleteSelectedTaskTemplate;}, set deleteSelectedTaskTemplate(value){deleteSelectedTaskTemplate=value;},
 get draftFields(){return draftFields;}, set draftFields(value){draftFields=value;},
 get durationLabel(){return durationLabel;}, set durationLabel(value){durationLabel=value;},
 get durationText(){return durationText;}, set durationText(value){durationText=value;},
 get editCountdown(){return editCountdown;}, set editCountdown(value){editCountdown=value;},
 get editHabit(){return editHabit;}, set editHabit(value){editHabit=value;},
 get editorSession(){return editorSession;}, set editorSession(value){editorSession=value;},
 get enableTaskNotifications(){return enableTaskNotifications;}, set enableTaskNotifications(value){enableTaskNotifications=value;},
 get ensureFocusState(){return ensureFocusState;}, set ensureFocusState(value){ensureFocusState=value;},
 get escapeHtml(){return escapeHtml;}, set escapeHtml(value){escapeHtml=value;},
 get escapeICSText(){return escapeICSText;}, set escapeICSText(value){escapeICSText=value;},
 get experienceData(){return experienceData;}, set experienceData(value){experienceData=value;},
 get exportBackup(){return exportBackup;}, set exportBackup(value){exportBackup=value;},
 get exportCalendarICS(){return exportCalendarICS;}, set exportCalendarICS(value){exportCalendarICS=value;},
 get exportCurrentTaskList(){return exportCurrentTaskList;}, set exportCurrentTaskList(value){exportCurrentTaskList=value;},
 get exportEditorHistory(){return exportEditorHistory;}, set exportEditorHistory(value){exportEditorHistory=value;},
 get findSlot(){return findSlot;}, set findSlot(value){findSlot=value;},
 get finishSignInLanding(){return finishSignInLanding;}, set finishSignInLanding(value){finishSignInLanding=value;},
 get fmtDate(){return fmtDate;}, set fmtDate(value){fmtDate=value;},
 get focusComplete(){return focusComplete;}, set focusComplete(value){focusComplete=value;},
 get focusInterval(){return focusInterval;}, set focusInterval(value){focusInterval=value;},
 get focusOwner(){return focusOwner;}, set focusOwner(value){focusOwner=value;},
 get focusPickerIndex(){return focusPickerIndex;}, set focusPickerIndex(value){focusPickerIndex=value;},
 get focusPickerOwner(){return focusPickerOwner;}, set focusPickerOwner(value){focusPickerOwner=value;},
 get focusPickerPage(){return focusPickerPage;}, set focusPickerPage(value){focusPickerPage=value;},
 get focusPickerTimer(){return focusPickerTimer;}, set focusPickerTimer(value){focusPickerTimer=value;},
 get focusReset(){return focusReset;}, set focusReset(value){focusReset=value;},
 get focusSessions(){return focusSessions;}, set focusSessions(value){focusSessions=value;},
 get focusStartPause(){return focusStartPause;}, set focusStartPause(value){focusStartPause=value;},
 get focusState(){return focusState;}, set focusState(value){focusState=value;},
 get focusStateKey(){return focusStateKey;}, set focusStateKey(value){focusStateKey=value;},
 get focusTakeBreak(){return focusTakeBreak;}, set focusTakeBreak(value){focusTakeBreak=value;},
 get focusTick(){return focusTick;}, set focusTick(value){focusTick=value;},
 get formatTime(){return formatTime;}, set formatTime(value){formatTime=value;},
 get freshFocus(){return freshFocus;}, set freshFocus(value){freshFocus=value;},
 get habitCountThisWeek(){return habitCountThisWeek;}, set habitCountThisWeek(value){habitCountThisWeek=value;},
 get habitFormReset(){return habitFormReset;}, set habitFormReset(value){habitFormReset=value;},
 get habitHistoryDots(){return habitHistoryDots;}, set habitHistoryDots(value){habitHistoryDots=value;},
 get habitStreak(){return habitStreak;}, set habitStreak(value){habitStreak=value;},
 get habitWeekKeys(){return habitWeekKeys;}, set habitWeekKeys(value){habitWeekKeys=value;},
 get habitWeekRange(){return habitWeekRange;}, set habitWeekRange(value){habitWeekRange=value;},
 get habits(){return habits;}, set habits(value){habits=value;},
 get hideActivitySuggestions(){return hideActivitySuggestions;}, set hideActivitySuggestions(value){hideActivitySuggestions=value;},
 get icsUtcDateTime(){return icsUtcDateTime;}, set icsUtcDateTime(value){icsUtcDateTime=value;},
 get importCalendarICS(){return importCalendarICS;}, set importCalendarICS(value){importCalendarICS=value;},
 get importSharedTaskList(){return importSharedTaskList;}, set importSharedTaskList(value){importSharedTaskList=value;},
 get inferredListId(){return inferredListId;}, set inferredListId(value){inferredListId=value;},
 get initializeCloud(){return initializeCloud;}, set initializeCloud(value){initializeCloud=value;},
 get isolatePlannerOwner(){return isolatePlannerOwner;}, set isolatePlannerOwner(value){isolatePlannerOwner=value;},
 get lastRenderedCalendarView(){return lastRenderedCalendarView;}, set lastRenderedCalendarView(value){lastRenderedCalendarView=value;},
 get lastSavedDisk(){return lastSavedDisk;}, set lastSavedDisk(value){lastSavedDisk=value;},
 get lastSavedStore(){return lastSavedStore;}, set lastSavedStore(value){lastSavedStore=value;},
 get listPage(){return listPage;}, set listPage(value){listPage=value;},
 get listPageFooter(){return listPageFooter;}, set listPageFooter(value){listPageFooter=value;},
 get loadImport(){return loadImport;}, set loadImport(value){loadImport=value;},
 get loadWeek(){return loadWeek;}, set loadWeek(value){loadWeek=value;},
 get localHasWeekwiseData(){return localHasWeekwiseData;}, set localHasWeekwiseData(value){localHasWeekwiseData=value;},
 get materializeCurrentAndUpcoming(){return materializeCurrentAndUpcoming;}, set materializeCurrentAndUpcoming(value){materializeCurrentAndUpcoming=value;},
 get materializeRecurringRange(){return materializeRecurringRange;}, set materializeRecurringRange(value){materializeRecurringRange=value;},
 get minsTime(){return minsTime;}, set minsTime(value){minsTime=value;},
 get mobileDay(){return mobileDay;}, set mobileDay(value){mobileDay=value;},
 get monthAnchor(){return monthAnchor;}, set monthAnchor(value){monthAnchor=value;},
 get moveTask(){return moveTask;}, set moveTask(value){moveTask=value;},
 get nextQuarterHour(){return nextQuarterHour;}, set nextQuarterHour(value){nextQuarterHour=value;},
 get normalizeEndTimeField(){return normalizeEndTimeField;}, set normalizeEndTimeField(value){normalizeEndTimeField=value;},
 get normalizeTimeField(){return normalizeTimeField;}, set normalizeTimeField(value){normalizeTimeField=value;},
 get now(){return now;}, set now(value){now=value;},
 get nudgeDueReminders(){return nudgeDueReminders;}, set nudgeDueReminders(value){nudgeDueReminders=value;},
 get offlineAccountSelected(){return offlineAccountSelected;}, set offlineAccountSelected(value){offlineAccountSelected=value;},
 get openCloudPanel(){return openCloudPanel;}, set openCloudPanel(value){openCloudPanel=value;},
 get openDashboard(){return openDashboard;}, set openDashboard(value){openDashboard=value;},
 get openFixedSettings(){return openFixedSettings;}, set openFixedSettings(value){openFixedSettings=value;},
 get openReminderTask(){return openReminderTask;}, set openReminderTask(value){openReminderTask=value;},
 get openReminders(){return openReminders;}, set openReminders(value){openReminders=value;},
 get openSignInFromLanding(){return openSignInFromLanding;}, set openSignInFromLanding(value){openSignInFromLanding=value;},
 get openTaskModal(){return openTaskModal;}, set openTaskModal(value){openTaskModal=value;},
 get openTemplateEditor(){return openTemplateEditor;}, set openTemplateEditor(value){openTemplateEditor=value;},
 get openUtilityPanel(){return openUtilityPanel;}, set openUtilityPanel(value){openUtilityPanel=value;},
 get openWorkspaceRecord(){return openWorkspaceRecord;}, set openWorkspaceRecord(value){openWorkspaceRecord=value;},
 get overlap(){return overlap;}, set overlap(value){overlap=value;},
 get parseICSDateProperty(){return parseICSDateProperty;}, set parseICSDateProperty(value){parseICSDateProperty=value;},
 get parseICSProperties(){return parseICSProperties;}, set parseICSProperties(value){parseICSProperties=value;},
 get parseKey(){return parseKey;}, set parseKey(value){parseKey=value;},
 get parseTaskAttachmentInput(){return parseTaskAttachmentInput;}, set parseTaskAttachmentInput(value){parseTaskAttachmentInput=value;},
 get parseWeekwiseNaturalCapture(){return parseWeekwiseNaturalCapture;}, set parseWeekwiseNaturalCapture(value){parseWeekwiseNaturalCapture=value;},
 get pendingCalendarSlot(){return pendingCalendarSlot;}, set pendingCalendarSlot(value){pendingCalendarSlot=value;},
 get persistActiveFocus(){return persistActiveFocus;}, set persistActiveFocus(value){persistActiveFocus=value;},
 get persistCountdowns(){return persistCountdowns;}, set persistCountdowns(value){persistCountdowns=value;},
 get persistHabits(){return persistHabits;}, set persistHabits(value){persistHabits=value;},
 get persistTaskTemplates(){return persistTaskTemplates;}, set persistTaskTemplates(value){persistTaskTemplates=value;},
 get plannerSnapshot(){return plannerSnapshot;}, set plannerSnapshot(value){plannerSnapshot=value;},
 get plannerStorageBlocked(){return plannerStorageBlocked;}, set plannerStorageBlocked(value){plannerStorageBlocked=value;},
 get plannerStorageError(){return plannerStorageError;}, set plannerStorageError(value){plannerStorageError=value;},
 get populateDaySelects(){return populateDaySelects;}, set populateDaySelects(value){populateDaySelects=value;},
 get queueCloudSave(){return queueCloudSave;}, set queueCloudSave(value){queueCloudSave=value;},
 get reconnectAccount(){return reconnectAccount;}, set reconnectAccount(value){reconnectAccount=value;},
 get quickCaptureWorkspaceTask(){return quickCaptureWorkspaceTask;}, set quickCaptureWorkspaceTask(value){quickCaptureWorkspaceTask=value;},
 get readCloudMeta(){return readCloudMeta;}, set readCloudMeta(value){readCloudMeta=value;},
 get readModalTaskTemplate(){return readModalTaskTemplate;}, set readModalTaskTemplate(value){readModalTaskTemplate=value;},
 get reconcileSplitTasks(){return reconcileSplitTasks;}, set reconcileSplitTasks(value){reconcileSplitTasks=value;},
 get recordsForListTransfer(){return recordsForListTransfer;}, set recordsForListTransfer(value){recordsForListTransfer=value;},
 get recurrenceDateMatches(){return recurrenceDateMatches;}, set recurrenceDateMatches(value){recurrenceDateMatches=value;},
 get reminderDelete(){return reminderDelete;}, set reminderDelete(value){reminderDelete=value;},
 get reminderDueOpen(){return reminderDueOpen;}, set reminderDueOpen(value){reminderDueOpen=value;},
 get reminderEdit(){return reminderEdit;}, set reminderEdit(value){reminderEdit=value;},
 get reminderFormReset(){return reminderFormReset;}, set reminderFormReset(value){reminderFormReset=value;},
 get reminderSave(){return reminderSave;}, set reminderSave(value){reminderSave=value;},
 get reminderState(){return reminderState;}, set reminderState(value){reminderState=value;},
 get reminderTodayKey(){return reminderTodayKey;}, set reminderTodayKey(value){reminderTodayKey=value;},
 get reminderToggleDone(){return reminderToggleDone;}, set reminderToggleDone(value){reminderToggleDone=value;},
 get reminderTogglePin(){return reminderTogglePin;}, set reminderTogglePin(value){reminderTogglePin=value;},
 get reminders(){return reminders;}, set reminders(value){reminders=value;},
 get renameCustomList(){return renameCustomList;}, set renameCustomList(value){renameCustomList=value;},
 get renderActivitySuggestions(){return renderActivitySuggestions;}, set renderActivitySuggestions(value){renderActivitySuggestions=value;},
 get renderAll(){return renderAll;}, set renderAll(value){renderAll=value;},
 get renderCloudPanel(){return renderCloudPanel;}, set renderCloudPanel(value){renderCloudPanel=value;},
 get renderCountdowns(){return renderCountdowns;}, set renderCountdowns(value){renderCountdowns=value;},
 get renderDays(){return renderDays;}, set renderDays(value){renderDays=value;},
 get renderDraftNotice(){return renderDraftNotice;}, set renderDraftNotice(value){renderDraftNotice=value;},
 get renderExperience(){return renderExperience;}, set renderExperience(value){renderExperience=value;},
 get renderFocusPanel(){return renderFocusPanel;}, set renderFocusPanel(value){renderFocusPanel=value;},
 get renderHabitSummaries(){return renderHabitSummaries;}, set renderHabitSummaries(value){renderHabitSummaries=value;},
 get renderHabitTracker(){return renderHabitTracker;}, set renderHabitTracker(value){renderHabitTracker=value;},
 get renderKanbanBoard(){return renderKanbanBoard;}, set renderKanbanBoard(value){renderKanbanBoard=value;},
 get renderKanbanCard(){return renderKanbanCard;}, set renderKanbanCard(value){renderKanbanCard=value;},
 get renderMatrixTask(){return renderMatrixTask;}, set renderMatrixTask(value){renderMatrixTask=value;},
 get renderMobileDayPicker(){return renderMobileDayPicker;}, set renderMobileDayPicker(value){renderMobileDayPicker=value;},
 get renderOfflineAccountGate(){return renderOfflineAccountGate;}, set renderOfflineAccountGate(value){renderOfflineAccountGate=value;},
 get renderPriorityMatrix(){return renderPriorityMatrix;}, set renderPriorityMatrix(value){renderPriorityMatrix=value;},
 get renderReminders(){return renderReminders;}, set renderReminders(value){renderReminders=value;},
 get renderSavedFilters(){return renderSavedFilters;}, set renderSavedFilters(value){renderSavedFilters=value;},
 get renderStats(){return renderStats;}, set renderStats(value){renderStats=value;},
 get renderTaskAttachments(){return renderTaskAttachments;}, set renderTaskAttachments(value){renderTaskAttachments=value;},
 get renderTaskNotificationSettings(){return renderTaskNotificationSettings;}, set renderTaskNotificationSettings(value){renderTaskNotificationSettings=value;},
 get renderTaskTemplateOptions(){return renderTaskTemplateOptions;}, set renderTaskTemplateOptions(value){renderTaskTemplateOptions=value;},
 get renderTodayOverview(){return renderTodayOverview;}, set renderTodayOverview(value){renderTodayOverview=value;},
 get renderUnscheduled(){return renderUnscheduled;}, set renderUnscheduled(value){renderUnscheduled=value;},
 get renderWorkspaceCustomLists(){return renderWorkspaceCustomLists;}, set renderWorkspaceCustomLists(value){renderWorkspaceCustomLists=value;},
 get renderWorkspaceFolders(){return renderWorkspaceFolders;}, set renderWorkspaceFolders(value){renderWorkspaceFolders=value;},
 get renderWorkspaceTags(){return renderWorkspaceTags;}, set renderWorkspaceTags(value){renderWorkspaceTags=value;},
 get renderWorkspaceTaskGroups(){return renderWorkspaceTaskGroups;}, set renderWorkspaceTaskGroups(value){renderWorkspaceTaskGroups=value;},
 get renderWorkspaceTasks(){return renderWorkspaceTasks;}, set renderWorkspaceTasks(value){renderWorkspaceTasks=value;},
 get renderWorkspaceView(){return renderWorkspaceView;}, set renderWorkspaceView(value){renderWorkspaceView=value;},
 get renderZoneNotice(){return renderZoneNotice;}, set renderZoneNotice(value){renderZoneNotice=value;},
 get requestCloudSave(){return requestCloudSave;}, set requestCloudSave(value){requestCloudSave=value;},
 get resetCountdownForm(){return resetCountdownForm;}, set resetCountdownForm(value){resetCountdownForm=value;},
 get restoreFocusState(){return restoreFocusState;}, set restoreFocusState(value){restoreFocusState=value;},
 get retireEditorDraft(){return retireEditorDraft;}, set retireEditorDraft(value){retireEditorDraft=value;},
 get saveCloudLocalPayload(){return saveCloudLocalPayload;}, set saveCloudLocalPayload(value){saveCloudLocalPayload=value;},
 get saveCloudSnapshot(){return saveCloudSnapshot;}, set saveCloudSnapshot(value){saveCloudSnapshot=value;},
 get saveCountdownForm(){return saveCountdownForm;}, set saveCountdownForm(value){saveCountdownForm=value;},
 get saveCurrent(){return saveCurrent;}, set saveCurrent(value){saveCurrent=value;},
 get saveFilterForm(){return saveFilterForm;}, set saveFilterForm(value){saveFilterForm=value;},
 get saveHabitForm(){return saveHabitForm;}, set saveHabitForm(value){saveHabitForm=value;},
 get saveModalAsTaskTemplate(){return saveModalAsTaskTemplate;}, set saveModalAsTaskTemplate(value){saveModalAsTaskTemplate=value;},
 get saveModalTask(){return saveModalTask;}, set saveModalTask(value){saveModalTask=value;},
 get saveReminders(){return saveReminders;}, set saveReminders(value){saveReminders=value;},
 get saveStore(){return saveStore;}, set saveStore(value){saveStore=value;},
 get saveTemplateEditor(){return saveTemplateEditor;}, set saveTemplateEditor(value){saveTemplateEditor=value;},
 get savedFilterMatches(){return savedFilterMatches;}, set savedFilterMatches(value){savedFilterMatches=value;},
 get savedTaskFilters(){return savedTaskFilters;}, set savedTaskFilters(value){savedTaskFilters=value;},
 get selectedActivitySuggestion(){return selectedActivitySuggestion;}, set selectedActivitySuggestion(value){selectedActivitySuggestion=value;},
 get setCalendarView(){return setCalendarView;}, set setCalendarView(value){setCalendarView=value;},
 get setCloudAuthBusy(){return setCloudAuthBusy;}, set setCloudAuthBusy(value){setCloudAuthBusy=value;},
 get setCloudAuthMode(){return setCloudAuthMode;}, set setCloudAuthMode(value){setCloudAuthMode=value;},
 get setCloudStatus(){return setCloudStatus;}, set setCloudStatus(value){setCloudStatus=value;},
 get setWorkspaceView(){return setWorkspaceView;}, set setWorkspaceView(value){setWorkspaceView=value;},
 get setupDragDrop(){return setupDragDrop;}, set setupDragDrop(value){setupDragDrop=value;},
 get setupSystemThemeListener(){return setupSystemThemeListener;}, set setupSystemThemeListener(value){setupSystemThemeListener=value;},
 get shareViewTitle(){return shareViewTitle;}, set shareViewTitle(value){shareViewTitle=value;},
 get shiftPeriod(){return shiftPeriod;}, set shiftPeriod(value){shiftPeriod=value;},
 get shiftWeeks(){return shiftWeeks;}, set shiftWeeks(value){shiftWeeks=value;},
 get showCloudConflict(){return showCloudConflict;}, set showCloudConflict(value){showCloudConflict=value;},
 get showStorageRecoveryNotice(){return showStorageRecoveryNotice;}, set showStorageRecoveryNotice(value){showStorageRecoveryNotice=value;},
 get showToast(){return showToast;}, set showToast(value){showToast=value;},
 get skipHabitToday(){return skipHabitToday;}, set skipHabitToday(value){skipHabitToday=value;},
 get startCloudForUser(){return startCloudForUser;}, set startCloudForUser(value){startCloudForUser=value;},
 get stopRecurringSeries(){return stopRecurringSeries;}, set stopRecurringSeries(value){stopRecurringSeries=value;},
 get storageSaveError(){return storageSaveError;}, set storageSaveError(value){storageSaveError=value;},
 get store(){return store;}, set store(value){store=value;},
 get submitCloudAuth(){return submitCloudAuth;}, set submitCloudAuth(value){submitCloudAuth=value;},
 get sundayOf(){return sundayOf;}, set sundayOf(value){sundayOf=value;},
 get suppressActivitySuggestionFocus(){return suppressActivitySuggestionFocus;}, set suppressActivitySuggestionFocus(value){suppressActivitySuggestionFocus=value;},
 get swapTasks(){return swapTasks;}, set swapTasks(value){swapTasks=value;},
 get syncSettingsForm(){return syncSettingsForm;}, set syncSettingsForm(value){syncSettingsForm=value;},
 get syncWorkspaceListOptions(){return syncWorkspaceListOptions;}, set syncWorkspaceListOptions(value){syncWorkspaceListOptions=value;},
 get syncWorkspaceLists(){return syncWorkspaceLists;}, set syncWorkspaceLists(value){syncWorkspaceLists=value;},
 get taskBoardStatus(){return taskBoardStatus;}, set taskBoardStatus(value){taskBoardStatus=value;},
 get taskEndCache(){return taskEndCache;},
 get taskEndDate(){return taskEndDate;}, set taskEndDate(value){taskEndDate=value;},
 get taskLoggedFocusMinutes(){return taskLoggedFocusMinutes;}, set taskLoggedFocusMinutes(value){taskLoggedFocusMinutes=value;},
 get taskModalFingerprint(){return taskModalFingerprint;}, set taskModalFingerprint(value){taskModalFingerprint=value;},
 get taskModalInitialFingerprint(){return taskModalInitialFingerprint;}, set taskModalInitialFingerprint(value){taskModalInitialFingerprint=value;},
 get taskReminderTimes(){return taskReminderTimes;}, set taskReminderTimes(value){taskReminderTimes=value;},
 get taskTemplates(){return taskTemplates;}, set taskTemplates(value){taskTemplates=value;},
 get tasks(){return tasks;}, set tasks(value){tasks=value;},
 get templateDayChecks(){return templateDayChecks;}, set templateDayChecks(value){templateDayChecks=value;},
 get timeMins(){return timeMins;}, set timeMins(value){timeMins=value;},
 get toastTimer(){return toastTimer;}, set toastTimer(value){toastTimer=value;},
 get toggleHabitCheck(){return toggleHabitCheck;}, set toggleHabitCheck(value){toggleHabitCheck=value;},
 get toggleVoiceCapture(){return toggleVoiceCapture;}, set toggleVoiceCapture(value){toggleVoiceCapture=value;},
 get transferDestinationList(){return transferDestinationList;}, set transferDestinationList(value){transferDestinationList=value;},
 get uid(){return uid;}, set uid(value){uid=value;},
 get unescapeICSText(){return unescapeICSText;}, set unescapeICSText(value){unescapeICSText=value;},
 get updateActivityTemplateStates(){return updateActivityTemplateStates;}, set updateActivityTemplateStates(value){updateActivityTemplateStates=value;},
 get updateBoardTaskStatus(){return updateBoardTaskStatus;}, set updateBoardTaskStatus(value){updateBoardTaskStatus=value;},
 get updateCalendarPeriodLabel(){return updateCalendarPeriodLabel;}, set updateCalendarPeriodLabel(value){updateCalendarPeriodLabel=value;},
 get updateCalendarVisibility(){return updateCalendarVisibility;}, set updateCalendarVisibility(value){updateCalendarVisibility=value;},
 get updateDurationFromEnd(){return updateDurationFromEnd;}, set updateDurationFromEnd(value){updateDurationFromEnd=value;},
 get updateEndTimeFromDuration(){return updateEndTimeFromDuration;}, set updateEndTimeFromDuration(value){updateEndTimeFromDuration=value;},
 get updateFocusDisplay(){return updateFocusDisplay;}, set updateFocusDisplay(value){updateFocusDisplay=value;},
 get updateHabitFrequencyVisibility(){return updateHabitFrequencyVisibility;}, set updateHabitFrequencyVisibility(value){updateHabitFrequencyVisibility=value;},
 get updateModalScheduleVisibility(){return updateModalScheduleVisibility;}, set updateModalScheduleVisibility(value){updateModalScheduleVisibility=value;},
 get updateTaskColourPreview(){return updateTaskColourPreview;}, set updateTaskColourPreview(value){updateTaskColourPreview=value;},
  get updateRecurringBulkVisibility(){return updateRecurringBulkVisibility;}, set updateRecurringBulkVisibility(value){updateRecurringBulkVisibility=value;},
 get updateReminderBadge(){return updateReminderBadge;}, set updateReminderBadge(value){updateReminderBadge=value;},
 get updateViewControls(){return updateViewControls;}, set updateViewControls(value){updateViewControls=value;},
 get updateWorkspaceCounts(){return updateWorkspaceCounts;}, set updateWorkspaceCounts(value){updateWorkspaceCounts=value;},
 get updateWorkspaceRecord(){return updateWorkspaceRecord;}, set updateWorkspaceRecord(value){updateWorkspaceRecord=value;},
 get upsertRecurringTemplate(){return upsertRecurringTemplate;}, set upsertRecurringTemplate(value){upsertRecurringTemplate=value;},
 get utilityOrigins(){return utilityOrigins;},
 get validTransferDate(){return validTransferDate;}, set validTransferDate(value){validTransferDate=value;},
 get validateCloudPassword(){return validateCloudPassword;}, set validateCloudPassword(value){validateCloudPassword=value;},
 get validateCloudPayload(){return validateCloudPayload;}, set validateCloudPayload(value){validateCloudPayload=value;},
 get validateTimeFields(){return validateTimeFields;}, set validateTimeFields(value){validateTimeFields=value;},
 get weekwiseAnimateCalendar(){return weekwiseAnimateCalendar;}, set weekwiseAnimateCalendar(value){weekwiseAnimateCalendar=value;},
 get weekwiseTasksOnDate(){return weekwiseTasksOnDate;}, set weekwiseTasksOnDate(value){weekwiseTasksOnDate=value;},
 get wireCloudAuthControls(){return wireCloudAuthControls;}, set wireCloudAuthControls(value){wireCloudAuthControls=value;},
 get wireCountdownControls(){return wireCountdownControls;}, set wireCountdownControls(value){wireCountdownControls=value;},
 get wireTime24Fields(){return wireTime24Fields;}, set wireTime24Fields(value){wireTime24Fields=value;},
 get wireWorkspaceControls(){return wireWorkspaceControls;}, set wireWorkspaceControls(value){wireWorkspaceControls=value;},
 get workspaceDateLabel(){return workspaceDateLabel;}, set workspaceDateLabel(value){workspaceDateLabel=value;},
 get workspaceFolderSummary(){return workspaceFolderSummary;}, set workspaceFolderSummary(value){workspaceFolderSummary=value;},
 get workspacePriorityValue(){return workspacePriorityValue;}, set workspacePriorityValue(value){workspacePriorityValue=value;},
 get workspaceRecordMatches(){return workspaceRecordMatches;}, set workspaceRecordMatches(value){workspaceRecordMatches=value;},
 get workspaceRecords(){return workspaceRecords;}, set workspaceRecords(value){workspaceRecords=value;},
 get workspaceTagSummary(){return workspaceTagSummary;}, set workspaceTagSummary(value){workspaceTagSummary=value;},
 get workspaceTaskRow(){return workspaceTaskRow;}, set workspaceTaskRow(value){workspaceTaskRow=value;},
 get workspaceView(){return workspaceView;}, set workspaceView(value){workspaceView=value;},
 get writeCloudMeta(){return writeCloudMeta;}, set writeCloudMeta(value){writeCloudMeta=value;},
 get zoneNeedsReview(){return zoneNeedsReview;}, set zoneNeedsReview(value){zoneNeedsReview=value;}
};
let {nextQuarterHour,dateOnly,sundayOf,mondayOf,dateKey,parseKey,fmtDate,dayDate,normalizeTimeField,validateTimeFields,wireTime24Fields,timeMins,minsTime,durationLabel,normalizeEndTimeField,updateEndTimeFromDuration,updateDurationFromEnd,uid,escapeHtml,defaultClassTemplate,defaultSettings}=WeekwiseAppPrimitives.create(weekwiseRuntime);
let {loadStore,loadReminders,saveReminders,storageSaveError,checkedCollectionSave,saveStore,reconcileSplitTasks,saveCurrent,exportEditorHistory,exportBackup,loadImport,showStorageRecoveryNotice,plannerSnapshot,commitPlannerSnapshot}=WeekwiseAppPersistence.create(weekwiseRuntime);
let {showToast,populateDaySelects,applyThemePreference,setupSystemThemeListener,syncSettingsForm,overlap,canPlace,findSlot,createTask,addFlexible,hasShift,loadWeek,formatTime,categoryClass}=WeekwiseAppSettings.create(weekwiseRuntime);
let {sortedTasks,taskHTML,renderMobileDayPicker,openFixedSettings,renderDays,openUtilityPanel,closeUtilityPanel,openDashboard,durationText,analyticsGroup,taskEndDate,renderStats,renderUnscheduled,renderHabitSummaries,renderAll,moveTask,swapTasks,setupDragDrop,shiftWeeks,setCalendarView,updateViewControls,shiftPeriod,addQuick,setup,weekwiseTasksOnDate,weekwiseRenderMonth,weekwiseRenderBreaks,weekwiseAnimateCalendar,weekwiseRenderAgenda,addDaysForView,weekwiseRenderYear,countdownDays,countdownWords,renderCountdowns}=WeekwiseAppCalendar.create(weekwiseRuntime);
let {templateDayChecks,openTemplateEditor,closeTemplateEditor,saveTemplateEditor,updateCalendarVisibility,readModalTaskTemplate,persistTaskTemplates,saveModalAsTaskTemplate,applySelectedTaskTemplate,deleteSelectedTaskTemplate,parseTaskAttachmentInput,renderTaskAttachments,shareViewTitle,recordsForListTransfer}=WeekwiseAppTemplates.create(weekwiseRuntime);
let {currentDayHasConfiguredShift,updateActivityTemplateStates,chooseActivityTemplate,hideActivitySuggestions,renderActivitySuggestions,clearActivityTemplateSelection,inferredListId,defaultFolderName,taskReminderTimes,updateModalScheduleVisibility,taskModalFingerprint,draftFields,checkpointEditorDraft,renderDraftNotice,retireEditorDraft,restoreEditorDraft,openTaskModal,closeTaskModal,updateRecurringBulkVisibility,updateTaskColourPreview,saveModalTask}=WeekwiseAppEditor.create(weekwiseRuntime);
let {reminderTodayKey,reminderState,reminderDueOpen,updateReminderBadge,reminderFormReset,reminderEdit,reminderSave,reminderToggleDone,reminderTogglePin,reminderDelete,renderReminders,openReminders,nudgeDueReminders,cloudFingerprint,enableTaskNotifications,openReminderTask,checkTaskReminders,parseWeekwiseNaturalCapture}=WeekwiseAppNotifications.create(weekwiseRuntime);
let {reconnectAccount,cloudFailure,buildCloudPayload,localHasWeekwiseData,readCloudMeta,writeCloudMeta,setCloudStatus,offlineAccountSelected,renderOfflineAccountGate,openOfflineAccount,renderCloudPanel,validateCloudPayload,saveCloudLocalPayload,isolatePlannerOwner,requestCloudSave,applyCloudRow,showCloudConflict,queueCloudSave,saveCloudSnapshot,startCloudForUser,initializeCloud,setCloudAuthMode,setCloudAuthBusy,validateCloudPassword,cloudSignIn,cloudSignUp,cloudResetPassword,cloudUpdatePassword,submitCloudAuth,wireCloudAuthControls,cloudUseRemote,cloudUseLocal,cloudSyncNow,checkCloudForRemoteChanges,openCloudPanel,openSignInFromLanding,finishSignInLanding}=WeekwiseAppCloud.create(weekwiseRuntime);
let {syncWorkspaceListOptions,renderWorkspaceCustomLists,syncWorkspaceLists,workspaceRecords,workspaceFolderSummary,renderWorkspaceFolders,workspaceTagSummary,renderWorkspaceTags,workspaceRecordMatches,workspacePriorityValue,workspaceDateLabel,workspaceTaskRow,updateWorkspaceCounts,renderWorkspaceTaskGroups,experienceData,renderExperience,renderTodayOverview,listPage,listPageFooter,renderWorkspaceTasks,renderWorkspaceView,setWorkspaceView,openWorkspaceRecord,updateWorkspaceRecord,wireWorkspaceControls,renderKanbanBoard,updateBoardTaskStatus,savedFilterMatches,renderSavedFilters,saveFilterForm,deleteSavedFilter,renderTaskNotificationSettings,deleteCustomList,renderTaskTemplateOptions}=WeekwiseAppWorkspace.create(weekwiseRuntime);
let {zoneNeedsReview,renderZoneNotice,dataCanWrite}=WeekwiseAppZone.create(weekwiseRuntime);
let {focusOwner,focusStateKey,freshFocus,restoreFocusState,ensureFocusState,persistActiveFocus,renderMatrixTask,renderPriorityMatrix,taskLoggedFocusMinutes,renderFocusPanel,persistFocusSessions,updateFocusDisplay,focusComplete,focusTick,focusStartPause,focusReset,focusTakeBreak}=WeekwiseAppFocus.create(weekwiseRuntime);
let {habitWeekRange,habitWeekKeys,habitCountThisWeek,habitStreak,habitHistoryDots,renderHabitTracker,persistHabits,updateHabitFrequencyVisibility,habitFormReset,saveHabitForm,editHabit,toggleHabitCheck,skipHabitToday,checkHabitReminders,deleteHabit,addDaysToKey}=WeekwiseAppHabits.create(weekwiseRuntime);
let {recurrenceDateMatches,stopRecurringSeries,upsertRecurringTemplate,materializeRecurringRange,materializeCurrentAndUpcoming,updateCalendarPeriodLabel}=WeekwiseAppRecurrence.create(weekwiseRuntime);
let {persistCountdowns,resetCountdownForm,saveCountdownForm,editCountdown,deleteCountdown,wireCountdownControls,taskBoardStatus,renderKanbanCard}=WeekwiseAppCountdowns.create(weekwiseRuntime);
let {defaultCaptureList,addCapturedTaskForDate,quickCaptureWorkspaceTask,escapeICSText,icsUtcDateTime,exportCalendarICS,createCustomList,renameCustomList}=WeekwiseAppCapture.create(weekwiseRuntime);
let {unescapeICSText,parseICSDateProperty,parseICSProperties,importCalendarICS,toggleVoiceCapture,exportCurrentTaskList,validTransferDate,transferDestinationList,importSharedTaskList,copyTaskPlanningPrompt}=WeekwiseAppTransfers.create(weekwiseRuntime);
let {refreshClock}=WeekwiseAppStartup.create(weekwiseRuntime);

const DAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TYPE_LABELS={job:'Career',study:'Coursework',language:'Language',life:'Home / personal',hobby:'Hobby',fixed:'Fixed',other:'Other'};
const STORE_KEY='weekwise-planner-v2';
const REMINDERS_KEY='weekwise-reminders-v1';
const CLOUD_META_KEY='weekwise-cloud-sync-meta-v1';

const $=id=>document.getElementById(id);
let cloudSessionEpoch=0,currentDataOwner="local";
let cloudClient=null,cloudUser=null,cloudRevision=0,cloudReady=false,cloudApplyingRemote=false,cloudBusy=false,cloudSyncTimer=null,cloudConflict=null,cloudInitializationUser=null,cloudInitPromise=null;
try{if(window.supabase&&typeof window.supabase.createClient==='function')cloudClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}catch(e){console.error('Weekwise cloud client could not start',e);}
window.weekwiseCloudClient=cloudClient;
let now=new Date();

let plannerStorageBlocked=false,plannerStorageError="";

let reminders=loadReminders();

let store=loadStore();
currentDataOwner=readCloudMeta()?.userId||'local';
if(!store.settings)store.settings=defaultSettings();if(!store.weeks)store.weeks={};if(!Array.isArray(store.recurringTemplates))store.recurringTemplates=[];if(!Array.isArray(store.customLists))store.customLists=[];if(!store.settings.shifts)store.settings.shifts=defaultSettings().shifts;if(!store.settings.classTemplate)store.settings.classTemplate=defaultClassTemplate();
let currentWeek=dateKey(sundayOf(now));
let mobileDay=now.getDay();
let monthAnchor=new Date(now.getFullYear(),now.getMonth(),1);
let agendaAnchor=dateOnly(now);
let calendarYear=now.getFullYear();
let dashboardWeekKey=currentWeek;
let calendarView='week';
try{const savedView=localStorage.getItem('weekwise-calendar-view-v1');calendarView=(savedView==='day'||savedView==='week'||savedView==='month'||savedView==='agenda'||savedView==='year')?savedView:(window.matchMedia('(max-width: 650px)').matches?'day':'week');}catch(_){calendarView=window.matchMedia('(max-width: 650px)').matches?'day':'week';}
let lastRenderedCalendarView=null;
let tasks=[],pendingCalendarSlot=null;
let workspaceView='today';
try{const savedWorkspace=localStorage.getItem('weekwise-workspace-view-v1');if(['today','tomorrow','inbox','upcoming','board','filters','plan','insights','settings','calendar','matrix','list-career','list-study','list-work','list-personal','list-language','list-hobbies','list-other'].includes(savedWorkspace)||(savedWorkspace&&(savedWorkspace.startsWith('folder:')||savedWorkspace.startsWith('tag:'))))workspaceView=savedWorkspace;}catch(_){}
try{const shortcutView=new URLSearchParams(window.location.search).get('view');if(['today','tomorrow','inbox','plan','calendar'].includes(shortcutView))workspaceView=shortcutView;}catch(_){}
let toastTimer;
let storageWarningShown=false;
let lastSavedStore=JSON.stringify(store),lastSavedDisk=localStorage.getItem(STORE_KEY);

window.addEventListener('error',event=>{if(event.error?.name==='WeekwiseStorageError'){event.preventDefault();showToast(event.error.message);}});

const utilityOrigins=new Map();
let activeUtilityPanel=null;

const taskEndCache=new WeakMap();

const ACTIVITY_TEMPLATE_PRESETS={
  german:{title:'German practice',type:'language',duration:30,start:'08:30',note:'Vocabulary, grammar, listening, or speaking practice.'},
  english:{title:'English fluency practice',type:'language',duration:20,start:'11:15',note:'Speak aloud, shadow a podcast, or record a short answer.'},
  jobs:{title:'Job applications & follow-ups',type:'job',duration:75,start:'09:30',note:'Complete one tailored application or follow-up.'},
  cooking:{title:'Cook meals for the next 2 days',type:'life',duration:60,start:'18:00',note:'Prepare enough food for the next two days.'},
  cleaning:{title:'Quick clean & reset',type:'life',duration:10,start:'20:30',note:'A short tidy to reset your space.'},
  cycling:{title:'Cycling / outdoor time',type:'hobby',duration:60,start:'16:00',note:'Ride at a comfortable pace and enjoy the outdoors.'},
  movies:{title:'Movie / guilt-free downtime',type:'hobby',duration:120,start:'20:00',note:'Relax without needing to make the time productive.'},
  communication:{title:'Communication skills practice',type:'study',duration:15,start:'15:00',note:'Practise storytelling, conversation, or an interview answer.'}
};

let selectedActivitySuggestion=null;
let suppressActivitySuggestionFocus=false;
const ACTIVITY_SUGGESTIONS=[
 {key:'german',label:'German practice'},
 {key:'english',label:'English fluency practice'},
 {key:'jobs',label:'Job applications & follow-ups'},
 {key:'workday',label:'Work day'},
 {key:'class',label:'Class / coursework'},
 {key:'cooking',label:'Cooking'},
 {key:'cleaning',label:'Cleaning'},
 {key:'cycling',label:'Cycling'},
 {key:'movies',label:'Movies & rest'},
 {key:'communication',label:'Communication skills'}
];

let taskModalInitialFingerprint='',editorSession=null,editorDraftTimer=null;

let cloudAuthMode='signin',cloudAuthBusy=false;

/* Optional visual gaps, monthly calendar, and week-selectable dashboard. */
const weekwiseOriginalRenderDays=renderDays;
const weekwiseOriginalRenderStats=renderStats;

renderDays=function(){
 const grid=$('daysGrid');
 grid.classList.remove('month-mode','agenda-mode','year-mode');grid.onclick=null;grid.onkeydown=null;grid.onchange=null;
 if(WeekwiseCalendarRangeUI.render({store:plannerSnapshot().store,view:calendarView,anchor:dateKey(dayDate(currentWeek,mobileDay)),year:monthAnchor.getFullYear(),month:monthAnchor.getMonth(),calendarYear,agenda:dateKey(agendaAnchor)})){updateCalendarPeriodLabel();return;}
 if(calendarView==='month'){grid.style.height='auto';grid.style.minHeight='0';grid.style.maxHeight='none';weekwiseRenderMonth();updateCalendarPeriodLabel();return;}
 if(calendarView==='agenda'){grid.style.height='auto';grid.style.minHeight='0';grid.style.maxHeight='none';weekwiseRenderAgenda();updateCalendarPeriodLabel();return;}
 if(calendarView==='year'){grid.style.height='auto';grid.style.minHeight='0';grid.style.maxHeight='none';weekwiseRenderYear();updateCalendarPeriodLabel();return;}
 grid.style.height='';grid.style.minHeight='';grid.style.maxHeight='';
 const picker=$('mobileDayPicker');if(picker)picker.hidden=workspaceView!=='calendar';const help=$('mobileHelp');if(help)help.hidden=workspaceView!=='calendar';
 weekwiseOriginalRenderDays();weekwiseRenderBreaks();updateCalendarPeriodLabel();
};
updateViewControls=function(){
 [['dayViewBtn','day'],['weekViewBtn','week'],['monthViewBtn','month'],['agendaViewBtn','agenda'],['yearViewBtn','year']].forEach(function(pair){const b=$(pair[0]);if(b){b.classList.toggle('active',calendarView===pair[1]);b.setAttribute('aria-pressed',calendarView===pair[1]?'true':'false');}});
 const unit=calendarView==='day'?'day':calendarView==='month'?'month':calendarView==='year'?'year':'week';
 ['prevWeek','nextWeek'].forEach(function(id){const b=$(id);if(b){b.title=(id==='prevWeek'?'Previous ':'Next ')+unit;b.setAttribute('aria-label',b.title);}});
};

setCalendarView=function(view){
 if(!['day','week','month','agenda','year'].includes(view))return;
 const changing=calendarView!==view;saveCurrent();
 if(changing)weekwiseAnimateCalendar();
 const selectedDate=dayDate(currentWeek,mobileDay);
 if(changing&&view==='month')monthAnchor=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
 if(changing&&view==='agenda')agendaAnchor=dateOnly(selectedDate);
 if(changing&&view==='year')calendarYear=selectedDate.getFullYear();
 calendarView=view;try{localStorage.setItem('weekwise-calendar-view-v1',view);}catch(_){}
 renderAll();updateCalendarPeriodLabel();
};
shiftPeriod=function(n){
 weekwiseAnimateCalendar();
 if(calendarView==='month'){saveCurrent();monthAnchor=new Date(monthAnchor.getFullYear(),monthAnchor.getMonth()+n,1);currentWeek=dateKey(sundayOf(monthAnchor));loadWeek(currentWeek);renderAll();return;}
 if(calendarView==='year'){calendarYear+=n;renderAll();updateCalendarPeriodLabel();return;}
 if(calendarView==='agenda'){agendaAnchor=addDaysForView(agendaAnchor,n*7);renderAll();updateCalendarPeriodLabel();return;}
 if(calendarView!=='day'){shiftWeeks(n);return;}
 const d=dayDate(currentWeek,mobileDay);d.setDate(d.getDate()+n);saveCurrent();mobileDay=d.getDay();loadWeek(dateKey(sundayOf(d)));
};
openDashboard=function(){
 dashboardWeekKey=WeekwiseCalendarRange.range(dateKey(dayDate(currentWeek,mobileDay)),1)[0];const picker=$('dashboardWeekPicker');if(picker)picker.value=dashboardWeekKey;renderStats();openUtilityPanel('dashboard','Weekly summary');
};
renderStats=function(){WeekwisePersonalUI.renderSummary(weekwiseRuntime,dashboardWeekKey||currentWeek);};
 $('dashboardWeekPicker').addEventListener('change',function(){if(!$('dashboardWeekPicker').value)return;dashboardWeekKey=WeekwiseCalendarRange.range($('dashboardWeekPicker').value,1)[0];renderStats();});
 $('thisWeek').addEventListener('click',function(){monthAnchor=new Date(now.getFullYear(),now.getMonth(),1);agendaAnchor=dateOnly(now);calendarYear=now.getFullYear();});

$('thisWeek').addEventListener('click',weekwiseAnimateCalendar);
$('mobileDayPicker').addEventListener('click',function(e){if(e.target.closest('[data-mobile-day]'))weekwiseAnimateCalendar();});
$('daysGrid').addEventListener('click',function(e){if(e.target.closest('[data-month-day],[data-month-event]'))weekwiseAnimateCalendar();});

const BUILTIN_WORKSPACE_LISTS=[{id:'career',label:'Career',view:'list-career'},{id:'study',label:'Study',view:'list-study'},{id:'work',label:'Work',view:'list-work'},{id:'personal',label:'Personal',view:'list-personal'},{id:'language',label:'Languages',view:'list-language'},{id:'hobbies',label:'Hobbies',view:'list-hobbies'},{id:'other',label:'Other',view:'list-other'}];
let WORKSPACE_LISTS=BUILTIN_WORKSPACE_LISTS.slice();

const WORKSPACE_VIEW_INFO={search:{title:'Search all tasks',description:'Search across lists, folders, tags, notes and deadlines.',emptyTitle:'Search your whole workspace',emptyText:'Enter a task name, note, tag, list, folder or deadline to find matching tasks.'},today:{title:'Today',description:'Focus on the tasks planned for today.',emptyTitle:'Nothing on your plan yet',emptyText:'Capture a task above, or add a scheduled activity from the calendar.'},tomorrow:{title:'Tomorrow',description:'Look ahead one day and prepare without mixing it into today.',emptyTitle:'Tomorrow is clear',emptyText:'Schedule a task or add a deadline for tomorrow. Tasks remain linked to your calendar.'},inbox:{title:'Inbox',description:'Capture first. Decide when to do it later.',emptyTitle:'Your inbox is clear',emptyText:'Use the quick-capture box to collect tasks before scheduling them.'},upcoming:{title:'Upcoming',description:'See scheduled activities across the next seven days.',emptyTitle:'No upcoming tasks',emptyText:'Tasks scheduled for the next seven days will appear here.'},calendar:{title:'Calendar',description:'Time-block your activities.'}};

const FOCUS_SESSIONS_KEY='weekwise-focus-sessions-v1';
let focusSessions=WeekwiseData.readCollection(localStorage,FOCUS_SESSIONS_KEY);
let focusState=null,focusInterval=null;

let focusPickerOwner=null,focusPickerIndex=0,focusPickerPage=null,focusPickerTimer=null;

const HABITS_KEY='weekwise-habits-v1';
let habits=WeekwiseData.readCollection(localStorage,HABITS_KEY);

const COUNTDOWNS_KEY='weekwise-countdowns-v1';
let countdowns=WeekwiseData.readCollection(localStorage,COUNTDOWNS_KEY);

const TASK_FILTERS_KEY='weekwise-saved-filters-v1';
let savedTaskFilters=[];
savedTaskFilters=WeekwiseData.readCollection(localStorage,TASK_FILTERS_KEY);
let activeSavedFilterId='';

let activeVoiceRecognition=null;

document.addEventListener('keydown',e=>{
 if((e.metaKey||e.ctrlKey)&&e.shiftKey&&!e.altKey&&String(e.key).toLowerCase()==='f'){
  if(document.body.classList.contains('signin-required')||$('taskModal')?.classList.contains('show')||activeUtilityPanel||e.target?.closest('input,textarea,select,[contenteditable="true"]'))return;
  e.preventDefault();setWorkspaceView('search');$('workspaceSearch').focus();
 }
});

document.addEventListener('keydown',e=>{
 if(!(e.metaKey||e.ctrlKey)||String(e.key).toLowerCase()!=='k'||e.altKey)return;
 if(document.body.classList.contains('signin-required')||$('taskModal')?.classList.contains('show'))return;
 const target=e.target;
 if(target&&target.closest('input,textarea,select,[contenteditable="true"]'))return;
 e.preventDefault();setWorkspaceView('inbox');
 setTimeout(()=>{$('workspaceCaptureInput')?.focus();},0);
});

const TASK_TEMPLATES_KEY='weekwise-task-templates-v1';
let taskTemplates=WeekwiseData.readCollection(localStorage,TASK_TEMPLATES_KEY);

window.weekwiseCalendarBridge = {
  owner() { return cloudUser?.id===currentDataOwner?currentDataOwner:null; },
  isReady() { return !!(cloudClient && cloudUser && cloudReady && !cloudConflict && !plannerStorageBlocked && !WeekwiseData.blockedKeys().length && !zoneNeedsReview()); },
  async prepareSync() {
    const owner=cloudUser?.id,epoch=cloudSessionEpoch;if(!dataCanWrite())throw new Error("Planner changes are paused; resolve recovery or time-zone review first.");
    if (!cloudClient || !cloudUser) throw new Error("Sign in to Weekwise before synchronizing a calendar.");
    if (cloudConflict) throw new Error("Resolve the Weekwise cloud conflict before calendar synchronization.");
    if (!cloudReady) throw new Error("Wait for Weekwise cloud sync to finish before synchronizing a calendar.");
    if (cloudBusy) throw new Error("Weekwise is already saving cloud changes. Wait a moment and retry.");
    if (cloudSyncTimer) { clearTimeout(cloudSyncTimer); cloudSyncTimer = null; }
    const current = cloudFingerprint(buildCloudPayload());
    const meta = readCloudMeta();
    if (meta?.userId !== cloudUser.id || meta?.fingerprint !== current) await saveCloudSnapshot();
    if(epoch!==cloudSessionEpoch||cloudUser?.id!==owner)throw new Error("Your account changed during calendar preparation. Try again after its planner loads.");
    const fresh = cloudFingerprint(buildCloudPayload());
    const after = readCloudMeta();
    if (cloudConflict) throw new Error("Resolve the Weekwise cloud conflict before calendar synchronization.");
    if (after?.userId !== cloudUser.id || after?.fingerprint !== fresh) {
      throw new Error("Weekwise could not confirm that your latest changes reached the cloud. Open Cloud sync and retry.");
    }
    return { userId: cloudUser.id };
  },
  openPanel() { openUtilityPanel("calendarConnectionsPanel", "Calendar connections"); },
  async reloadAfterSync() {
    if (!cloudUser) throw new Error("Sign in to Weekwise before reloading synchronized calendar events.");
    await startCloudForUser(cloudUser, true);
    if (cloudConflict) throw new Error("Calendar data was saved, but Weekwise detected a concurrent edit. Resolve the cloud conflict before further sync.");
    renderAll();
    renderWorkspaceView();
    renderReminders();
  },
  toast(message) { showToast(String(message || "")); }
};

WeekwiseExperience.init({edit:openWorkspaceRecord,refreshToday:renderTodayOverview,recover(){setWorkspaceView('plan');WeekwisePlanUI.recoverToday();},focus(id,week){const record=workspaceRecords().find(r=>r.task.id===id&&r.week===week);if(!record)return;const state=ensureFocusState();if(state.runningSince!==null||state.activeMs>0){openUtilityPanel('focusPanel','Focus timer');showToast('Finish or reset your current session before choosing another task.');return;}focusState=freshFocus('focus',state.totalSeconds,{id,week,title:record.task.title});persistActiveFocus();openUtilityPanel('focusPanel','Focus timer');renderFocusPanel();focusStartPause();},navigate:setWorkspaceView,panel:openUtilityPanel,render:renderExperience,source:()=>({owner:currentDataOwner,store,today:WeekwiseToday.clock(store,now.getTime()).date}),announce:showToast,review(week,review,expected){if(!WeekwiseData.validDate(week))throw new Error('Choose a valid week.');if(!dataCanWrite())throw new Error('Editing is paused for data recovery.');if(expected?.owner!==currentDataOwner)throw new Error('The planner owner changed. Reopen the review for this account.');store=WeekwiseWeeklyReview.apply(store,week,review,expected.base);if(!saveStore())throw new Error('Could not save your review.');}});
$('captureConfirmApply').onclick=()=>{$('captureConfirmDialog').close();quickCaptureWorkspaceTask(false,true);};$('captureKeepRaw').onclick=()=>{$('captureConfirmDialog').close();quickCaptureWorkspaceTask(true,true);};$('captureCancel').onclick=()=>$('captureConfirmDialog').close();
$('restoreEditorDraft').onclick=restoreEditorDraft;$('downloadEditorDraft').onclick=()=>{if(!WeekwiseJsonFiles.allowed(currentDataOwner))return;const result=WeekwiseDrafts.read(localStorage,currentDataOwner);if(!result)return;const url=URL.createObjectURL(new Blob([result.raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='weekwise-editor-draft.json';a.click();URL.revokeObjectURL(url);};$('discardEditorDraft').onclick=()=>{const result=WeekwiseDrafts.read(localStorage,currentDataOwner);if(!result||!confirm('Discard the saved editor draft? Download it first if you need a copy.'))return;try{WeekwiseDrafts.discard(localStorage,currentDataOwner,result.raw);renderDraftNotice();}catch(error){showToast(error.message);}};$('taskForm').addEventListener('input',()=>{clearTimeout(editorDraftTimer);editorDraftTimer=setTimeout(()=>{try{checkpointEditorDraft();}catch(error){showToast(error.message);}},500);});window.addEventListener('beforeunload',()=>{try{checkpointEditorDraft();}catch(_){}});document.addEventListener('click',e=>{const button=e.target.closest('[data-list-more]');if(!button)return;WeekwiseListWindow.more(button.dataset.listMore);if(workspaceView==='board')renderKanbanBoard();else if(workspaceView==='matrix')renderPriorityMatrix();else if(workspaceView==='filters')renderSavedFilters();else renderWorkspaceTasks();const next=[...document.querySelectorAll('[data-list-more]')].find(el=>el.dataset.listMore===button.dataset.listMore);next?.focus();});
$('globalCaptureBtn').onclick=()=>openTaskModal(null,now.getDay(),null,'inbox');$('mobileNavigationToggle').onclick=()=>{const open=document.body.classList.toggle('navigation-expanded');$('mobileNavigationToggle').setAttribute('aria-expanded',String(open));};
$('workspaceSidebar').addEventListener('click',e=>{if(e.target.closest('[data-workspace-view]')||e.target.closest('[data-workspace-action]')){document.body.classList.remove('navigation-expanded');$('mobileNavigationToggle').setAttribute('aria-expanded','false');}});
$('signinOfflineAccount').onclick=openOfflineAccount;
$('signinLocalContinue').onclick=()=>{try{if(cloudAuthBusy||(cloudUser&&!WeekwiseOfflineAccess.isSignedOut(localStorage)))return;cloudSessionEpoch++;clearTimeout(cloudSyncTimer);cloudSyncTimer=null;isolatePlannerOwner('local');localStorage.removeItem('weekwise-offline-owner-v1');localStorage.setItem('weekwise-local-mode-v1','true');if(!WeekwiseOfflineAccess.selectLocal(localStorage))throw new Error('The device-only choice could not be saved.');cloudUser=null;cloudReady=false;cloudRevision=0;cloudConflict=null;finishSignInLanding();renderCloudPanel();setCloudStatus('Device-only planning. Your changes are saved locally.');}catch(error){setCloudStatus('Could not open the device planner: '+error.message);}};
setup();

const plannerBridge={
 snapshot:plannerSnapshot,
 account(){return currentDataOwner;},
 currentWeek(){return WeekwiseCalendarRange.range(dateKey(dayDate(currentWeek,mobileDay)),store.settings.weekStartsOn===1?1:0)[0];},
 todayKey(){return dateKey(new Date());},
 edit(id,week){openWorkspaceRecord(id,week);},
 commit:commitPlannerSnapshot
};
const productivityBridge={...plannerBridge,view(){return workspaceView;},lists(){return [{id:'inbox',label:'Inbox'},...WORKSPACE_LISTS];},announce:showToast,focusActive(){const state=ensureFocusState();return state.runningSince!==null||state.activeMs>0;}};
WeekwiseInterface.init(productivityBridge);WeekwiseProductivity.init(productivityBridge);
WeekwiseQuality.init({account:()=>currentDataOwner,open:openUtilityPanel,announce:showToast,openAccount:openCloudPanel,sync:cloudSyncNow,syncState(){
 const meta=readCloudMeta();let pending=null;try{pending=!!cloudUser&&(meta?.userId!==cloudUser.id||meta.fingerprint!==cloudFingerprint(buildCloudPayload()));}catch(_){}
 return {mode:currentDataOwner==='local'?'device':cloudUser?.id===currentDataOwner?'account':'offline-account',ready:!!cloudReady,busy:!!cloudBusy,conflict:!!cloudConflict,recovery:!!plannerStorageBlocked||!!WeekwiseData.blockedKeys().length||localStorage.getItem(STORE_KEY)!==lastSavedDisk,error:cloudFailure(),pending,revision:cloudUser?.id===currentDataOwner?Number(cloudRevision)||0:null,lastSavedAt:meta?.userId===currentDataOwner&&typeof meta.syncedAt==='string'&&!Number.isNaN(Date.parse(meta.syncedAt))?meta.syncedAt:null};
}});
WeekwiseHelp.init({open:openUtilityPanel,close:closeUtilityPanel,navigate:setWorkspaceView,account:openCloudPanel});
WeekwiseAccountUI.init({
 owner(){return currentDataOwner;},signedIn(owner){return cloudUser?.id===owner&&currentDataOwner===owner;},label(){return cloudUser?.email||'No signed-in account';},url:SUPABASE_URL+'/functions/v1/weekwise-account',key:SUPABASE_PUBLISHABLE_KEY,announce:showToast,
 async session(owner){
  if(!cloudClient||cloudUser?.id!==owner||currentDataOwner!==owner)throw new Error('Sign in to this account before erasure.');
  const verified=await cloudClient.auth.getUser(),session=await cloudClient.auth.getSession();
  if(verified.error||verified.data?.user?.id!==owner||session.error||session.data?.session?.user?.id!==owner||!session.data.session.access_token||currentDataOwner!==owner)throw new Error('Your verified account session changed. Sign in again.');
  return session.data.session;
 },
 async detach(owner){
  if(currentDataOwner!==owner)return;
  // Invalidate delayed saves before switching away from a confirmed deleted owner.
  cloudSessionEpoch++;cloudReady=false;clearTimeout(cloudSyncTimer);cloudSyncTimer=null;
  try{isolatePlannerOwner('local');}catch(error){throw new Error('The cloud account was deleted, but device isolation failed: '+error.message+'. Export your device data before clearing anything.');}
  // Account deletion also revokes locally verified offline access before SDK sign-out.
  WeekwiseOfflineAccess.revoke(localStorage);
  cloudUser=null;cloudRevision=0;cloudConflict=null;renderCloudPanel();renderAll();
  try{const result=await cloudClient.auth.signOut({scope:'local'});if(result?.error)throw result.error;}catch(_){throw new Error('Device sign-out could not finish. Account caches are retained until sign-out is resolved.');}
 }
});
WeekwiseZoneConversionUI.init({...plannerBridge,panel:openUtilityPanel,announce:showToast,commit(expected,account,next,checkpoint){commitPlannerSnapshot(expected,account,next,checkpoint,true);},blocked(){if(plannerStorageBlocked||WeekwiseData.blockedKeys().length)return 'Recover stored data first.';if(cloudConflict)return 'Resolve the cloud conflict first.';if(cloudUser&&cloudUser.id!==currentDataOwner)return 'Wait for your account to finish changing.';if($('taskModal').classList.contains('show')||!$('templateModal').hidden)return 'Save or close the editor first.';if(WeekwiseExperience.hasPendingReview()||$('workspaceCaptureInput').value.trim())return 'Save your unfinished review or capture first.';if(focusState&&(focusState.runningSince!==null||(!focusState.logged&&focusState.activeMs>0)))return 'Finish or reset the current focus session first.';return '';}});
WeekwisePersonalUI.init({...plannerBridge,panel:openUtilityPanel,announce:showToast,theme:applyThemePreference,closeEditor:closeTaskModal,source(){return {id:$('editTaskId').value,week:currentWeek};},collections(){return {focusSessions,habits};},summaryWeek(week){dashboardWeekKey=week;renderStats();},navigate:setWorkspaceView,reflect(week){closeUtilityPanel();$('insightsWeek').value=week;setWorkspaceView('insights');$('reviewworked').focus();}});
WeekwisePlanUI.init(plannerBridge);
WeekwiseTaskHistoryUI.init({...plannerBridge,panel:openUtilityPanel,announce:showToast,closeEditor:()=>closeTaskModal(true)});
WeekwiseSeriesScheduleUI.init({...plannerBridge,panel:openUtilityPanel,announce:showToast});
WeekwiseCalendarRangeUI.init({...plannerBridge,announce:showToast,controls:updateViewControls,render:renderAll,toggle(id,week){updateWorkspaceRecord(id,week,'toggle');},day(key){const date=parseKey(key);saveCurrent();mobileDay=date.getDay();loadWeek(dateKey(sundayOf(date)));calendarView='day';localStorage.setItem('weekwise-calendar-view-v1','day');renderAll();},add(date,start,zone){try{const slot=WeekwiseCalendarRange.slot(date,start,30,zone,store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone);saveCurrent();mobileDay=slot.day;loadWeek(slot.week);openTaskModal(null,slot.day,slot.start);if(![...$('modalDuration').options].some(o=>Number(o.value)===slot.duration)){const option=document.createElement('option');option.value=slot.duration;option.textContent=durationLabel(slot.duration);$('modalDuration').add(option);}$('modalDuration').value=String(slot.duration);updateEndTimeFromDuration();pendingCalendarSlot=slot;}catch(error){showToast(error.message);}}});

WeekwiseTaskOptions.populateZones(document);
showStorageRecoveryNotice();
renderWorkspaceView();renderReminders();nudgeDueReminders();renderTaskNotificationSettings();checkTaskReminders();setInterval(()=>{checkTaskReminders();checkHabitReminders();},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkTaskReminders();});window.addEventListener('focus',checkTaskReminders);

setInterval(refreshClock,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshClock();});window.addEventListener('focus',refreshClock);
})();
