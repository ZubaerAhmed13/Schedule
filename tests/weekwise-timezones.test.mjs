import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-timezones.js';
const zone=globalThis.WeekwiseTimeZones;
const prop=(value,TZID)=>({value,params:TZID?{TZID}:{}});
test('Europe/Berlin, New York and half-hour offsets convert precisely to UTC',()=>{
 assert.equal(zone.parseDateProperty(prop('20260701T100000','Europe/Berlin')).date.toISOString(),'2026-07-01T08:00:00.000Z');
 assert.equal(zone.parseDateProperty(prop('20261201T100000','Europe/Berlin')).date.toISOString(),'2026-12-01T09:00:00.000Z');
 assert.equal(zone.parseDateProperty(prop('20260701T090000','America/New_York')).date.toISOString(),'2026-07-01T13:00:00.000Z');
 assert.equal(zone.parseDateProperty(prop('20260701T100000','Asia/Kolkata')).date.toISOString(),'2026-07-01T04:30:00.000Z');
});
test('nonexistent and ambiguous TZID wall times are rejected, not guessed',()=>{
 assert.throws(()=>zone.parseDateProperty(prop('20260329T023000','Europe/Berlin')),/Nonexistent local time/);
 assert.throws(()=>zone.parseDateProperty(prop('20261025T023000','Europe/Berlin')),/Ambiguous local time/);
 assert.throws(()=>zone.parseDateProperty(prop('20261101T013000','America/New_York')),/Ambiguous local time/);
 assert.throws(()=>zone.parseDateProperty(prop('20260308T023000','America/New_York')),/Nonexistent local time/);
});
test('absolute UTC dates ignore device zone and invalid TZIDs are explicit',()=>{
 assert.equal(zone.parseDateProperty(prop('20261025T013000Z')).date.toISOString(),'2026-10-25T01:30:00.000Z');
 assert.throws(()=>zone.parseDateProperty(prop('20261025T013000Z','Europe/Berlin')),/must not also declare TZID/);
 assert.throws(()=>zone.parseDateProperty(prop('20260501T100000','Mars/Phobos')),/Unsupported iCalendar time zone/);
 assert.throws(()=>zone.parseDateProperty(prop('20260230T130000','Europe/Berlin')),/Invalid iCalendar date/);
 assert.throws(()=>zone.parseDateProperty(prop('20260229T130000Z')),/Invalid iCalendar date/);
 assert.equal(zone.parseDateProperty(prop('20240229T130000Z')).date.toISOString(),'2024-02-29T13:00:00.000Z');
});
test('date-only values never move calendar days when parsed as local dates',()=>{
 const result=zone.parseDateProperty(prop('20261025'));
 assert.equal(result.allDay,true);
 assert.equal(result.date.getFullYear(),2026);
 assert.equal(result.date.getMonth(),9);
 assert.equal(result.date.getDate(),25);
 assert.throws(()=>zone.parseDateProperty(prop('20261025','Europe/Berlin')),/date-only/);
});
