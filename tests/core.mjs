import assert from 'node:assert/strict';
import { semesterWeek, meetingsForDate, summarizeWeeks, dayStatus } from '../core.js';

const semester = { firstWeekMonday: '2026-08-31', weekCount: 18, timezone: 'Asia/Shanghai' };
const periods = [
  {index:1,start:'08:00',end:'08:50'}, {index:2,start:'09:00',end:'09:50'},
  {index:3,start:'10:10',end:'11:00'}, {index:4,start:'11:10',end:'12:00'}
];
const meetings = [
  {id:'a',course:'A',weekday:1,startPeriod:1,endPeriod:2,weeks:[1,2,3,4]},
  {id:'b',course:'B',weekday:2,startPeriod:3,endPeriod:4,weeks:[4]}
];
const model = {semester, periods, meetings, exceptions:[]};
assert.equal(semesterWeek('2026-08-31', semester), 1);
assert.equal(semesterWeek('2026-09-21', semester), 4);
assert.equal(meetingsForDate('2026-09-21', model).length, 1);
assert.equal(meetingsForDate('2026-09-22', model)[0].id, 'b');
assert.equal(summarizeWeeks([1,2,3,5,7,8]), '1–3、5、7–8周');
const active = dayStatus('2026-09-21', model, new Date('2026-09-21T00:20:00Z')); // 08:20 Shanghai
assert.equal(active.kind, 'active');

const exceptionModel = {
  ...model,
  exceptions: [
    {date:'2026-09-21', action:'cancel', meetingId:'a'},
    {date:'2026-09-22', action:'modify', meetingId:'b', changes:{location:'新教室'}},
    {date:'2026-09-23', action:'useWeekday', weekday:2}
  ]
};
assert.equal(meetingsForDate('2026-09-21', exceptionModel).length, 0);
assert.equal(meetingsForDate('2026-09-22', exceptionModel)[0].location, '新教室');
assert.equal(meetingsForDate('2026-09-23', exceptionModel)[0].id, 'b');
console.log('core tests passed');
