import test from 'node:test';import assert from 'node:assert/strict';import '../js/weekwise-habits.js';
test('scheduled streak ignores weekends and explicitly skipped days',()=>{const h={scheduledDays:[1,2,3,4,5],skippedDates:['2026-10-09'],checkIns:['2026-10-08','2026-10-12']};assert.equal(WeekwiseHabits.streak(h,'2026-10-12'),2);assert.equal(WeekwiseHabits.due(h,'2026-10-10'),false);assert.deepEqual(WeekwiseHabits.consistency(h,'2026-10-08','2026-10-12'),{expected:2,done:2});});
test('paused habits keep history and make no current completion demand',()=>{const h={paused:true,checkIns:['2026-10-12']};assert.equal(WeekwiseHabits.due(h,'2026-10-12'),false);assert.equal(WeekwiseHabits.streak(h,'2026-10-12'),0);assert.equal(h.checkIns.length,1);});


test('flexible weekly targets work on any day without punishing rest days',()=>{
 const h={frequencyMode:'weekly-flexible',targetPerWeek:2,checkIns:['2026-10-05','2026-10-07','2026-10-12']};
 assert.equal(WeekwiseHabits.due(h,'2026-10-12'),true);
 assert.equal(WeekwiseHabits.due(h,'2026-10-13'),true);
 assert.equal(WeekwiseHabits.weekCount(h,'2026-10-12'),1);
 assert.equal(WeekwiseHabits.streak(h,'2026-10-12'),1,'the current unfinished week is not a failure');
 h.checkIns.push('2026-10-13');
 assert.equal(WeekwiseHabits.weekCount(h,'2026-10-13'),2);
 assert.equal(WeekwiseHabits.due(h,'2026-10-14'),false,'no reminders required after weekly target');
 assert.equal(WeekwiseHabits.streak(h,'2026-10-14'),2,'weekly streak counts completed weeks');
 assert.deepEqual(WeekwiseHabits.consistency(h,'2026-10-05','2026-10-17'),{expected:4,done:4});
 h.skippedDates=['2026-10-14'];
 assert.equal(WeekwiseHabits.due(h,'2026-10-14'),false);
 h.paused=true;
 assert.equal(WeekwiseHabits.streak(h,'2026-10-14'),0);
});
test('older scheduled weekday records stay unchanged and flexible targets are bounded',()=>{
 const old={scheduledDays:[1,3],checkIns:['2026-10-12']};
 assert.equal(WeekwiseHabits.flexible(old),false);
 assert.equal(WeekwiseHabits.due(old,'2026-10-13'),false);
 assert.equal(WeekwiseHabits.due(old,'2026-10-14'),true);
 assert.equal(WeekwiseHabits.target({targetPerWeek:99}),7);
 assert.equal(WeekwiseHabits.target({targetPerWeek:-3}),1);
});
test('Sunday finishes the Monday habit week without rewriting dated check-ins or skip history',()=>{
 const h={frequencyMode:'weekly-flexible',targetPerWeek:2,checkIns:['2026-10-11','2026-10-12','2026-10-18'],skippedDates:['2026-10-13']},before=JSON.stringify(h);
 assert.equal(WeekwiseHabits.weekCount(h,'2026-10-12'),2);
 assert.equal(WeekwiseHabits.weekCount(h,'2026-10-18'),2);
 assert.equal(WeekwiseHabits.weekCount(h,'2026-10-19'),0);
 assert.equal(WeekwiseHabits.due(h,'2026-10-18'),false);
 assert.deepEqual(WeekwiseHabits.consistency(h,'2026-10-12','2026-10-18'),{expected:2,done:2});
 assert.equal(JSON.stringify(h),before);
});
