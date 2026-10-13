/* startup controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function refreshClock(){const fresh=new Date();if(fresh.getMinutes()===weekwiseRuntime.now.getMinutes()&&weekwiseRuntime.dateKey(fresh)===weekwiseRuntime.dateKey(weekwiseRuntime.now))return;const dateChanged=weekwiseRuntime.dateKey(fresh)!==weekwiseRuntime.dateKey(weekwiseRuntime.now)||WeekwiseToday.clock(weekwiseRuntime.store,fresh.getTime()).date!==WeekwiseToday.clock(weekwiseRuntime.store,weekwiseRuntime.now.getTime()).date;weekwiseRuntime.now=fresh;weekwiseRuntime.renderDays();weekwiseRuntime.renderStats();weekwiseRuntime.renderTodayOverview();weekwiseRuntime.renderExperience();if(dateChanged){weekwiseRuntime.renderWorkspaceTasks();weekwiseRuntime.updateWorkspaceCounts();weekwiseRuntime.renderReminders();weekwiseRuntime.nudgeDueReminders();}}
return Object.freeze({refreshClock});
}
root.WeekwiseAppStartup=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
