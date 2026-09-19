export function isoToUtcMs(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDaysISO(iso, days) {
  const date = new Date(isoToUtcMs(iso) + days * 86400000);
  return date.toISOString().slice(0, 10);
}

export function weekdayOfISO(iso) {
  const d = new Date(isoToUtcMs(iso)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function mondayOfISO(iso) {
  return addDaysISO(iso, 1 - weekdayOfISO(iso));
}

export function semesterWeek(iso, semester) {
  return Math.floor((isoToUtcMs(iso) - isoToUtcMs(semester.firstWeekMonday)) / 604800000) + 1;
}

export function semesterEndDate(semester) {
  return addDaysISO(semester.firstWeekMonday, semester.weekCount * 7 - 1);
}

export function zonedNow(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

export function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function periodMap(periods) {
  return new Map((periods || []).map(p => [p.index, p]));
}

export function periodsForDate(iso, model) {
  const profiles = model?.timeProfiles || model?.semester?.timeProfiles || [];
  if (Array.isArray(profiles) && profiles.length) {
    const profile = profiles.find(p => {
      const afterStart = !p.effectiveFrom || iso >= p.effectiveFrom;
      const beforeEnd = !p.effectiveTo || iso <= p.effectiveTo;
      return afterStart && beforeEnd;
    });
    if (profile?.periods?.length) return profile.periods;
  }
  return model?.periods || [];
}

export function meetingTime(meeting, periods) {
  const map = periodMap(periods);
  const start = map.get(meeting.startPeriod)?.start || null;
  const end = map.get(meeting.endPeriod)?.end || null;
  return { start, end, startMinutes: timeToMinutes(start), endMinutes: timeToMinutes(end) };
}

export function meetingTimeForDate(meeting, iso, model) {
  return meetingTime(meeting, periodsForDate(iso, model));
}

function baseMeetingsForDate(iso, model, {weekdayOverride = null, weekOverride = null} = {}) {
  const { semester, meetings } = model;
  const week = weekOverride ?? semesterWeek(iso, semester);
  if (week < 1 || week > semester.weekCount) return [];
  const weekday = weekdayOverride ?? weekdayOfISO(iso);
  return meetings
    .filter(m => m.weekday === weekday && Array.isArray(m.weeks) && m.weeks.includes(week))
    .map(m => ({ ...m }));
}

export function meetingsForDate(iso, model) {
  const { semester, exceptions = [] } = model;
  const currentWeek = semesterWeek(iso, semester);
  if (currentWeek < 1 || currentWeek > semester.weekCount) return [];

  const dayRules = exceptions.filter(e => e.date === iso);
  let result;

  const useDateRule = dayRules.find(e => e.action === 'useDate' && e.sourceDate);
  const weekdayRule = dayRules.find(e => e.action === 'useWeekday' && e.weekday >= 1 && e.weekday <= 7);
  const dayOff = dayRules.some(e => e.action === 'dayOff');

  if (useDateRule) {
    const sourceDate = useDateRule.sourceDate;
    const sourceWeek = semesterWeek(sourceDate, semester);
    result = baseMeetingsForDate(sourceDate, model, {weekOverride: sourceWeek})
      .map(m => ({ ...m, exception: true, movedFrom: sourceDate }));
  } else if (dayOff) {
    result = [];
  } else if (weekdayRule) {
    result = baseMeetingsForDate(iso, model, {weekdayOverride: weekdayRule.weekday});
  } else {
    result = baseMeetingsForDate(iso, model);
  }

  for (const rule of dayRules) {
    if (rule.action === 'cancel') {
      result = result.filter(m => m.id !== rule.meetingId);
    } else if (rule.action === 'modify') {
      result = result.map(m => m.id === rule.meetingId ? { ...m, ...(rule.changes || {}), exception: true } : m);
    } else if (rule.action === 'add' && rule.meeting) {
      result.push({ ...rule.meeting, exception: true });
    }
  }

  return result.sort((a, b) => a.startPeriod - b.startPeriod || a.endPeriod - b.endPeriod || String(a.course).localeCompare(String(b.course), 'zh-CN'));
}

export function dayStatus(iso, model, now = new Date()) {
  const meetings = meetingsForDate(iso, model);
  if (!meetings.length) return { kind: 'empty', meetings };

  const schoolNow = zonedNow(model.semester.timezone, now);
  if (iso !== schoolNow.iso) return { kind: 'first', meeting: meetings[0], meetings };

  for (const meeting of meetings) {
    const t = meetingTimeForDate(meeting, iso, model);
    if (t.startMinutes !== null && t.endMinutes !== null && schoolNow.minutes >= t.startMinutes && schoolNow.minutes < t.endMinutes) {
      return { kind: 'active', meeting, minutesRemaining: t.endMinutes - schoolNow.minutes, meetings };
    }
    if (t.startMinutes !== null && t.endMinutes === null) {
      const firstPeriodEnd = timeToMinutes(periodsForDate(iso, model).find(p => p.index === meeting.startPeriod)?.end);
      if (firstPeriodEnd !== null && schoolNow.minutes >= t.startMinutes && schoolNow.minutes < firstPeriodEnd) {
        return { kind: 'activePartial', meeting, meetings };
      }
    }
  }

  const upcoming = meetings.find(m => {
    const t = meetingTimeForDate(m, iso, model);
    return t.startMinutes !== null && t.startMinutes > schoolNow.minutes;
  });
  if (upcoming) {
    const t = meetingTimeForDate(upcoming, iso, model);
    return { kind: 'next', meeting: upcoming, minutesUntil: t.startMinutes - schoolNow.minutes, meetings };
  }

  return { kind: 'finished', meeting: meetings.at(-1), meetings };
}

export function nextMeetingAfter(iso, model) {
  const end = semesterEndDate(model.semester);
  let date = iso;
  while (date < end) {
    date = addDaysISO(date, 1);
    const ms = meetingsForDate(date, model);
    if (ms.length) return { date, meeting: ms[0], daysAway: Math.round((isoToUtcMs(date) - isoToUtcMs(iso)) / 86400000) };
  }
  return null;
}

export function summarizeWeeks(weeks = []) {
  if (!weeks.length) return '周次待确认';
  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + 1) { prev = current; continue; }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = current; prev = current;
  }
  return `${ranges.join('、')}周`;
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}

export function findScheduleConflicts(meetings = []) {
  const conflicts = [];
  for (let i = 0; i < meetings.length; i++) {
    for (let j = i + 1; j < meetings.length; j++) {
      const a = meetings[i], b = meetings[j];
      if (a.weekday !== b.weekday) continue;
      const periodOverlap = Math.max(a.startPeriod, b.startPeriod) <= Math.min(a.endPeriod, b.endPeriod);
      if (!periodOverlap) continue;
      const bWeeks = new Set(b.weeks || []);
      const overlapWeeks = (a.weeks || []).filter(w => bWeeks.has(w));
      if (!overlapWeeks.length) continue;
      conflicts.push({a, b, weeks: overlapWeeks});
    }
  }
  return conflicts;
}
