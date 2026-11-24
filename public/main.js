const START = 7, END = 23;                       // calendar shows 7 AM to 11 PM
const DAYS = ['SUN', 'MON', 'TUES', 'WED', 'THURS', 'FRI', 'SAT'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let HOUR = 44;            // pixels per hour, recalculated so the calendar fits the window
let tasks = [];
let weekStart = sundayOf(new Date());
let dragged = null;       // task being dragged
let formList = 'floating'; // which "+" opened the form
let editingId = null;     // set while the form is editing an existing task

const $ = (id) => document.getElementById(id);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function sundayOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; }
const thisWeekISO = () => iso(sundayOf(new Date()));
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
const isMajor = (h) => h >= 8 && (h - 8) % 3 === 0;   // 8 AM, 11 AM, 2 PM, 5 PM, 8 PM
const hrs = (n) => `${n} hr${n === 1 ? '' : 's'}`;
function clock(h) {
  const hh = Math.floor(h) % 24, m = Math.round((h % 1) * 60);
  return `${((hh + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${hh < 12 ? 'AM' : 'PM'}`;
}
const repeatOf = (t) => t.repeat || 'none';
const when = (t) => `${range(t)}${repeatOf(t) === 'none' ? '' : ' ↻'}`;
const range = (t) => `${clock(t.startHour)} - ${clock(t.startHour + t.hours)}`;

// Scheduled tasks shown in a given week, as { t, day }. Repeating tasks appear from their first week onward.
function scheduledFor(ws) {
  const out = [];
  for (const t of tasks) {
    if (t.list !== 'scheduled') continue;
    const repeat = repeatOf(t);
    if (repeat === 'none') { if (t.weekStart === ws) out.push({ t, day: t.day }); }
    else if (ws >= t.weekStart) {                      // ISO dates compare in date order
      if (repeat === 'weekly') out.push({ t, day: t.day });
      else for (let d = 0; d < 7; d++) if (ws > t.weekStart || d >= t.day) out.push({ t, day: d });
    }
  }
  return out;
}

async function api(path = '', options = {}) {
  const res = await fetch(`/api/tasks${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
async function load() {
  try { tasks = await api(); } catch (err) { console.error(err); tasks = []; }
  render();
}
async function remove(task) { await api(`/${task._id}`, { method: 'DELETE' }); load(); }

/* ---------- rendering ---------- */
function render() {
  const ws = iso(weekStart);
  const end = new Date(weekStart); end.setDate(end.getDate() + 6);
  $('week-label').textContent = weekStart.getMonth() === end.getMonth()
    ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}-${end.getDate()}, ${end.getFullYear()}`
    : `${MONTHS[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()} - ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;

  const today = new Date();
  const thisWeek = thisWeekISO();
  const free = freeHours(ws);
  $('freetime').textContent = `Total Free Hours: ${+free.toFixed(1)}`;
  HOUR = Math.max(36, ($('calendar').clientHeight || 700) / (END - START));

  // day names + time labels (every hour; the 3-hourly ones are larger)
  const names = el('div');
  DAYS.forEach((d, i) => names.append(el('span', ws === thisWeek && i === today.getDay() ? 'today' : '', d)));
  $('day-names').replaceChildren(names);

  const labels = [];
  for (let h = START; h < END; h++) {
    const l = el('div', isMajor(h) ? 'major' : '', clock(h));
    l.style.top = `${(h - START) * HOUR}px`;
    labels.push(l);
  }
  $('times').replaceChildren(...labels);

  // calendar columns
  const cols = DAYS.map((_, day) => {
    const col = el('div', ws === thisWeek && day === today.getDay() ? 'col today' : 'col');
    for (let h = START + 1; h < END; h++) {
      const line = el('div', isMajor(h) ? 'hr major' : 'hr');
      line.style.top = `${(h - START) * HOUR}px`;
      col.append(line);
    }
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', (e) => dropOn(e, col, day));
    return col;
  });

  scheduledFor(ws).forEach(({ t, day }) => {
    const height = t.hours * HOUR;
    const short = height < 58;                       // too short for a separate time line
    const b = el('div', `block ${t.category}`);
    b.style.top = `${(t.startHour - START) * HOUR}px`;
    b.style.height = `${height}px`;
    b.title = t.description || t.title;

    const head = el('div', 'block-head');
    head.append(el('span', 'name', t.title));
    if (short) head.append(el('small', 'time', when(t)));
    head.append(xButton(t));
    b.append(head);

    let free = height - 16 - 21;                      // padding + title row
    if (!short) { b.append(el('p', 'time', when(t))); free -= 17; }
    const lines = Math.floor(free / 18);
    if (t.description && lines >= 1) {
      const d = el('p', 'desc', t.description);
      d.style.webkitLineClamp = lines;
      d.style.lineClamp = lines;
      b.append(d);
    }
    b.addEventListener('click', () => openEdit(t));
    makeDraggable(b, t);
    cols[day]?.append(b);
  });
  $('calendar').replaceChildren(...cols);

  // sidebar lists
  fill('list-today', scheduledFor(thisWeek).filter((o) => o.day === today.getDay()).map((o) => o.t)
    .sort((a, b) => a.startHour - b.startHour), 'Add a task for today.\nDrag task to desired time slot.', false, false);
  fill('list-floating', tasks.filter((t) => t.list === 'floating' && t.weekStart === ws), 'Add a flexible task.\nClick and drag task onto the calendar.', true, false);
  fill('list-checklist', tasks.filter((t) => t.list === 'checklist'), 'Add a task you need to complete every week.\nDrag task onto the calendar or check when completed.', true, true);
}

// Hours in the visible calendar (7 AM to 11 PM, all 7 days) with nothing scheduled. Overlaps count once.
function freeHours(ws) {
  const scheduled = scheduledFor(ws);
  let free = 0;
  for (let day = 0; day < 7; day++) {
    const spans = scheduled
      .filter((o) => o.day === day)
      .map(({ t }) => [Math.max(t.startHour, START), Math.min(t.startHour + t.hours, END)])
      .filter(([a, b]) => b > a)
      .sort((x, y) => x[0] - y[0]);
    let busy = 0, reached = START;
    for (const [a, b] of spans) {
      if (b > reached) { busy += b - Math.max(a, reached); reached = b; }
    }
    free += (END - START) - busy;
  }
  return free;
}

function fill(id, list, emptyText, draggable, checklist) {
  $(id).replaceChildren(...(list.length ? list.map((t) => chip(t, draggable, checklist)) : [el('p', 'empty', emptyText)]));
}
function chip(t, draggable, checklist) {
  const done = checklist && t.completedWeek === thisWeekISO();   // resets itself every Sunday
  const c = el('div', `chip ${t.category}${done ? ' done' : ''}`);
  c.title = t.description || t.title;
  if (checklist) c.append(checkbox(t, done));
  c.append(el('span', 'name', t.title), el('small', '', t.list === 'scheduled' ? when(t) : hrs(t.hours)), xButton(t));
  c.addEventListener('click', () => openEdit(t));
  if (draggable) makeDraggable(c, t);
  return c;
}
function checkbox(t, done) {
  const b = el('button', 'check', done ? '✓' : '');
  b.type = 'button';
  b.setAttribute('role', 'checkbox');
  b.setAttribute('aria-checked', String(done));
  b.setAttribute('aria-label', `Mark ${t.title} done`);
  b.addEventListener('click', async (e) => {
    e.stopPropagation();
    t.completedWeek = done ? null : thisWeekISO();
    render();
    try { await api(`/${t._id}`, { method: 'PUT', body: JSON.stringify({ completedWeek: t.completedWeek }) }); }
    catch (err) { console.error(err); load(); }
  });
  return b;
}
function xButton(t) {
  const b = el('button', 'x', '×');
  b.type = 'button'; b.setAttribute('aria-label', `Delete ${t.title}`);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (t.list === 'scheduled' && repeatOf(t) !== 'none' && !confirm('This task repeats. Delete it from every week?')) return;
    remove(t);
  });
  return b;
}
function makeDraggable(node, t) {
  node.draggable = true;
  node.addEventListener('dragstart', (e) => { dragged = t; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t._id); });
  node.addEventListener('dragend', () => { dragged = null; });
}

/* ---------- drag and drop ---------- */
async function dropOn(e, col, day) {
  e.preventDefault();
  col.classList.remove('over');
  const t = dragged; if (!t) return;
  dragged = null;

  const y = e.clientY - col.getBoundingClientRect().top;
  const snapped = START + Math.round((y / HOUR) * 2) / 2;
  const startHour = Math.min(Math.max(snapped, START), END - t.hours);
  const repeating = t.list === 'scheduled' && repeatOf(t) !== 'none';
  const place = repeating
    ? (repeatOf(t) === 'weekly' ? { day, startHour } : { startHour })   // series keeps its first week
    : { list: 'scheduled', day, startHour, weekStart: iso(weekStart) };

  try {
    if (t.list === 'checklist') {
      // checklist items repeat weekly, so dropping one schedules a copy for this week
      const { title, description, category, hours } = t;
      await api('', { method: 'POST', body: JSON.stringify({ title, description, category, hours, ...place }) });
    } else {
      await api(`/${t._id}`, { method: 'PUT', body: JSON.stringify(place) });
    }
  } catch (err) { console.error(err); }
  load();
}

/* ---------- popover form (add + edit) ---------- */
document.addEventListener('click', (e) => {
  const plus = e.target.closest('[data-list]');
  if (plus) { formList = plus.dataset.list; setMode(null); }
});

function setMode(id) {
  editingId = id;
  $('form-title').textContent = id ? 'Edit your plan' : 'What’s your plan?';
  $('form-submit').textContent = id ? 'Save Changes' : 'Add Task';
  if (!id) $('repeat-field').hidden = true;
}
function openEdit(t) {
  setMode(t._id);
  const f = $('task-form').elements;
  f.title.value = t.title;
  f.description.value = t.description || '';
  f.category.value = t.category;
  f.hours.value = t.hours;
  f.repeat.value = repeatOf(t);
  $('repeat-field').hidden = t.list !== 'scheduled';
  $('form-error').textContent = '';
  $('task-popover').showPopover();
}
$('task-popover').addEventListener('toggle', (e) => {
  if (e.newState === 'closed') { setMode(null); $('task-form').reset(); $('form-error').textContent = ''; }
});

$('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const body = Object.fromEntries(new FormData(form));
  if (editingId) {
    try {
      await api(`/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
      $('task-popover').hidePopover();
      load();
    } catch (err) { $('form-error').textContent = err.message; }
    return;
  }
  if (formList === 'floating') Object.assign(body, { list: 'floating', weekStart: iso(weekStart) });
  else if (formList === 'checklist') Object.assign(body, { list: 'checklist' });
  else Object.assign(body, { list: 'scheduled', day: new Date().getDay(), startHour: 8, weekStart: thisWeekISO() });

  try {
    await api('', { method: 'POST', body: JSON.stringify(body) });
    $('task-popover').hidePopover();
    load();
  } catch (err) {
    $('form-error').textContent = err.message;
  }
});

/* ---------- navigation + resize ---------- */
$('prev').addEventListener('click', () => { weekStart.setDate(weekStart.getDate() - 7); render(); });
$('next').addEventListener('click', () => { weekStart.setDate(weekStart.getDate() + 7); render(); });
window.addEventListener('resize', render);

load();
