import assert from 'node:assert/strict';
import {parseWeeksText, parsePeriodWeekText, validateScheduleJson} from '../importers/zhengfang.js';
import {looksLikeWakeUpJson, convertWakeUpJson} from '../importers/wakeup.js';

assert.deepEqual(parseWeeksText('1-16周'), Array.from({length:16},(_,i)=>i+1));
assert.deepEqual(parseWeeksText('1-16周(单)'), [1,3,5,7,9,11,13,15]);
assert.deepEqual(parseWeeksText('2-16周(双)'), [2,4,6,8,10,12,14,16]);
assert.deepEqual(parseWeeksText('1-5周,8周,10-12周'), [1,2,3,4,5,8,10,11,12]);
assert.deepEqual(parsePeriodWeekText('(3-4节)4-18周'), {startPeriod:3,endPeriod:4,weeks:Array.from({length:15},(_,i)=>i+4),raw:'(3-4节)4-18周'});
assert.equal(validateScheduleJson({meetings:[{course:'A',weekday:1,startPeriod:1,endPeriod:2,weeks:[1]}]}).ok, true);
assert.equal(validateScheduleJson({meetings:[{course:'',weekday:8,startPeriod:0,endPeriod:0,weeks:[]}]}).ok, false);

const wake=[{courseName:'高数',day:1,room:'A101',teacher:'张老师',startNode:1,endNode:2,startWeek:1,endWeek:6,type:1}];
assert.equal(looksLikeWakeUpJson(wake),true);
const converted=convertWakeUpJson(wake,new Date('2026-09-20T00:00:00Z'));
assert.deepEqual(converted.meetings[0].weeks,[1,3,5]);
assert.equal(converted.meetings[0].course,'高数');

console.log('importer tests passed');
