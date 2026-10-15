/* habits controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function habitWeekRange(){const keys=habitWeekKeys();return weekwiseRuntime.fmtDate(weekwiseRuntime.parseKey(keys[0]),{day:'numeric',month:'short'})+' – '+weekwiseRuntime.fmtDate(weekwiseRuntime.parseKey(keys[6]),{day:'numeric',month:'short'});}

function habitToday(){return WeekwiseToday.clock(weekwiseRuntime.store,weekwiseRuntime.now.getTime()).date;}
function habitWeekKeys(){return WeekwiseCalendarRange.range(habitToday(),1);}

function habitCountThisWeek(habit){return WeekwiseHabits.weekCount(habit,habitToday());}

function habitStreak(habit){return WeekwiseHabits.streak(habit,habitToday());}

function habitHistoryDots(habit){const checks=new Set(habit.checkIns||[]);let markup='';for(let i=27;i>=0;i--){const d=weekwiseRuntime.parseKey(habitToday());d.setDate(d.getDate()-i);const key=weekwiseRuntime.dateKey(d);markup+='<span class="habit-history-dot '+(checks.has(key)?'checked':'')+'" title="'+weekwiseRuntime.escapeHtml(weekwiseRuntime.fmtDate(d,{weekday:'short',day:'numeric',month:'short'}))+(checks.has(key)?' · completed':'')+'"></span>';}return markup;}

function renderHabitTracker(){
 const list=weekwiseRuntime.$('habitTrackerList');if(!list)return;
 const range=weekwiseRuntime.$('habitWeekRange');if(range)range.textContent=weekwiseRuntime.habitWeekRange();
 const total=weekwiseRuntime.habits.length,completed=weekwiseRuntime.habits.filter(h=>weekwiseRuntime.habitCountThisWeek(h)>=WeekwiseHabits.target(h)).length;
 const summary=weekwiseRuntime.$('habitTrackerSummary');if(summary)summary.innerHTML=total?'<span><strong>'+completed+'/'+total+'</strong> habits at weekly target</span><span>Monday–Sunday totals · saved check-in dates stay unchanged</span>':'<span>No habits yet. Add a habit to start your progress history.</span>';
 if(!total){list.innerHTML='<div class="habit-empty-state"><strong>Build consistency, one check-in at a time.</strong><p>Create a habit above, choose a weekly target, then tap each day you complete it. Your check-ins and 28-day history are saved.</p></div>';return;}
 const keys=weekwiseRuntime.habitWeekKeys(),todayKey=habitToday();
 list.innerHTML=weekwiseRuntime.habits.map(h=>{
  const checks=new Set(h.checkIns||[]),done=keys.filter(k=>checks.has(k)).length,target=WeekwiseHabits.target(h),pct=Math.min(100,Math.round(done/target*100));
  const days=keys.map(k=>{const d=weekwiseRuntime.parseKey(k),checked=checks.has(k),isToday=k===todayKey,isFuture=k>todayKey,isRest=!WeekwiseHabits.due(h,k);return '<button type="button" class="habit-checkin-day '+(checked?'checked ':'')+(isToday?'today':'')+'" data-habit-check="'+weekwiseRuntime.escapeHtml(h.id)+'" data-habit-date="'+k+'" aria-pressed="'+(checked?'true':'false')+'" '+((isFuture||h.paused)?'disabled':'')+' title="'+weekwiseRuntime.escapeHtml(weekwiseRuntime.fmtDate(d,{weekday:'long',day:'numeric',month:'short'}))+(h.paused?' · paused':isRest?' · rest or skipped day':isFuture?' · future day':checked?' · done':' · mark done')+'"><span>'+weekwiseRuntime.DAY_SHORT[d.getDay()]+'</span><strong>'+(checked?'✓':isRest?'—':d.getDate())+'</strong></button>';}).join('');
  const targetText=WeekwiseHabits.flexible(h)?'Any '+target+' day'+(target===1?'':'s')+' this week':'Target '+target+' time'+(target===1?'':'s')+' per week';
  return '<article class="habit-track-card" data-habit-card="'+weekwiseRuntime.escapeHtml(h.id)+'"><header class="habit-track-head"><span class="habit-track-icon">'+weekwiseRuntime.escapeHtml(h.icon||'✦')+'</span><div class="habit-track-info"><h4>'+weekwiseRuntime.escapeHtml(h.title)+'</h4><p>'+weekwiseRuntime.escapeHtml(h.goal||targetText)+'</p></div><div class="habit-track-actions"><button type="button" data-habit-edit="'+weekwiseRuntime.escapeHtml(h.id)+'" aria-label="Edit '+weekwiseRuntime.escapeHtml(h.title)+'" title="Edit habit">✎</button><button type="button" data-habit-delete="'+weekwiseRuntime.escapeHtml(h.id)+'" aria-label="Delete '+weekwiseRuntime.escapeHtml(h.title)+'" title="Delete habit">×</button></div></header>'+
  '<div class="habit-track-progress"><div class="habit-track-progress-track"><span style="width:'+pct+'%"></span></div><strong>'+done+'/'+target+'</strong></div><div class="habit-checkin-days" aria-label="Daily habit check-ins">'+days+'</div>'+
  '<div class="plan-actions"><button class="btn" type="button" data-habit-skip="'+weekwiseRuntime.escapeHtml(h.id)+'">'+((h.skippedDates||[]).includes(todayKey)?'Restore today':'Skip today')+'</button></div><footer class="habit-track-foot"><span>'+(weekwiseRuntime.habitStreak(h)?'🔥 '+weekwiseRuntime.habitStreak(h)+(WeekwiseHabits.flexible(h)?' week':' day')+' streak':'28-day history')+'</span><div class="habit-history-dots"><span class="habit-history-label">History</span>'+weekwiseRuntime.habitHistoryDots(h)+'</div></footer></article>';
 }).join('');
}

function persistHabits(){weekwiseRuntime.checkedCollectionSave(weekwiseRuntime.HABITS_KEY,weekwiseRuntime.habits,value=>weekwiseRuntime.habits=value);}

function updateHabitFrequencyVisibility(){const el=weekwiseRuntime.$('habitScheduleFieldset');if(el)el.hidden=weekwiseRuntime.$('habitFrequencyMode').value==='weekly-flexible';}

function habitFormReset(){weekwiseRuntime.$('habitEditorDetails').open=false;weekwiseRuntime.$('habitFrequencyMode').value='scheduled-days';weekwiseRuntime.updateHabitFrequencyVisibility();document.querySelectorAll('[name=habitDay]').forEach(el=>el.checked=true);weekwiseRuntime.$('habitPaused').checked=false;weekwiseRuntime.$('habitReminderTime').value='';weekwiseRuntime.$('habitEditId').value='';weekwiseRuntime.$('habitName').value='';weekwiseRuntime.$('habitIcon').value='';weekwiseRuntime.$('habitGoal').value='';weekwiseRuntime.$('habitTargetPerWeek').value='5';weekwiseRuntime.$('saveHabitBtn').textContent='＋ Add habit';weekwiseRuntime.$('cancelHabitEdit').hidden=true;}

function saveHabitForm(e){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 e.preventDefault();const title=weekwiseRuntime.$('habitName').value.trim();if(!title){weekwiseRuntime.$('habitName').focus();return;}
 const scheduledDays=[...document.querySelectorAll('[name=habitDay]:checked')].map(el=>Number(el.value)),frequencyMode=weekwiseRuntime.$('habitFrequencyMode').value,paused=weekwiseRuntime.$('habitPaused').checked,reminderTime=weekwiseRuntime.$('habitReminderTime').value;if(frequencyMode!=='weekly-flexible'&&!scheduledDays.length){weekwiseRuntime.showToast('Choose at least one scheduled day.');return;}
 const id=weekwiseRuntime.$('habitEditId').value,icon=weekwiseRuntime.$('habitIcon').value.trim()||'✦',goal=weekwiseRuntime.$('habitGoal').value.trim(),targetPerWeek=Math.max(1,Math.min(7,Number(weekwiseRuntime.$('habitTargetPerWeek').value)||5));
 if(id){const habit=weekwiseRuntime.habits.find(h=>h.id===id);if(habit)Object.assign(habit,{title,icon,goal,targetPerWeek,scheduledDays,frequencyMode,paused,reminderTime,updatedAt:new Date().toISOString()});}
 else weekwiseRuntime.habits.push({id:'h'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),title,icon,goal,targetPerWeek,scheduledDays,frequencyMode,paused,reminderTime,skippedDates:[],checkIns:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 weekwiseRuntime.persistHabits();weekwiseRuntime.habitFormReset();weekwiseRuntime.renderHabitTracker();weekwiseRuntime.showToast(id?'Habit updated':'Habit added');
}

function editHabit(id){weekwiseRuntime.$('habitEditorDetails').open=true;const habit=weekwiseRuntime.habits.find(h=>h.id===id);if(!habit)return;document.querySelectorAll('[name=habitDay]').forEach(el=>el.checked=(habit.scheduledDays||[0,1,2,3,4,5,6]).includes(Number(el.value)));weekwiseRuntime.$('habitPaused').checked=!!habit.paused;weekwiseRuntime.$('habitReminderTime').value=habit.reminderTime||'';weekwiseRuntime.$('habitEditId').value=habit.id;weekwiseRuntime.$('habitName').value=habit.title||'';weekwiseRuntime.$('habitIcon').value=habit.icon||'';weekwiseRuntime.$('habitGoal').value=habit.goal||'';weekwiseRuntime.$('habitTargetPerWeek').value=String(habit.targetPerWeek||5);weekwiseRuntime.$('habitFrequencyMode').value=WeekwiseHabits.flexible(habit)?'weekly-flexible':'scheduled-days';weekwiseRuntime.updateHabitFrequencyVisibility();weekwiseRuntime.$('saveHabitBtn').textContent='Save changes';weekwiseRuntime.$('cancelHabitEdit').hidden=false;weekwiseRuntime.$('habitName').focus();}

function toggleHabitCheck(id,date){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}const habit=weekwiseRuntime.habits.find(h=>h.id===id);if(!habit||habit.paused||date>habitToday())return;const checks=new Set(habit.checkIns||[]);if(checks.has(date))checks.delete(date);else checks.add(date);habit.checkIns=[...checks].sort();habit.updatedAt=new Date().toISOString();weekwiseRuntime.persistHabits();weekwiseRuntime.renderHabitTracker();}

function skipHabitToday(id){if(!weekwiseRuntime.dataCanWrite())return;const h=weekwiseRuntime.habits.find(h=>h.id===id),today=habitToday();if(!h||h.paused)return;if((h.checkIns||[]).includes(today)){weekwiseRuntime.showToast('Today is already completed. Its check-in is preserved.');return;}const dates=new Set(h.skippedDates||[]);if(dates.has(today))dates.delete(today);else dates.add(today);h.skippedDates=[...dates].sort();weekwiseRuntime.persistHabits();weekwiseRuntime.renderHabitTracker();}

function checkHabitReminders(){if(!weekwiseRuntime.dataCanWrite()||document.hidden)return;const clock=WeekwiseToday.clock(weekwiseRuntime.store,Date.now()),today=clock.date,minute=clock.minute;let changed=false;for(const h of weekwiseRuntime.habits){if(!h.reminderTime||!WeekwiseHabits.due(h,today)||(h.checkIns||[]).includes(today)||h.lastReminderDate===today||weekwiseRuntime.timeMins(h.reminderTime)>minute)continue;weekwiseRuntime.showToast('Habit reminder: '+h.title);h.lastReminderDate=today;changed=true;}if(changed)weekwiseRuntime.persistHabits();}

function deleteHabit(id){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}const habit=weekwiseRuntime.habits.find(h=>h.id===id);if(!habit)return;if(!confirm('Delete the habit "'+habit.title+'"? Its check-in history will also be removed.'))return;weekwiseRuntime.habits=weekwiseRuntime.habits.filter(h=>h.id!==id);weekwiseRuntime.persistHabits();weekwiseRuntime.renderHabitTracker();weekwiseRuntime.showToast('Habit deleted');}

function addDaysToKey(key,delta){const d=weekwiseRuntime.parseKey(key);d.setDate(d.getDate()+delta);return weekwiseRuntime.dateKey(d);}
return Object.freeze({habitWeekRange,habitWeekKeys,habitCountThisWeek,habitStreak,habitHistoryDots,renderHabitTracker,persistHabits,updateHabitFrequencyVisibility,habitFormReset,saveHabitForm,editHabit,toggleHabitCheck,skipHabitToday,checkHabitReminders,deleteHabit,addDaysToKey});
}
root.WeekwiseAppHabits=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
