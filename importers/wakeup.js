function pickList(data) {
  if (Array.isArray(data)) return data;
  for (const key of ['courseList','courses','schedule','data']) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return null;
}

function weeksFrom(item) {
  const start = Number(item.startWeek ?? item.start_week ?? 1);
  const end = Number(item.endWeek ?? item.end_week ?? start);
  const type = Number(item.type ?? item.weekType ?? 0); // 0 every, 1 odd, 2 even
  const weeks = [];
  for (let w = Math.min(start,end); w <= Math.max(start,end); w++) {
    if (type === 1 && w % 2 === 0) continue;
    if (type === 2 && w % 2 !== 0) continue;
    weeks.push(w);
  }
  return weeks;
}

function stableId(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `wk-${(h >>> 0).toString(36)}`;
}
function colorForCourse(course) {
  const palette = ['#2563eb','#7c3aed','#db2777','#16a34a','#ea580c','#0284c7','#9333ea','#b91c1c','#0f766e','#64748b'];
  let h = 0; for (const ch of String(course || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export function looksLikeWakeUpJson(data) {
  const list = pickList(data);
  if (!list?.length) return false;
  return list.some(x => x && ('courseName' in x || 'startNode' in x || 'startWeek' in x));
}

export function convertWakeUpJson(data, now = new Date()) {
  const list = pickList(data);
  if (!list) throw new Error('没有找到 WakeUp 课程数组');
  const meetings = [];
  const seen = new Set();
  for (const item of list) {
    const course = String(item.courseName ?? item.name ?? '').trim();
    const weekday = Number(item.day ?? item.weekday);
    const startPeriod = Number(item.startNode ?? item.startPeriod);
    const endPeriod = Number(item.endNode ?? item.endPeriod ?? startPeriod);
    const weeks = weeksFrom(item);
    if (!course || !(weekday >= 1 && weekday <= 7) || !(startPeriod >= 1) || endPeriod < startPeriod || !weeks.length) continue;
    const teacher = String(item.teacher ?? '').trim();
    const location = String(item.room ?? item.location ?? '').trim();
    const section = String(item.section ?? '').trim();
    const key = [course, weekday, startPeriod, endPeriod, weeks.join('.'), teacher, location].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    meetings.push({
      id: stableId(key), course, section, teacher, location, weekday, startPeriod, endPeriod, weeks,
      color: item.color || colorForCourse(course), confidence: 'imported'
    });
  }
  if (!meetings.length) throw new Error('WakeUp JSON 中没有识别到有效课程');
  meetings.sort((a,b) => a.weekday-b.weekday || a.startPeriod-b.startPeriod || a.course.localeCompare(b.course,'zh-CN'));
  return {
    schemaVersion: 3,
    updatedAt: now.toISOString(),
    source: 'WakeUp / Sleepy 兼容 JSON 导入',
    importMeta: {parser:'wakeup-json-v1'},
    meetings
  };
}
