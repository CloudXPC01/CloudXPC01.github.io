// Visit dashboard: stat tiles, daily visits chart, and ranked breakdowns.
import { h, esc } from '../dom.js';
import { DEMO, fb } from '../store.js';
import { dayKey, SOURCES, CLICKS } from '../analytics.js';
import { PLATFORMS } from '../platforms.js';
import { card, note, icon } from './forms.js';

const SOURCE_LABEL = {
  direct: 'Direct / typed link', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', search: 'Search engines',
  behance: 'Behance', artstation: 'ArtStation', whatsapp: 'WhatsApp', x: 'X / Twitter', facebook: 'Facebook',
  github: 'GitHub', reddit: 'Reddit', other: 'Other websites',
};

const fmtDay = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtNum = (n) => Number(n || 0).toLocaleString();

function lastDays(n) {
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i)));
  return out;
}

// Deterministic fake numbers so demo mode shows what the dashboard looks like.
function sample(keys, projects) {
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const days = keys.map((key, i) => {
    const visits = Math.round(6 + i * 0.6 + rnd() * 14 + (i % 7 === 5 ? 12 : 0));
    const mobile = Math.round(visits * (0.55 + rnd() * 0.15));
    const day = { key, visits, uniques: Math.round(visits * 0.8), newVisitors: Math.round(visits * 0.6), mobile, desktop: visits - mobile };
    let left = visits;
    for (const s of ['instagram', 'linkedin', 'direct', 'search', 'whatsapp', 'behance']) {
      const n = Math.min(left, Math.round(visits * (s === 'instagram' ? 0.38 : s === 'linkedin' ? 0.24 : 0.1) * (0.7 + rnd() * 0.6)));
      day[`s_${s}`] = n;
      left -= n;
    }
    day.s_other = left;
    day.c_instagram = Math.round(rnd() * 3);
    day.c_linkedin = Math.round(rnd() * 3);
    day.c_email = Math.round(rnd() * 2);
    day.c_resume = Math.round(rnd() * 2);
    return day;
  });
  const total = days.reduce((t, d) => { for (const [k, v] of Object.entries(d)) if (typeof v === 'number') t[k] = (t[k] || 0) + v; return t; }, {});
  total.visits += 312;
  return { days, total, projects: projects.slice(0, 6).map((p, i) => ({ id: p.id, count: Math.round(90 / (i + 1)) })) };
}

async function loadStats(keys, projects) {
  if (DEMO) return sample(keys, projects);
  const { db, fs } = await fb();
  const [daySnap, totalSnap, projSnap] = await Promise.all([
    fs.getDocs(fs.query(fs.collection(db, 'days'), fs.where(fs.documentId(), '>=', keys[0]))),
    fs.getDoc(fs.doc(db, 'stats', 'total')),
    fs.getDocs(fs.query(fs.collection(db, 'projectViews'), fs.orderBy('count', 'desc'), fs.limit(10))),
  ]);
  const byDay = {};
  daySnap.forEach((d) => { byDay[d.id] = d.data(); });
  return {
    days: keys.map((key) => ({ key, ...(byDay[key] || {}) })),
    total: totalSnap.exists() ? totalSnap.data() : {},
    projects: projSnap.docs.map((d) => ({ id: d.id, count: d.data().count || 0 })),
  };
}

const sum = (days, k) => days.reduce((s, d) => s + (d[k] || 0), 0);

function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

function tile(label, value, sub) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-l' }, label), h('span', { class: 'stat-v' }, fmtNum(value)), sub ? h('span', { class: 'stat-s' }, sub) : null);
}

function barChart(days) {
  const max = niceMax(Math.max(1, ...days.map((d) => d.visits || 0)));
  const tip = h('div', { class: 'tip', role: 'status' });
  const step = days.length > 14 ? 7 : 2;
  const cols = days.map((d, i) => h('div', {
    class: 'col', 'data-i': i, tabindex: 0,
    'aria-label': `${fmtDay(d.key)}: ${d.visits || 0} visits, ${d.uniques || 0} unique visitors`,
  }, h('span', { class: 'bar', style: `height:${((d.visits || 0) / max) * 100}%` })));
  const plot = h('div', { class: 'plot' },
    [1, 0.5].map((f) => h('span', { class: 'gl', style: `bottom:${f * 100}%` }, h('span', {}, fmtNum(max * f)))),
    h('span', { class: 'gl base', style: 'bottom:0' }, h('span', {}, '0')),
    h('div', { class: 'cols' }, cols),
    tip);
  const axis = h('div', { class: 'xaxis' }, days.map((d, i) => h('span', {}, (days.length - 1 - i) % step === 0 ? fmtDay(d.key) : '')));
  const show = (col) => {
    const d = days[+col.dataset.i];
    cols.forEach((c) => c.classList.toggle('on', c === col));
    tip.innerHTML = `<b>${esc(fmtDay(d.key))}</b><span>${fmtNum(d.visits)} visits</span><span>${fmtNum(d.uniques)} unique</span>`;
    tip.classList.add('show');
    const pr = plot.getBoundingClientRect();
    const cr = col.getBoundingClientRect();
    const x = cr.left - pr.left + cr.width / 2;
    tip.style.left = `${Math.max(60, Math.min(pr.width - 60, x))}px`;
  };
  const hide = () => { tip.classList.remove('show'); cols.forEach((c) => c.classList.remove('on')); };
  cols.forEach((c) => {
    c.addEventListener('pointerenter', () => show(c));
    c.addEventListener('focus', () => show(c));
    c.addEventListener('blur', hide);
  });
  plot.addEventListener('pointerleave', hide);

  const table = h('table', { class: 'dtable', hidden: true },
    h('thead', {}, h('tr', {}, h('th', {}, 'Day'), h('th', {}, 'Visits'), h('th', {}, 'Unique'), h('th', {}, 'Phone'), h('th', {}, 'PC'))),
    h('tbody', {}, [...days].reverse().map((d) => h('tr', {}, h('td', {}, fmtDay(d.key)), h('td', {}, fmtNum(d.visits)), h('td', {}, fmtNum(d.uniques)), h('td', {}, fmtNum(d.mobile)), h('td', {}, fmtNum(d.desktop))))));
  const chart = h('div', { class: 'chart' }, plot, axis);
  const toggleBtn = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => {
    const asTable = table.hidden;
    table.hidden = !asTable;
    chart.hidden = asTable;
    toggleBtn.lastChild.textContent = asTable ? 'Chart' : 'Table';
  } }, icon('fa-table'), h('span', {}, 'Table'));
  return { el: h('div', {}, chart, table), toggleBtn };
}

// Horizontal ranked bars: label, bar, value. One hue (magnitude), text in neutral ink.
function ranked(rows, { empty = 'No data yet.' } = {}) {
  const items = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  if (!items.length) return h('p', { class: 'muted small' }, empty);
  const max = items[0].value;
  return h('ul', { class: 'ranked' }, items.map((r) => h('li', {},
    h('span', { class: 'rk-label' }, r.icon ? h('i', { class: r.icon }) : null, r.label),
    h('span', { class: 'rk-track' }, h('span', { class: 'rk-bar', style: `width:${Math.max(2, (r.value / max) * 100)}%` })),
    h('span', { class: 'rk-val' }, fmtNum(r.value)))));
}

function deviceSplit(days) {
  const m = sum(days, 'mobile');
  const d = sum(days, 'desktop');
  const t = m + d;
  if (!t) return h('p', { class: 'muted small' }, 'No visits yet.');
  const pm = Math.round((m / t) * 100);
  return h('div', { class: 'split' },
    h('div', { class: 'split-bar' },
      h('span', { class: 'split-a', style: `flex:${m}` }),
      h('span', { class: 'split-b', style: `flex:${d}` })),
    h('div', { class: 'split-legend' },
      h('span', {}, h('i', { class: 'sw-a' }), icon('fa-mobile-screen'), ` Phone  ${pm}%`, h('small', {}, ` (${fmtNum(m)})`)),
      h('span', {}, h('i', { class: 'sw-b' }), icon('fa-desktop'), ` PC  ${100 - pm}%`, h('small', {}, ` (${fmtNum(d)})`))));
}

export function dashboardTab(ctx) {
  const view = ctx.view.dash ||= { range: 30 };
  const root = h('div', { class: 'stack' }, h('div', { class: 'loading' }, icon('fa-solid fa-circle-notch fa-spin'), ' Loading visits…'));
  const keys = lastDays(30);
  const projects = ctx.draft.projects;

  loadStats(keys, projects).then((stats) => {
    const draw = () => {
      const days = stats.days.slice(-view.range);
      const today = stats.days[stats.days.length - 1];
      const rangeBtns = h('div', { class: 'seg', role: 'group', 'aria-label': 'Time range' },
        [[7, '7 days'], [30, '30 days']].map(([n, l]) => h('button', { type: 'button', 'aria-pressed': view.range === n, onclick: () => { view.range = n; draw(); } }, l)));
      const chart = barChart(days);
      const projName = (id) => projects.find((p) => p.id === id)?.title || '(deleted project)';
      root.replaceChildren(
        DEMO ? note('<b>Sample data.</b> Real numbers appear here once Firebase is connected and people visit your site. Your own visits are not counted.', 'callout-note') : null,
        h('div', { class: 'dash-bar' }, rangeBtns, chart.toggleBtn),
        h('div', { class: 'stats' },
          tile(`Visits, last ${view.range} days`, sum(days, 'visits')),
          tile('Unique visitors', sum(days, 'uniques'), `${fmtNum(sum(days, 'newVisitors'))} first-time`),
          tile('Today', today.visits || 0, `${fmtNum(today.uniques)} unique`),
          tile('All time', stats.total.visits || 0, `${fmtNum(stats.total.newVisitors)} people`)),
        card('Visits per day', chart.el),
        h('div', { class: 'dash-grid' },
          card('Where visitors came from', ranked(SOURCES.map((s) => ({ label: SOURCE_LABEL[s], value: sum(days, `s_${s}`) })))),
          card('Phone vs PC', deviceSplit(days)),
          card('Most opened projects (all time)', ranked(stats.projects.map((p) => ({ label: projName(p.id), value: p.count })), { empty: 'Nobody has opened a project yet.' })),
          card('Link clicks', ranked(CLICKS.map((c) => ({
            label: c === 'resume' ? 'Résumé' : PLATFORMS[c]?.label || c,
            icon: c === 'resume' ? 'fa-solid fa-file-arrow-down' : PLATFORMS[c]?.icon,
            value: sum(days, `c_${c}`),
          })), { empty: 'No clicks on your social links yet.' }))),
      );
    };
    draw();
  }).catch((err) => {
    root.replaceChildren(note(`Couldn’t load visits: ${esc(err.message)}. If you just set things up, check the database rules in Settings.`, 'callout-bad'));
  });
  return root;
}
