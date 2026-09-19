/*
 * Course PWA · 正方课表导出脚本 v1
 * 用法：粘贴到 iPhone「快捷指令」的“在网页上运行 JavaScript”动作中，
 * 并从 Safari 已打开的“学生课表查询（学期课表）”页面运行。
 * 输出：可直接作为 data/schedule.json 使用的 JSON 文本。
 */
(function () {
  'use strict';

  const clean = v => String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const multi = v => String(v || '').replace(/\u00a0/g, ' ').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim();
  const strip = (value, label) => clean(String(value || '').replace(label || '', '').replace(/^[：:\s]+/, ''));
  const safeUrl = () => location.origin + location.pathname;

  function weeks(input) {
    const text = clean(input).replace(/[，、；;]/g, ',').replace(/[－—~～至]/g, '-').replace(/第/g, '');
    const out = new Set();
    for (const raw of text.split(',').map(x => x.trim()).filter(Boolean)) {
      const part = raw.replace(/\s+/g, '');
      const odd = /(?:\(单\)|单周|周单|单)$/.test(part);
      const even = /(?:\(双\)|双周|周双|双)$/.test(part);
      const c = part.replace(/\((?:单|双)\)/g, '').replace(/(?:单周|双周|周单|周双|单|双)$/g, '').replace(/周/g, '');
      const r = c.match(/(\d+)\s*-\s*(\d+)/);
      if (r) {
        for (let w = Math.min(+r[1], +r[2]); w <= Math.max(+r[1], +r[2]); w++) {
          if (odd && w % 2 === 0) continue;
          if (even && w % 2 !== 0) continue;
          out.add(w);
        }
      } else {
        for (const n of (c.match(/\d+/g) || [])) {
          const w = +n;
          if (odd && w % 2 === 0) continue;
          if (even && w % 2 !== 0) continue;
          out.add(w);
        }
      }
    }
    return [...out].sort((a,b) => a-b);
  }

  function periodWeek(input) {
    const text = clean(input).replace(/[－—~～至]/g, '-');
    const m = text.match(/\(?\s*(\d+)\s*-\s*(\d+)\s*节\s*\)?/) || text.match(/第?\s*(\d+)\s*节/);
    if (!m) return null;
    return {start:+m[1], end:+(m[2] || m[1]), weeks:weeks(text.replace(m[0], '').trim()), raw:text};
  }

  function valueAfter(p, labelEl) {
    const fs = [...p.querySelectorAll('font')].map(x => clean(x.innerText || x.textContent || '')).filter(Boolean);
    if (fs.length) return fs[fs.length - 1];
    return strip(p.innerText || p.textContent || '', clean(labelEl?.innerText || labelEl?.textContent || labelEl?.getAttribute('title') || ''));
  }

  function fields(root) {
    const f = {course:'',section:'',teacher:'',location:'',periodWeek:''};
    for (const p of root.querySelectorAll('p')) {
      const l = p.querySelector('span[title]');
      const t = clean(l?.getAttribute('title') || '');
      const v = valueAfter(p, l);
      if (/节\s*\/\s*周|节次|周次/.test(t)) f.periodWeek ||= v;
      else if (/上课地点|地点|教室/.test(t)) f.location ||= v;
      else if (/教师|老师/.test(t)) f.teacher ||= v;
      else if (/教学班|班级|课程号/.test(t)) f.section ||= v;
    }
    const explicit = root.querySelector('[title="课程名称"], [data-kcmc]');
    if (explicit) f.course = clean(explicit.textContent || explicit.getAttribute('data-kcmc') || '');
    if (!f.course) {
      for (const el of [root.querySelector(':scope > span font'),root.querySelector(':scope > span'),root.querySelector('span font'),root.querySelector('font')].filter(Boolean)) {
        const v = clean(el.innerText || el.textContent || '').replace(/[：:]$/, '');
        if (v && v !== f.teacher && v !== f.location && v !== f.periodWeek && !/^(教师|上课地点|节\/周|节次|周次)$/.test(v)) { f.course = v; break; }
      }
    }
    const lines = multi(root.innerText || root.textContent || '').split('\n').map(clean).filter(Boolean);
    if (!f.course) f.course = lines.find(x => !/^(教师|上课地点|节\/周|节次|周次)/.test(x) && !/^\(?\d+-\d+节/.test(x)) || '';
    if (!f.section) f.section = lines.find(x => x !== f.course && /-\d{3,}[A-Za-z]?$/.test(x)) || '';
    return f;
  }

  function weekday(cell) {
    for (const v of [cell.id,cell.getAttribute('data-week'),cell.getAttribute('data-xqj'),cell.getAttribute('aria-label')].filter(Boolean)) {
      const s = String(v);
      const m = s.match(/^([1-7])(?:[-_]|$)/) || s.match(/(?:week|xqj)[-_]?([1-7])/i);
      if (m) return +m[1];
      const c = s.match(/周([一二三四五六日天])/);
      if (c) return ({一:1,二:2,三:3,四:4,五:5,六:6,日:7,天:7})[c[1]];
    }
    return null;
  }

  function roots(cell) {
    const out = [];
    for (const div of cell.querySelectorAll('div')) {
      if (div.closest('td') !== cell) continue;
      const hasLabel = [...div.querySelectorAll('[title]')].some(e => /节\s*\/\s*周|节次|周次/.test(e.getAttribute('title') || ''));
      const text = clean(div.innerText || div.textContent || '');
      const hasText = /\(?\d+\s*-\s*\d+\s*节\)?/.test(text) && /\d+\s*(?:-\s*\d+)?\s*周/.test(text);
      if (!hasLabel && !hasText) continue;
      const child = [...div.children].some(c => c.tagName === 'DIV' && /\(?\d+\s*-\s*\d+\s*节\)?/.test(clean(c.innerText || c.textContent || '')) && /\d+\s*(?:-\s*\d+)?\s*周/.test(clean(c.innerText || c.textContent || '')));
      if (!child) out.push(div);
    }
    if (!out.length && /\d+\s*(?:-\s*\d+)?\s*周/.test(clean(cell.innerText || cell.textContent || ''))) out.push(cell);
    return out;
  }

  function id(value) {
    let h = 2166136261;
    for (let i=0;i<value.length;i++) { h ^= value.charCodeAt(i); h = Math.imul(h,16777619); }
    return 'zf-' + (h >>> 0).toString(36);
  }
  function color(course) {
    const p=['#2563eb','#7c3aed','#db2777','#16a34a','#ea580c','#0284c7','#9333ea','#b91c1c','#0f766e','#64748b'];
    let h=0; for (const ch of course) h=(h*31+ch.charCodeAt(0))>>>0; return p[h%p.length];
  }
  function selected(selectors) {
    for (const s of selectors) {
      const e=document.querySelector(s); if(!e) continue;
      if(e.tagName==='SELECT') return clean(e.selectedOptions?.[0]?.textContent || e.options?.[e.selectedIndex]?.textContent || '');
      return clean(e.value || e.textContent || '');
    }
    return '';
  }

  try {
    const table=document.getElementById('kbgrid_table_0') || document.querySelector('table[id^="kbgrid_table_"]') || [...document.querySelectorAll('table')].find(t => /周一/.test(clean(t.innerText||t.textContent||'')) && /周二/.test(clean(t.innerText||t.textContent||'')));
    if(!table) {
      completion(JSON.stringify({ok:false,message:'没有找到正方课表表格，请确认已经切到“学期课表”并点过查询。',diagnostics:{url:safeUrl(),tableIds:[...document.querySelectorAll('table')].map(t=>t.id).filter(Boolean).slice(0,20)}}));
      return;
    }
    const meetings=[], seen=new Set();
    for(const cell of table.querySelectorAll('td[id]')) {
      const wd=weekday(cell); if(!wd) continue;
      for(const root of roots(cell)) {
        const f=fields(root); const pw=periodWeek(f.periodWeek || root.textContent || '');
        if(!pw || !pw.weeks.length || !f.course) continue;
        const key=[wd,pw.start,pw.end,f.course,f.teacher,f.location,pw.weeks.join('.')].join('|');
        if(seen.has(key)) continue; seen.add(key);
        meetings.push({id:id([f.course,f.section,wd,pw.start,pw.end,pw.weeks.join('-')].join('|')),course:f.course,section:f.section||'',teacher:clean(f.teacher),location:clean(f.location),weekday:wd,startPeriod:pw.start,endPeriod:pw.end,weeks:pw.weeks,color:color(f.course),confidence:'imported'});
      }
    }
    meetings.sort((a,b)=>a.weekday-b.weekday||a.startPeriod-b.startPeriod||a.course.localeCompare(b.course,'zh-CN'));
    if(!meetings.length) {
      completion(JSON.stringify({ok:false,message:'找到了课表，但没有识别到课程。请把这段诊断结果发回来，不需要再截图。',diagnostics:{url:safeUrl(),tableId:table.id||'',text:clean(table.innerText||table.textContent||'').slice(0,1800)}}));
      return;
    }
    const payload={schemaVersion:3,updatedAt:new Date().toISOString(),source:'正方教务学期课表自动导入（'+location.host+'）',importMeta:{parser:'zhengfang-shortcut-v1',semesterHint:{academicYear:selected(['#xnm','select[name="xnm"]','select[id*="xnm"]']),term:selected(['#xqm','select[name="xqm"]','select[id*="xqm"]'])},sourceUrl:safeUrl()},meetings};
    completion(JSON.stringify(payload,null,2));
  } catch (error) {
    completion(JSON.stringify({ok:false,message:'导出脚本运行失败',error:String(error && (error.stack||error.message) || error),diagnostics:{url:safeUrl()}}));
  }
})();
