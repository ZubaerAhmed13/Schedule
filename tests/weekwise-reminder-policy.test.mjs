import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-timezones.js';
import '../js/weekwise-data.js';
import '../js/weekwise-calendar-range.js';
import fs from 'node:fs';
if(fs.existsSync(new URL('../js/weekwise-reminder-policy.js',import.meta.url)))await import('../js/weekwise-reminder-policy.js');
const settings={timeZone:'UTC',reminderLeadMinutes:15};
const record=(task={})=>({week:'2030-01-06',task:{id:'a',title:'Activity',day:1,start:600,duration:30,...task}});
const at=Date.parse('2030-01-07T09:45:00Z');
test('automatic reminder preference is allowlisted and off by default',()=>{
 for(const invalid of [undefined,null,'',true,NaN,10,'bad',-1])assert.equal(WeekwiseReminderPolicy.leadMinutes(invalid),0);
 for(const n of [5,15,60])assert.equal(WeekwiseReminderPolicy.leadMinutes(n),n);
 assert.deepEqual(WeekwiseReminderPolicy.reminders(record(),{timeZone:'UTC'}),[]);
});
test('all upcoming activities derive the selected lead time without changing records',()=>{
 const r=record({fixed:true,custom:false,seriesId:'weekly'}),before=structuredClone(r);
 for(const lead of [5,15,60]){
 const [reminder]=WeekwiseReminderPolicy.reminders(r,{...settings,reminderLeadMinutes:lead});
 assert.equal(reminder.at,Date.parse('2030-01-07T10:00:00Z')-lead*60000);
 assert.equal(reminder.automatic,true);assert.equal(reminder.value,new Date(reminder.at).toISOString());
 }
 assert.deepEqual(r,before);
 assert.equal(WeekwiseReminderPolicy.reminders(record({start:660}),settings)[0].at,at+3600000);
});
test('custom reminders retain identifiers, take precedence, and deduplicate exact instants',()=>{
 const r=record({reminderTimes:['2030-01-07T09:30','2030-01-07T09:30:00Z']});
 const reminders=WeekwiseReminderPolicy.reminders(r,settings);
 assert.equal(reminders.length,1);assert.equal(reminders[0].value,'2030-01-07T09:30');assert.equal(reminders[0].automatic,false);
 r.task.reminderNotifiedTimes=['2030-01-07T09:30'];assert.deepEqual(WeekwiseReminderPolicy.reminders(r,settings),[]);
});
test('completed, archived, all-day, unscheduled and invalid times never produce automatic reminders',()=>{
 for(const fields of [{done:true},{status:'done'},{archived:true},{allDay:true},{unscheduled:true},{start:null},{start:-1},{start:1440},{day:9},{duration:NaN}])assert.deepEqual(WeekwiseReminderPolicy.reminders(record(fields),settings),[],JSON.stringify(fields));
});
test('due automatic reminders catch up only until the activity starts; explicit catch-up stays compatible',()=>{
 assert.equal(WeekwiseReminderPolicy.due(record(),settings,at-1).length,0);
 assert.equal(WeekwiseReminderPolicy.due(record(),settings,at+1).length,1);
 assert.equal(WeekwiseReminderPolicy.due(record(),settings,at+15*60000).length,0);
 assert.equal(WeekwiseReminderPolicy.due(record({reminderAt:'2030-01-07T09:45'}),settings,at+3600000).length,1);
 assert.equal(WeekwiseReminderPolicy.due(record({reminderAt:'2030-01-07T09:45'}),settings,at+86400000).length,0);
});
test('midnight and saved-zone DST anchors determine the real instant, never the display zone',()=>{
 const r=record({start:15});const [reminder]=WeekwiseReminderPolicy.reminders(r,{timeZone:'Asia/Tokyo',reminderLeadMinutes:60});
 assert.equal(new Date(reminder.at).toISOString(),'2030-01-06T14:15:00.000Z');
 const fold={week:'2030-10-27',task:{id:'fold',day:0,start:150,duration:30}};
 assert.deepEqual(WeekwiseReminderPolicy.reminders(fold,{...settings,timeZone:'Europe/Berlin'}),[]);
 fold.task.scheduleInstant={start:Date.parse('2030-10-27T01:30Z'),end:Date.parse('2030-10-27T02:00Z'),anchor:{week:fold.week,day:0,start:150,duration:30,zone:'Europe/Berlin'}};
 assert.equal(WeekwiseReminderPolicy.reminders(fold,{...settings,timeZone:'Europe/Berlin'})[0].at,Date.parse('2030-10-27T01:15Z'));
 assert.deepEqual(WeekwiseReminderPolicy.reminders(record(),{...settings,timeZone:'Invalid/Zone'}),[]);
});

test('optional category defaults override global timing but never custom reminders',()=>{
 const r=record({type:'study'}),before=structuredClone(r);
 const chosen={...settings,reminderCategoryLeadMinutes:{study:60,life:0}};
 assert.equal(WeekwiseReminderPolicy.preferredLead(chosen,r.task),60);
 assert.equal(WeekwiseReminderPolicy.reminders(r,chosen)[0].at,Date.parse('2030-01-07T09:00:00Z'));
 assert.equal(WeekwiseReminderPolicy.reminders(record({type:'life'}),chosen).length,0);
 assert.equal(WeekwiseReminderPolicy.reminders(record({type:'hobby'}),chosen)[0].at,at);
 assert.equal(WeekwiseReminderPolicy.preferredLead({...settings,reminderCategoryLeadMinutes:{other:5}},record({type:'legacy-class'}).task),5);
 const explicit=record({type:'study',reminderTimes:['2030-01-07T09:35']});
 assert.equal(WeekwiseReminderPolicy.reminders(explicit,chosen)[0].automatic,false);
 assert.deepEqual(r,before);
});
test('quiet hours respect the saved planner zone, midnight and same-day windows',()=>{
 const quiet={enabled:true,start:'22:00',end:'07:00'};
 const zone={...settings,reminderQuietHours:quiet};
 assert.equal(WeekwiseReminderPolicy.duringQuietHours(zone,Date.parse('2030-01-07T22:30Z')),true);
 assert.equal(WeekwiseReminderPolicy.duringQuietHours(zone,Date.parse('2030-01-07T06:59Z')),true);
 assert.equal(WeekwiseReminderPolicy.duringQuietHours(zone,Date.parse('2030-01-07T07:00Z')),false);
 assert.equal(WeekwiseReminderPolicy.duringQuietHours({...zone,timeZone:'Asia/Tokyo'},Date.parse('2030-01-07T15:00Z')),true);
 assert.equal(WeekwiseReminderPolicy.duringQuietHours({...zone,reminderQuietHours:{enabled:true,start:'12:00',end:'13:00'}},Date.parse('2030-01-07T12:30Z')),true);
 assert.equal(WeekwiseReminderPolicy.duringQuietHours({...zone,reminderQuietHours:{enabled:true,start:'10:00',end:'10:00'}},Date.parse('2030-01-07T10:00Z')),false);
});
test('quiet alerts never replay after quiet hours; disabling quiet hours preserves old delivery',()=>{
 const r=record({reminderAt:'2030-01-07T06:30:00Z'});
 const zone={...settings,reminderQuietHours:{enabled:true,start:'22:00',end:'07:00'}};
 assert.equal(WeekwiseReminderPolicy.due(r,zone,Date.parse('2030-01-07T06:31Z')).length,0);
 assert.equal(WeekwiseReminderPolicy.due(r,zone,Date.parse('2030-01-07T07:30Z')).length,0);
 assert.equal(WeekwiseReminderPolicy.due(r,{...zone,reminderQuietHours:{enabled:false,start:'22:00',end:'07:00'}},Date.parse('2030-01-07T07:30Z')).length,1);
});
