/**
 * 新版正方教务课表解析器。
 *
 * 设计目标：
 * 1. 不依赖学校账号、密码或 Cookie 的外传；只解析用户当前已打开的课表页面。
 * 2. 输出 Course PWA 自己的 meetings[] 结构，与 UI 解耦。
 * 3. 解析失败时返回诊断信息，便于针对学校版本做小范围适配。
 */

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function parseWeeksText(input) {
  const text = normalizeText(input)
    .replace(/[，、；;]/g, ',')
    .replace(/[－—~～至]/g, '-')
    .replace(/第/g, '');

  const result = new Set();
  // 允许：1-16周、1-16周(单)、1-16周单周、1,3,5周、4-8周,10周。
  const parts = text.split(',').map(x => x.trim()).filter(Boolean);
  for (const rawPart of parts) {
    const part = rawPart.replace(/\s+/g, '');
    const odd = /(?:\(单\)|单周|周单|单)$/.test(part);
    const even = /(?:\(双\)|双周|周双|双)$/.test(part);
    const cleaned = part.replace(/\((?:单|双)\)/g, '').replace(/(?:单周|双周|周单|周双|单|双)$/g, '').replace(/周/g, '');

    const range = cleaned.match(/(\d+)\s*-\s*(\d+)/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      for (let w = start; w <= end; w++) {
        if (odd && w % 2 === 0) continue;
        if (even && w % 2 !== 0) continue;
        result.add(w);
      }
      continue;
    }

    const nums = cleaned.match(/\d+/g) || [];
    for (const n of nums) {
      const w = Number(n);
      if (odd && w % 2 === 0) continue;
      if (even && w % 2 !== 0) continue;
      result.add(w);
    }
  }

  // 某些页面会写成 “1-16周(单),2-16周(双)”；如果逗号拆分没有命中，做一次全局兜底。
  if (!result.size) {
    const re = /(\d+)(?:\s*-\s*(\d+))?\s*周?\s*(\((单|双)\)|单周|双周)?/g;
    let m;
    while ((m = re.exec(text))) {
      const start = Number(m[1]);
      const end = Number(m[2] || m[1]);
      const mode = m[4] || (m[3] || '').replace(/[()周]/g, '');
      for (let w = start; w <= end; w++) {
        if (mode === '单' && w % 2 === 0) continue;
        if (mode === '双' && w % 2 !== 0) continue;
        result.add(w);
      }
    }
  }

  return [...result].filter(Number.isFinite).sort((a, b) => a - b);
}

export function parsePeriodWeekText(input) {
  const text = normalizeText(input).replace(/[－—~～至]/g, '-');
  const period = text.match(/\(?\s*(\d+)\s*-\s*(\d+)\s*节\s*\)?/)
    || text.match(/第?\s*(\d+)\s*节/);
  if (!period) return null;

  const startPeriod = Number(period[1]);
  const endPeriod = Number(period[2] || period[1]);
  const weeksText = text.replace(period[0], '').trim();
  const weeks = parseWeeksText(weeksText);
  return {startPeriod, endPeriod, weeks, raw: text};
}

export function parseZhengfangDocument(doc, context = {}) {
  const table = doc.getElementById('kbgrid_table_0')
    || doc.querySelector('table[id^="kbgrid_table_"]')
    || findLikelyScheduleTable(doc);

  if (!table) {
    return failure('没有找到正方学期课表表格', doc, context, {reason: 'table-not-found'});
  }

  const meetings = [];
  const seen = new Set();
  const cells = [...table.querySelectorAll('td[id]')];

  for (const cell of cells) {
    const weekday = weekdayFromCell(cell);
    if (!weekday) continue;

    const roots = findCourseRoots(cell);
    for (const root of roots) {
      const fields = readCourseFields(root);
      const periodWeek = parsePeriodWeekText(fields.periodWeek || root.textContent || '');
      if (!periodWeek || !periodWeek.weeks.length) continue;

      const course = fields.course || inferCourseName(root, fields);
      if (!course) continue;

      const teacher = fields.teacher || '';
      const location = fields.location || '';
      const section = fields.section || '';
      const key = [weekday, periodWeek.startPeriod, periodWeek.endPeriod, course, teacher, location, periodWeek.weeks.join('.')].join('|');
      if (seen.has(key)) continue;
      seen.add(key);

      meetings.push({
        id: stableId([course, section, weekday, periodWeek.startPeriod, periodWeek.endPeriod, periodWeek.weeks.join('-')].join('|')),
        course,
        section,
        teacher,
        location,
        weekday,
        startPeriod: periodWeek.startPeriod,
        endPeriod: periodWeek.endPeriod,
        weeks: periodWeek.weeks,
        color: colorForCourse(course),
        confidence: 'imported',
        sourceRaw: {
          periodWeek: fields.periodWeek || periodWeek.raw,
          cellId: cell.id || ''
        }
      });
    }
  }

  meetings.sort((a, b) => a.weekday - b.weekday || a.startPeriod - b.startPeriod || a.course.localeCompare(b.course, 'zh-CN'));

  if (!meetings.length) {
    return failure('找到课表表格，但没有成功识别课程', doc, context, {
      reason: 'no-meetings',
      tableId: table.id || '',
      cellCount: cells.length,
      tableTextSample: normalizeText(table.innerText || table.textContent || '').slice(0, 1800)
    });
  }

  return {
    ok: true,
    parser: 'zhengfang-dom-v1',
    source: {
      host: context.host || doc.location?.host || '',
      href: safeUrl(context.href || doc.location?.href || ''),
      title: context.title || doc.title || ''
    },
    semesterHint: readSemesterHint(doc),
    meetings,
    diagnostics: {
      tableId: table.id || '',
      courseCount: meetings.length,
      cellCount: cells.length
    }
  };
}

export function buildScheduleJson(parsed, now = new Date()) {
  if (!parsed?.ok) throw new Error(parsed?.message || '课表解析失败');
  return {
    schemaVersion: 3,
    updatedAt: now.toISOString(),
    source: `正方教务学期课表自动导入（${parsed.source?.host || 'unknown host'}）`,
    importMeta: {
      parser: parsed.parser,
      semesterHint: parsed.semesterHint || null,
      sourceUrl: safeUrl(parsed.source?.href || '')
    },
    meetings: parsed.meetings.map(({sourceRaw, ...m}) => m)
  };
}

export function validateScheduleJson(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return {ok:false, errors:['不是有效的 JSON 对象']};
  if (!Array.isArray(data.meetings)) errors.push('缺少 meetings 数组');
  else {
    data.meetings.forEach((m, i) => {
      if (!m.course) errors.push(`第 ${i + 1} 项缺少课程名`);
      if (!(m.weekday >= 1 && m.weekday <= 7)) errors.push(`第 ${i + 1} 项 weekday 无效`);
      if (!(m.startPeriod >= 1) || !(m.endPeriod >= m.startPeriod)) errors.push(`第 ${i + 1} 项节次无效`);
      if (!Array.isArray(m.weeks) || !m.weeks.length) errors.push(`第 ${i + 1} 项周次为空`);
    });
  }
  return {ok: errors.length === 0, errors};
}

function readCourseFields(root) {
  const fields = {course:'', section:'', teacher:'', location:'', periodWeek:''};

  // 正方常见结构：p > span[title="节/周|上课地点|教师"] + font
  for (const p of root.querySelectorAll('p')) {
    const labelEl = p.querySelector('span[title]');
    const title = normalizeText(labelEl?.getAttribute('title') || '');
    const value = valueAfterLabel(p, labelEl);
    if (/节\s*\/\s*周|节次|周次/.test(title)) fields.periodWeek ||= value;
    else if (/上课地点|地点|教室/.test(title)) fields.location ||= value;
    else if (/教师|老师/.test(title)) fields.teacher ||= value;
    else if (/教学班|班级|课程号/.test(title)) fields.section ||= value;
  }

  // 兼容 title 直接挂在其他节点上。
  for (const el of root.querySelectorAll('[title]')) {
    const title = normalizeText(el.getAttribute('title') || '');
    const value = normalizeText(el.nextElementSibling?.innerText || el.parentElement?.innerText || '');
    if (!fields.periodWeek && /节\s*\/\s*周|节次|周次/.test(title)) fields.periodWeek = stripLabel(value, title);
    if (!fields.location && /上课地点|地点|教室/.test(title)) fields.location = stripLabel(value, title);
    if (!fields.teacher && /教师|老师/.test(title)) fields.teacher = stripLabel(value, title);
  }

  fields.course = inferCourseName(root, fields);
  fields.section ||= inferSection(root, fields.course);
  fields.location = cleanupField(fields.location);
  fields.teacher = cleanupField(fields.teacher);
  return fields;
}

function inferCourseName(root, fields) {
  const explicit = root.querySelector('[title="课程名称"], [data-kcmc]');
  if (explicit) {
    const v = cleanupField(explicit.textContent || explicit.getAttribute('data-kcmc') || '');
    if (v) return v;
  }

  const candidates = [
    root.querySelector(':scope > span font'),
    root.querySelector(':scope > span'),
    root.querySelector('span font'),
    root.querySelector('font')
  ].filter(Boolean);

  for (const el of candidates) {
    let value = cleanupField(el.innerText || el.textContent || '');
    value = value.replace(/[：:]$/, '');
    if (!value) continue;
    if (value === fields.teacher || value === fields.location || value === fields.periodWeek) continue;
    if (/^(教师|上课地点|节\/周|节次|周次)$/.test(value)) continue;
    return value;
  }

  // 最后兜底：取 root 的第一行，并剔除明显标签。
  const lines = normalizeMultiline(root.innerText || root.textContent || '').split('\n').map(cleanupField).filter(Boolean);
  return lines.find(x => !/^(教师|上课地点|节\/周|节次|周次)/.test(x) && !/^\(?\d+-\d+节/.test(x)) || '';
}

function inferSection(root, course) {
  const text = normalizeMultiline(root.innerText || root.textContent || '');
  const lines = text.split('\n').map(cleanupField).filter(Boolean);
  const withCode = lines.find(x => x !== course && /-\d{3,}[A-Za-z]?$/.test(x));
  return withCode || '';
}

function findCourseRoots(cell) {
  const roots = [];
  const candidates = [...cell.querySelectorAll('div')];
  for (const div of candidates) {
    if (div.closest('td') !== cell) continue;
    const hasPeriodLabel = [...div.querySelectorAll('[title]')].some(el => /节\s*\/\s*周|节次|周次/.test(el.getAttribute('title') || ''));
    const text = normalizeText(div.innerText || div.textContent || '');
    const hasPeriodText = /\(?\d+\s*-\s*\d+\s*节\)?/.test(text) && /\d+\s*(?:-\s*\d+)?\s*周/.test(text);
    if (!hasPeriodLabel && !hasPeriodText) continue;

    // 只取最内层满足条件的课程块，避免父 div / 子 div 重复解析。
    const childAlsoCourse = [...div.children].some(child => {
      const ct = normalizeText(child.innerText || child.textContent || '');
      return child.tagName === 'DIV' && (/\(?\d+\s*-\s*\d+\s*节\)?/.test(ct) && /\d+\s*(?:-\s*\d+)?\s*周/.test(ct));
    });
    if (!childAlsoCourse) roots.push(div);
  }

  // 部分版本课程信息直接放在 td 中。
  if (!roots.length) {
    const text = normalizeText(cell.innerText || cell.textContent || '');
    if (/\d+\s*(?:-\s*\d+)?\s*周/.test(text)) roots.push(cell);
  }
  return roots;
}

function weekdayFromCell(cell) {
  const values = [cell.id, cell.getAttribute('data-week'), cell.getAttribute('data-xqj'), cell.getAttribute('aria-label')].filter(Boolean);
  for (const value of values) {
    const s = String(value);
    const first = s.match(/^([1-7])(?:[-_]|$)/) || s.match(/(?:week|xqj)[-_]?([1-7])/i);
    if (first) return Number(first[1]);
    const chinese = s.match(/周([一二三四五六日天])/);
    if (chinese) return {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7,'天':7}[chinese[1]];
  }
  return null;
}

function valueAfterLabel(container, labelEl) {
  if (!container) return '';
  const fonts = [...container.querySelectorAll('font')].map(x => cleanupField(x.innerText || x.textContent || '')).filter(Boolean);
  if (fonts.length) return fonts[fonts.length - 1];
  const full = cleanupField(container.innerText || container.textContent || '');
  const label = cleanupField(labelEl?.innerText || labelEl?.textContent || labelEl?.getAttribute('title') || '');
  return stripLabel(full, label);
}

function stripLabel(value, label) {
  return cleanupField(String(value || '').replace(label || '', '').replace(/^[：:\s]+/, ''));
}

function readSemesterHint(doc) {
  const year = selectedText(doc, ['#xnm', 'select[name="xnm"]', 'select[id*="xnm"]']) || '';
  const term = selectedText(doc, ['#xqm', 'select[name="xqm"]', 'select[id*="xqm"]']) || '';
  return {academicYear: year, term};
}

function selectedText(doc, selectors) {
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    if (!el) continue;
    if (el.tagName === 'SELECT') return cleanupField(el.selectedOptions?.[0]?.textContent || el.options?.[el.selectedIndex]?.textContent || '');
    return cleanupField(el.value || el.textContent || '');
  }
  return '';
}

function findLikelyScheduleTable(doc) {
  return [...doc.querySelectorAll('table')].find(table => {
    const text = normalizeText(table.innerText || table.textContent || '');
    return /周一/.test(text) && /周二/.test(text) && /节次|节数/.test(text);
  }) || null;
}

function failure(message, doc, context, extra = {}) {
  return {
    ok: false,
    message,
    source: {
      host: context.host || doc.location?.host || '',
      href: safeUrl(context.href || doc.location?.href || ''),
      title: context.title || doc.title || ''
    },
    diagnostics: {
      ...extra,
      tableIds: [...doc.querySelectorAll('table')].map(t => t.id).filter(Boolean).slice(0, 20),
      selectIds: [...doc.querySelectorAll('select')].map(s => s.id || s.name).filter(Boolean).slice(0, 20)
    }
  };
}

function safeUrl(value) {
  try { const u = new URL(value); return u.origin + u.pathname; } catch { return String(value || '').split(/[?#]/)[0]; }
}

function cleanupField(value) {
  return normalizeText(value).replace(/^[：:\s]+|[：:\s]+$/g, '');
}
function normalizeText(value) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
function normalizeMultiline(value) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim(); }
function stableId(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `zf-${(h >>> 0).toString(36)}`;
}
function colorForCourse(course) {
  const palette = ['#2563eb','#7c3aed','#db2777','#16a34a','#ea580c','#0284c7','#9333ea','#b91c1c','#0f766e','#64748b'];
  let h = 0;
  for (const ch of course) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export const _internals = {DAY_NAMES, weekdayFromCell, readCourseFields, stableId, colorForCourse};
