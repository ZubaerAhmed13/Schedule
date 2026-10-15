import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/weekwise-time-entry.js';
const parse=WeekwiseTimeEntry.parse;
test('easy time input accepts clear hour, compact and 24-hour clock expressions',()=>{
 const samples={'9':'09:00','09':'09:00','930':'09:30','0930':'09:30','9:3':'09:03','9:30':'09:30','17:30':'17:30','1730':'17:30','17.30':'17:30','0':'00:00','00:00':'00:00','23:59':'23:59','9am':'09:00','9pm':'21:00','12am':'00:00','12pm':'12:00'};
 for(const [input,expected]of Object.entries(samples))assert.equal(parse(input),expected,input);
});
test('start rejects midnight-end sentinel; end accepts only precise 24:00',()=>{
 assert.equal(parse('24:00'),null);assert.equal(parse('2400'),null);
 assert.equal(parse('24:00',{end:true}),'24:00');assert.equal(parse('24',{end:true}),'24:00');
 for(const invalid of ['24:01','2460','25','2360','90:00','9:99','-1','any','',null,undefined,'09:30:00','1:2:3']){
  assert.equal(parse(invalid,{end:true}),null,String(invalid));
 }
});
test('time parsing is read-only and independent of device time zone',()=>{
 const candidate={value:'17:45',other:{keep:true}},original=JSON.stringify(candidate);
 assert.equal(parse(candidate.value),'17:45');assert.equal(JSON.stringify(candidate),original);
});
