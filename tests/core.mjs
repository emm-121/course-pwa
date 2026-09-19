import assert from 'node:assert/strict';
import { semesterWeek, meetingsForDate, summarizeWeeks, dayStatus, periodsForDate, findScheduleConflicts, nextMeetingAfter } from '../core.js';

const semester = { firstWeekMonday: '2026-08-31', weekCount: 18, timezone: 'Asia/Shanghai' };
const periods = [
  {index:1,start:'08:00',end:'08:50'}, {index:2,start:'09:00',end:'09:50'},
  {index:3,start:'10:10',end:'11:00'}, {index:4,start:'11:10',end:'12:00'}
];
const meetings = [
  {id:'a',course:'A',weekday:1,startPeriod:1,endPeriod:2,weeks:[1,2,3,4]},
  {id:'b',course:'B',weekday:2,startPeriod:3,endPeriod:4,weeks:[4]},
  {id:'odd',course:'Odd',weekday:2,startPeriod:1,endPeriod:2,weeks:[1,3,5,7]}
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
    {date:'2026-09-23', action:'useWeekday', weekday:2},
    {date:'2026-09-24', action:'dayOff'},
    {date:'2026-09-24', action:'add', meeting:{id:'extra',course:'补课',startPeriod:1,endPeriod:1,weeks:[]}}
  ]
};
assert.equal(meetingsForDate('2026-09-21', exceptionModel).length, 0);
assert.equal(meetingsForDate('2026-09-22', exceptionModel)[0].location, '新教室');
assert.equal(meetingsForDate('2026-09-23', exceptionModel)[0].id, 'b');
assert.equal(meetingsForDate('2026-09-24', exceptionModel)[0].id, 'extra'); // dayOff still allows explicit additions

// Cross-week holiday move must preserve the SOURCE date's week, not the target date's week.
const crossWeekModel = {
  ...model,
  exceptions:[{date:'2026-09-27',action:'useDate',sourceDate:'2026-09-15'}]
};
// 9/15 is week 3 Tuesday => odd course exists; 9/27 is week 4 Sunday.
const moved = meetingsForDate('2026-09-27', crossWeekModel);
assert.ok(moved.some(x => x.id === 'odd'));
assert.ok(moved.every(x => x.movedFrom === '2026-09-15'));

const profileModel = {
  ...model,
  timeProfiles:[
    {effectiveFrom:'2026-08-31',effectiveTo:'2026-09-30',periods:[{index:1,start:'08:00',end:'08:50'}]},
    {effectiveFrom:'2026-10-01',effectiveTo:'2027-01-03',periods:[{index:1,start:'08:30',end:'09:20'}]}
  ]
};
assert.equal(periodsForDate('2026-09-20', profileModel)[0].start,'08:00');
assert.equal(periodsForDate('2026-10-20', profileModel)[0].start,'08:30');

const conflicts = findScheduleConflicts([
  {id:'x',weekday:1,startPeriod:1,endPeriod:2,weeks:[1,2]},
  {id:'y',weekday:1,startPeriod:2,endPeriod:3,weeks:[2,3]},
  {id:'z',weekday:1,startPeriod:2,endPeriod:3,weeks:[4]}
]);
assert.equal(conflicts.length,1);
assert.deepEqual(conflicts[0].weeks,[2]);

const longGapModel={semester:{...semester,weekCount:18},periods,meetings:[{id:'late',course:'Late',weekday:1,startPeriod:1,endPeriod:1,weeks:[18]}],exceptions:[]};
assert.equal(nextMeetingAfter('2026-08-31',longGapModel).meeting.id,'late');

console.log('core tests passed');
