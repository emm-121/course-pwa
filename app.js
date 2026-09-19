import {
  addDaysISO,
  mondayOfISO,
  semesterWeek,
  zonedNow,
  meetingTimeForDate,
  periodsForDate,
  meetingsForDate,
  dayStatus,
  nextMeetingAfter,
  summarizeWeeks,
  formatDuration,
  weekdayOfISO,
  timeToMinutes
} from './core.js';

const state = {
  semester: null,
  periods: [],
  timeProfiles: [],
  meetings: [],
  exceptions: [],
  holidays: [],
  scheduleMeta: null,
  selectedDate: null,
  lastRefresh: 0
};

const els = {};
let touchStart = null;

boot();

async function boot() {
  cacheEls();
  bindEvents();
  try {
    await refreshData(false);
    state.selectedDate = zonedNow(state.semester.timezone).iso;
    render();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `<main style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;padding:32px;max-width:520px;margin:auto"><h2>课表暂时打不开</h2><p style="color:#777;line-height:1.7">数据文件没有成功加载。部署到 GitHub Pages 后会自动支持离线缓存；如果你正在直接打开本地文件，请使用附带的单文件预览版。</p></main>`;
  }
}

function cacheEls() {
  for (const id of ['semesterLabel','headline','dateStrip','dateTitle','dateSubtitle','holidayBanner','courseList','courseCount','heroCard','nextDayCard','weekList','weekRange','datePicker','toast','infoSemester','infoStart','infoUpdated','infoMode','refreshState','installCard']) {
    els[id] = document.getElementById(id);
  }
}

function bindEvents() {
  document.getElementById('todayBtn').addEventListener('click', goToday);
  document.getElementById('weekTodayBtn').addEventListener('click', goToday);
  document.getElementById('prevWeekBtn').addEventListener('click', () => setDate(addDaysISO(state.selectedDate, -7)));
  document.getElementById('nextWeekBtn').addEventListener('click', () => setDate(addDaysISO(state.selectedDate, 7)));
  document.getElementById('pickDateBtn').addEventListener('click', () => {
    els.datePicker.value = state.selectedDate;
    if (els.datePicker.showPicker) els.datePicker.showPicker(); else els.datePicker.click();
  });
  els.datePicker.addEventListener('change', e => e.target.value && setDate(e.target.value));

  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  document.getElementById('refreshBtn').addEventListener('click', manualRefresh);

  const todayView = document.getElementById('todayView');
  todayView.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    touchStart = {x:t.clientX, y:t.clientY};
  }, {passive:true});
  todayView.addEventListener('touchend', e => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 58 && Math.abs(dx) > Math.abs(dy) * 1.45) setDate(addDaysISO(state.selectedDate, dx < 0 ? 1 : -1));
  }, {passive:true});

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - state.lastRefresh > 5 * 60 * 1000) refreshData(true);
  });
  window.addEventListener('online', () => refreshData(true));
}

async function refreshData(silent = true) {
  const inline = window.__COURSE_DATA__;
  const [sem, sch, ex, hol] = inline
    ? [inline.semester, inline.schedule, inline.exceptions, inline.holidays || {holidays:[]}]
    : await Promise.all([
        loadJson('./data/semester.json'),
        loadJson('./data/schedule.json'),
        loadJson('./data/exceptions.json'),
        loadJson('./data/holidays.json').catch(() => ({holidays:[]}))
      ]);

  // 维护页允许临时把刚导入的 schedule.json 放进本机预览。
  // 正式运行仍以 GitHub 上的远程数据为准；去掉 URL 参数后不会改变其他设备。
  if (new URLSearchParams(location.search).get('previewImport') === '1') {
    try {
      const localPreview = JSON.parse(localStorage.getItem('coursePwaPreviewSchedule') || 'null');
      if (localPreview?.meetings?.length) sch.meetings = localPreview.meetings, sch.updatedAt = localPreview.updatedAt || sch.updatedAt, sch.source = localPreview.source || sch.source;
    } catch {}
  }

  const oldUpdated = state.scheduleMeta?.updatedAt;
  state.semester = sem.semester;
  state.periods = sem.periods || [];
  state.timeProfiles = sem.timeProfiles || [];
  state.meetings = sch.meetings;
  state.exceptions = ex.exceptions || [];
  state.holidays = hol.holidays || [];
  state.scheduleMeta = sch;
  state.lastRefresh = Date.now();

  if (state.selectedDate) render();
  const changed = Boolean(oldUpdated && sch.updatedAt !== oldUpdated);
  if (silent && changed) toast('课表数据已更新');
  return {changed, updatedAt: sch.updatedAt || null};
}

async function loadJson(url) {
  const response = await fetch(url, {cache:'no-store'});
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

function model() {
  return {semester: state.semester, periods: state.periods, timeProfiles: state.timeProfiles, meetings: state.meetings, exceptions: state.exceptions};
}

function render() {
  if (!state.selectedDate) return;
  els.semesterLabel.textContent = state.semester.label;
  renderDateStrip();
  renderToday();
  renderWeek();
  renderAbout();
}

function renderDateStrip() {
  const monday = mondayOfISO(state.selectedDate);
  const today = zonedNow(state.semester.timezone).iso;
  const names = ['一','二','三','四','五','六','日'];
  els.dateStrip.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const iso = addDaysISO(monday, i);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `date-pill${iso === state.selectedDate ? ' selected' : ''}${iso === today ? ' today' : ''}`;
    b.innerHTML = `<span class="dow">周${names[i]}</span><span class="day">${Number(iso.slice(8,10))}</span>`;
    b.addEventListener('click', () => setDate(iso));
    els.dateStrip.appendChild(b);
  }
}

function renderToday() {
  const m = model();
  const meetings = meetingsForDate(state.selectedDate, m);
  const week = semesterWeek(state.selectedDate, state.semester);
  const schoolNow = zonedNow(state.semester.timezone);
  const isToday = state.selectedDate === schoolNow.iso;
  const [year, month, day] = state.selectedDate.split('-').map(Number);
  const weekday = ['','周一','周二','周三','周四','周五','周六','周日'][weekdayOfISO(state.selectedDate)];

  els.headline.textContent = isToday ? '今天' : `${month}月${day}日`;
  els.dateTitle.textContent = `${month}月${day}日 · ${weekday}`;
  els.dateSubtitle.textContent = week >= 1 && week <= state.semester.weekCount ? `第 ${week} 周` : `${year} 年 · 学期范围外`;

  const periodsTotal = meetings.reduce((n, x) => n + (x.endPeriod - x.startPeriod + 1), 0);
  els.courseCount.textContent = meetings.length ? `${meetings.length} 门课 · ${periodsTotal} 节` : '无课程';

  renderHolidayNotice();
  renderHero(meetings, isToday, schoolNow);
  renderCourseList(meetings, isToday, schoolNow);
  renderNextDay();
}

function renderHolidayNotice() {
  const entries = state.holidays.filter(h => h.date === state.selectedDate);
  const hasSchoolRule = state.exceptions.some(e => e.date === state.selectedDate);
  if (!entries.length) {
    els.holidayBanner.hidden = true;
    els.holidayBanner.innerHTML = '';
    return;
  }
  const h = entries[0];
  const kind = h.kind === 'workday' ? '调休工作日' : '法定节假日';
  const status = hasSchoolRule ? '已应用学校课表规则' : '学校教学安排尚未确认，当前不自动删课/补课';
  els.holidayBanner.hidden = false;
  els.holidayBanner.innerHTML = `<strong>${esc(h.name || kind)} · ${kind}</strong><span>${esc(status)}</span>`;
}

function renderHero(meetings, isToday, schoolNow) {
  const m = model();
  const status = dayStatus(state.selectedDate, m);

  if (status.kind === 'empty') {
    const next = nextMeetingAfter(state.selectedDate, m);
    els.heroCard.innerHTML = `<div class="hero-empty">
      <div class="hero-label">${isToday ? '今天' : '这一天'}</div>
      <h2 class="hero-name">没有课程</h2>
      <div class="hero-meta">${next ? `下一次上课：${relativeDateLabel(next.date)} · ${displayStart(next.meeting, next.date)}` : '当前学期暂时没有后续课程'}</div>
    </div>`;
    return;
  }

  if (status.kind === 'finished' && isToday) {
    const next = nextMeetingAfter(state.selectedDate, m);
    els.heroCard.innerHTML = `<div class="hero-empty">
      <div class="hero-label">今天</div>
      <h2 class="hero-name">今天的课上完了</h2>
      <div class="hero-meta">${next ? `下一次：${relativeDateLabel(next.date)} ${displayStart(next.meeting, next.date)} · ${esc(next.meeting.course)}` : '当前学期暂时没有后续课程'}</div>
    </div>`;
    return;
  }

  const meeting = status.meeting || meetings[0];
  const t = meetingTimeForDate(meeting, state.selectedDate, m);
  let label = '第一节课';
  let countdown = '';
  let progress = '';

  if (status.kind === 'active') {
    label = '正在上课';
    countdown = `还有 ${formatDuration(status.minutesRemaining)}下课`;
    const duration = t.endMinutes - t.startMinutes;
    const elapsed = schoolNow.minutes - t.startMinutes;
    const percent = duration > 0 ? Math.max(0, Math.min(100, elapsed / duration * 100)) : 0;
    progress = `<div class="hero-progress"><i style="width:${percent.toFixed(1)}%"></i></div>`;
  } else if (status.kind === 'activePartial') {
    label = '正在上课';
    countdown = '结束时间暂未显示';
  } else if (status.kind === 'next') {
    label = '下一节';
    countdown = `${formatDuration(status.minutesUntil)}后开始`;
  } else if (!isToday) {
    label = '第一节课';
  }

  const labelClass = status.kind === 'active' || status.kind === 'activePartial' ? 'hero-label live' : 'hero-label';
  els.heroCard.innerHTML = `
    <div class="${labelClass}">${label}</div>
    <div class="hero-time">${esc(displayTimeRange(meeting))}</div>
    <h2 class="hero-name">${esc(meeting.course)}</h2>
    <div class="hero-meta">${esc(meeting.location || '地点未提供')}${meeting.teacher ? `<br>${esc(meeting.teacher)}` : ''}</div>
    <div class="hero-bottom"><span class="hero-countdown">${esc(countdown)}</span><span class="hero-periods">第 ${meeting.startPeriod}${meeting.endPeriod !== meeting.startPeriod ? `–${meeting.endPeriod}` : ''} 节</span></div>
    ${progress}`;
}

function renderCourseList(meetings, isToday, schoolNow) {
  const m = model();
  if (!meetings.length) {
    els.courseList.innerHTML = `<div class="empty-list"><strong>这天没有课</strong><span>可以安排自己的时间。</span></div>`;
    return;
  }

  els.courseList.innerHTML = meetings.map(meeting => {
    const t = meetingTimeForDate(meeting, state.selectedDate, m);
    const active = isToday && t.startMinutes !== null && t.endMinutes !== null && schoolNow.minutes >= t.startMinutes && schoolNow.minutes < t.endMinutes;
    const past = isToday && t.endMinutes !== null && schoolNow.minutes >= t.endMinutes;
    return `<article class="course-card${active ? ' is-active' : ''}${past ? ' is-past' : ''}" style="--course-color:${meeting.color || '#315efb'}">
      <div class="course-time">${esc(displayStart(meeting, state.selectedDate))}<small>第 ${meeting.startPeriod}${meeting.endPeriod !== meeting.startPeriod ? `–${meeting.endPeriod}` : ''} 节</small></div>
      <div class="course-bar"></div>
      <div class="course-main">
        <div class="course-title-row"><div class="course-name">${esc(meeting.course)}</div>${active ? '<span class="live-badge">进行中</span>' : ''}</div>
        <div class="course-detail">${esc(meeting.location || '地点未提供')}${meeting.teacher ? `<br>${esc(meeting.teacher)}` : ''}</div>
        <div class="course-tags"><span class="tag">${esc(meeting.exception && (!meeting.weeks || !meeting.weeks.length) ? '临时课程' : summarizeWeeks(meeting.weeks))}</span>${meeting.movedFrom ? `<span class="tag">调自 ${esc(meeting.movedFrom.slice(5))}</span>` : ''}</div>
      </div>
    </article>`;
  }).join('');
}

function renderNextDay() {
  const nextDate = addDaysISO(state.selectedDate, 1);
  const ms = meetingsForDate(nextDate, model());
  const today = zonedNow(state.semester.timezone).iso;
  const title = state.selectedDate === today ? `明天 · ${weekdayLabel(nextDate)}` : `${shortDate(nextDate)} · ${weekdayLabel(nextDate)}`;
  const summary = ms.length ? `${ms.length} 门课 · ${ms.slice(0,2).map(x => x.course).join('、')}${ms.length > 2 ? '…' : ''}` : '没有课程';
  els.nextDayCard.innerHTML = `<span><strong>${esc(title)}</strong><small>${esc(summary)}</small></span><span class="arrow">›</span>`;
  els.nextDayCard.onclick = () => setDate(nextDate);
}

function renderWeek() {
  const monday = mondayOfISO(state.selectedDate);
  const sunday = addDaysISO(monday, 6);
  const week = semesterWeek(state.selectedDate, state.semester);
  els.weekRange.textContent = `${shortDate(monday)} – ${shortDate(sunday)} · 第 ${week} 周`;
  const today = zonedNow(state.semester.timezone).iso;

  els.weekList.innerHTML = Array.from({length:7}, (_, i) => {
    const iso = addDaysISO(monday, i);
    const ms = meetingsForDate(iso, model());
    const inner = ms.length ? ms.map(x => `<div class="week-course">
      <div class="week-course-time">${esc(displayStart(x, iso))}</div>
      <div class="week-course-bar" style="--course-color:${x.color || '#315efb'}"></div>
      <div><div class="week-course-name">${esc(x.course)}</div><div class="week-course-meta">${esc(x.location || '地点未提供')}</div></div>
    </div>`).join('') : '<div class="week-empty">无课</div>';
    return `<section class="week-day${iso === today ? ' is-today' : ''}" data-date="${iso}">
      <div class="week-day-header"><strong>${weekdayLabel(iso)} · ${shortDate(iso)}</strong><span>${ms.length ? `${ms.length} 门课` : '无课'}</span></div>${inner}
    </section>`;
  }).join('');

  els.weekList.querySelectorAll('.week-day').forEach(day => day.addEventListener('click', () => {
    setDate(day.dataset.date);
    switchView('todayView');
  }));
}

function renderAbout() {
  els.infoSemester.textContent = state.semester.label;
  els.infoStart.textContent = state.semester.firstWeekMonday;
  els.infoUpdated.textContent = state.scheduleMeta?.updatedAt ? state.scheduleMeta.updatedAt.slice(0,10) : '—';
  const standalone = isStandalone();
  els.infoMode.textContent = standalone ? '主屏幕 App' : 'Safari 网页';
  els.installCard.hidden = standalone;
  els.refreshState.textContent = navigator.onLine ? '联网时会获取最新数据' : '当前离线，正在使用缓存';
}

async function manualRefresh() {
  const btn = document.getElementById('refreshBtn');
  const before = state.scheduleMeta?.updatedAt || null;
  btn.disabled = true;
  els.refreshState.textContent = '正在检查…';
  try {
    const result = await refreshData(false);
    const changed = result.changed || (before && result.updatedAt && before !== result.updatedAt);
    els.refreshState.textContent = navigator.onLine ? '刚刚检查过' : '当前离线，正在使用缓存';
    toast(changed ? '课表已更新' : '已经是最新课表');
  } catch (error) {
    console.error(error);
    els.refreshState.textContent = '检查失败，请稍后再试';
    toast('暂时无法检查更新');
  } finally {
    btn.disabled = false;
  }
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function displayStart(meeting, iso = state.selectedDate) {
  return periodsForDate(iso, model()).find(p => p.index === meeting.startPeriod)?.start || `第${meeting.startPeriod}节`;
}

function displayTimeRange(meeting) {
  const {start, end} = meetingTimeForDate(meeting, state.selectedDate, model());
  if (start && end) return `${start}–${end}`;
  if (start) return `${start} · 第${meeting.startPeriod}–${meeting.endPeriod}节`;
  return `第${meeting.startPeriod}–${meeting.endPeriod}节`;
}

function switchView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  if (id === 'weekView') renderWeek();
  window.scrollTo({top:0, behavior:'smooth'});
}

function setDate(iso) {
  state.selectedDate = iso;
  render();
  window.scrollTo({top:0, behavior:'smooth'});
}

function goToday() {
  if (!state.semester) return;
  setDate(zonedNow(state.semester.timezone).iso);
}

function weekdayLabel(iso) {
  return ['','周一','周二','周三','周四','周五','周六','周日'][weekdayOfISO(iso)];
}
function shortDate(iso) { return `${Number(iso.slice(5,7))}/${Number(iso.slice(8,10))}`; }
function relativeDateLabel(iso) {
  const today = zonedNow(state.semester.timezone).iso;
  const tomorrow = addDaysISO(today, 1);
  if (iso === tomorrow) return `明天 ${weekdayLabel(iso)}`;
  return `${Number(iso.slice(5,7))}月${Number(iso.slice(8,10))}日 ${weekdayLabel(iso)}`;
}
function esc(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}
