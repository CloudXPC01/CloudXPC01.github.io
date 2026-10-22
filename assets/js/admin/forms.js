// Form controls that edit a plain object in place and report every change.
import { h } from '../dom.js';
import { parse, thumbUrl } from '../media.js';
import { pickAndUpload, uploadsReady } from './upload.js';

let notify = () => {};
let toastFn = (msg) => alert(msg);
export function setHooks({ onChange, toast }) {
  if (onChange) notify = onChange;
  if (toast) toastFn = toast;
}
export const changed = () => notify();
export const toast = (msg, kind) => toastFn(msg, kind);
export const icon = (name) => h('i', { class: name.includes(' ') ? name : `fa-solid ${name}`, 'aria-hidden': 'true' });

function wrap(label, control, help, cls = '') {
  return h('div', { class: `f ${cls}` },
    label ? h('span', { class: 'f-label' }, label) : null,
    control,
    help ? h('span', { class: 'f-help' }, help) : null);
}

export function card(title, ...kids) {
  return h('section', { class: 'card' }, title ? h('h3', { class: 'card-h' }, title) : null, ...kids);
}

export const row = (...kids) => h('div', { class: 'f-row' }, ...kids);
export const note = (html, cls = '') => h('p', { class: `note ${cls}`, html });

export function text(obj, key, { label, help, placeholder = '', type = 'text', cls = '', onInput } = {}) {
  const input = h('input', {
    type, placeholder, value: obj[key] ?? '',
    oninput: (e) => { obj[key] = e.target.value; onInput?.(e.target.value); changed(); },
  });
  return wrap(label, input, help, cls);
}

function autosize(el) {
  const fit = () => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; };
  el.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return el;
}

export function area(obj, key, { label, help, placeholder = '', rows = 4 } = {}) {
  const ta = autosize(h('textarea', {
    rows, placeholder, value: obj[key] ?? '',
    oninput: (e) => { obj[key] = e.target.value; changed(); },
  }));
  return wrap(label, ta, help, 'f-wide');
}

// One array entry per line (e.g. taglines).
export function lines(obj, key, { label, help, placeholder = '' } = {}) {
  const ta = autosize(h('textarea', {
    rows: 3, placeholder, value: (obj[key] || []).join('\n'),
    oninput: (e) => { obj[key] = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean); changed(); },
  }));
  return wrap(label, ta, help, 'f-wide');
}

export function toggle(obj, key, { label, help, onChange } = {}) {
  const input = h('input', {
    type: 'checkbox', class: 'sw', checked: !!obj[key],
    onchange: (e) => { obj[key] = e.target.checked; onChange?.(e.target.checked); changed(); },
  });
  return h('label', { class: 'f f-toggle' }, input, h('span', { class: 'f-toggle-text' }, h('span', { class: 'f-label' }, label), help ? h('span', { class: 'f-help' }, help) : null));
}

export function select(obj, key, { label, help, options, onChange } = {}) {
  const sel = h('select', {
    onchange: (e) => { obj[key] = e.target.value; onChange?.(e.target.value); changed(); },
  }, options.map(([v, t]) => h('option', { value: v, selected: obj[key] === v }, t)));
  return wrap(label, sel, help);
}

export function month(obj, key, { label, help } = {}) {
  const input = h('input', {
    type: 'month', placeholder: 'YYYY-MM', value: obj[key] || '',
    oninput: (e) => { obj[key] = e.target.value; changed(); },
  });
  return wrap(label, input, help);
}

export function color(obj, key, { label, onChange } = {}) {
  const set = (v) => { obj[key] = v; onChange?.(v); changed(); };
  const pick = h('input', { type: 'color', value: obj[key] || '#000000' });
  const hex = h('input', { type: 'text', class: 'hex', value: obj[key] || '', maxlength: 7, spellcheck: 'false' });
  pick.addEventListener('input', () => { hex.value = pick.value; set(pick.value); });
  hex.addEventListener('input', () => {
    const v = hex.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) { pick.value = v; set(v.toLowerCase()); }
  });
  return wrap(label, h('div', { class: 'color-in' }, pick, hex));
}

export function range(obj, key, { label, help, min = 0, max = 1, step = 0.1, format = (v) => v } = {}) {
  const out = h('output', {}, format(obj[key]));
  const input = h('input', {
    type: 'range', min, max, step, value: obj[key],
    oninput: (e) => { obj[key] = Number(e.target.value); out.textContent = format(obj[key]); changed(); },
  });
  return wrap(label, h('div', { class: 'range-in' }, input, out), help);
}

// Chips; Enter or comma adds, × removes.
export function tags(obj, key, { label, help, placeholder = 'Type and press Enter' } = {}) {
  obj[key] ||= [];
  const box = h('div', { class: 'tags' });
  const input = h('input', { type: 'text', placeholder });
  const draw = () => {
    box.replaceChildren(
      ...obj[key].map((t, i) => h('span', { class: 'tag' }, t,
        h('button', { type: 'button', 'aria-label': `Remove ${t}`, onclick: () => { obj[key].splice(i, 1); draw(); changed(); } }, '×'))),
      input,
    );
  };
  const add = () => {
    const parts = input.value.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    obj[key].push(...parts.filter((p) => !obj[key].includes(p)));
    input.value = '';
    draw();
    input.focus();
    changed();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    else if (e.key === 'Backspace' && !input.value && obj[key].length) { obj[key].pop(); draw(); input.focus(); changed(); }
  });
  input.addEventListener('blur', add);
  box.addEventListener('click', (e) => { if (e.target === box) input.focus(); });
  draw();
  return wrap(label, box, help, 'f-wide');
}

const TYPE_NAMES = {
  youtube: 'YouTube', vimeo: 'Vimeo', instagram: 'Instagram', drive: 'Google Drive', sketchfab: 'Sketchfab 3D viewer',
  itch: 'itch.io game (playable)', iframe: 'Embed', video: 'Video file', image: 'Image', link: 'Link (opens in a new tab)',
};

// URL field + upload button + live preview of what visitors will see.
export function media(obj, key, { label, help, accept = 'image/*,video/*', placeholder, onMedia } = {}) {
  const prev = h('div', { class: 'mf-prev' });
  const status = h('span', { class: 'mf-status' });
  const input = h('input', {
    type: 'text', inputmode: 'url', spellcheck: 'false', value: obj[key] || '',
    placeholder: placeholder || 'Paste a link (YouTube, Instagram, Drive, Sketchfab…) or upload',
  });
  const draw = () => {
    const m = parse(obj[key]);
    const t = thumbUrl(m, 400) || (m?.type === 'image' ? m.src : '');
    prev.replaceChildren(t ? h('img', { src: t, alt: '', loading: 'lazy' }) : icon(m ? (m.type === 'link' ? 'fa-link' : 'fa-photo-film') : 'fa-image'));
    prev.classList.toggle('empty', !m);
    status.className = 'mf-status';
    if (!obj[key]) status.textContent = '';
    else if (!m) { status.textContent = 'Not a valid link'; status.classList.add('bad'); }
    else { status.textContent = `✓ ${TYPE_NAMES[m.type] || m.type}${m.type === 'link' ? ` · ${m.site}` : ''}`; status.classList.add('ok'); }
  };
  input.addEventListener('input', () => { obj[key] = input.value.trim(); draw(); changed(); });
  const up = h('button', { type: 'button', class: 'btn sm' }, icon('fa-cloud-arrow-up'), 'Upload');
  up.addEventListener('click', async () => {
    if (!uploadsReady()) { toast('Set up uploads first: Settings › Uploads.', 'bad'); return; }
    up.disabled = true;
    try {
      const res = await pickAndUpload({
        accept,
        onProgress: (p) => { status.className = 'mf-status'; status.textContent = `Uploading… ${Math.round(p * 100)}%`; },
      });
      if (res) {
        obj[key] = res.url;
        input.value = res.url;
        draw();
        onMedia?.(res);
        changed();
        toast('Uploaded');
      } else draw();
    } catch (err) {
      draw();
      toast(err.message, 'bad');
    } finally {
      up.disabled = false;
    }
  });
  const clear = h('button', { type: 'button', class: 'btn sm ghost', 'aria-label': 'Clear', title: 'Clear',
    onclick: () => { obj[key] = ''; input.value = ''; draw(); changed(); } }, icon('fa-xmark'));
  draw();
  return h('div', { class: 'f f-wide f-media' },
    label ? h('span', { class: 'f-label' }, label) : null,
    h('div', { class: 'mf' }, prev, h('div', { class: 'mf-main' }, input, h('div', { class: 'mf-actions' }, up, clear, status))),
    help ? h('span', { class: 'f-help' }, help) : null);
}

// null = use the main colours; {a, b} = this block's own pair.
export function colorPair(obj, key, { label, base, onChange } = {}) {
  const box = h('div', { class: 'pair' });
  const draw = () => {
    const own = obj[key] && obj[key].a;
    const sw = h('span', { class: 'pair-sw', style: `--pa:${own ? obj[key].a : base().a};--pb:${own ? obj[key].b : base().b}` });
    const sw2 = h('input', {
      type: 'checkbox', class: 'sw', checked: !!own,
      onchange: (e) => {
        obj[key] = e.target.checked ? { a: base().a, b: base().b } : null;
        draw(); onChange?.(); changed();
      },
    });
    const kids = [sw, h('span', { class: 'pair-name' }, label), h('label', { class: 'pair-own' }, sw2, h('span', {}, 'Own colours'))];
    if (own) {
      const sub = { ...obj[key] };
      const upd = () => { obj[key] = { a: sub.a, b: sub.b }; sw.style.setProperty('--pa', sub.a); sw.style.setProperty('--pb', sub.b); onChange?.(); };
      kids.push(h('div', { class: 'pair-colors' }, color(sub, 'a', { label: 'A', onChange: upd }), color(sub, 'b', { label: 'B', onChange: upd })));
    }
    box.replaceChildren(...kids);
  };
  draw();
  return box;
}

/*
  Editable list of objects.
  opts.title(item) / opts.sub(item) / opts.thumb(item) -> header text and thumbnail
  opts.body(item) -> Element with the item's fields
  opts.create() -> new item (shown expanded); opts.filter(item) -> show/hide
  opts.canRemove(item) -> bool or string reason; opts.confirmRemove -> ask first
*/
export function list(arr, opts) {
  const open = new Set(opts.open || []);
  const root = h('div', { class: 'list' });
  let dragFrom = -1;

  const keyOf = (it) => it.id || it;
  const visible = () => arr.map((it, i) => ({ it, i })).filter(({ it }) => !opts.filter || opts.filter(it));

  const move = (from, to) => {
    if (to < 0 || to >= arr.length || from === to) return;
    const [x] = arr.splice(from, 1);
    arr.splice(to, 0, x);
    draw();
    changed();
  };

  function header(it, i, vis, pos) {
    const title = h('span', { class: 'li-title' }, opts.title(it) || 'Untitled');
    const sub = h('span', { class: 'li-sub' }, opts.sub ? opts.sub(it) : '');
    const thumbSrc = opts.thumb?.(it);
    const thumb = opts.thumb ? h('span', { class: 'li-thumb' }, thumbSrc ? h('img', { src: thumbSrc, alt: '', loading: 'lazy' }) : icon(opts.icon?.(it) || 'fa-image')) : null;
    const prevI = pos > 0 ? vis[pos - 1].i : -1;
    const nextI = pos < vis.length - 1 ? vis[pos + 1].i : -1;
    const btn = (ic, label, fn, disabled) => h('button', { type: 'button', class: 'icon', 'aria-label': label, title: label, disabled, onclick: (e) => { e.stopPropagation(); fn(); } }, icon(ic));
    const isOpen = open.has(keyOf(it));
    return h('div', { class: 'li-head', onclick: () => { isOpen ? open.delete(keyOf(it)) : open.add(keyOf(it)); draw(); } },
      h('span', {
        class: 'li-drag', title: 'Drag to reorder',
        onmousedown: () => { root.children[pos].draggable = true; },
        onmouseup: () => { root.children[pos].draggable = false; },
        onclick: (e) => e.stopPropagation(),
      }, icon('fa-grip-vertical')),
      thumb,
      h('span', { class: 'li-text' }, title, sub),
      h('span', { class: 'li-btns' },
        btn('fa-arrow-up', 'Move up', () => move(i, prevI), prevI < 0),
        btn('fa-arrow-down', 'Move down', () => move(i, nextI), nextI < 0),
        opts.duplicate ? btn('fa-clone', 'Duplicate', () => { const copy = opts.duplicate(it); arr.splice(i + 1, 0, copy); open.add(keyOf(copy)); draw(); changed(); }) : null,
        btn('fa-trash-can', 'Delete', () => {
          const why = opts.canRemove ? opts.canRemove(it) : true;
          if (why !== true) { toast(why || 'This item can’t be deleted', 'bad'); return; }
          if (!confirm(`Delete “${opts.title(it) || 'this item'}”?`)) return;
          arr.splice(i, 1);
          draw();
          changed();
        }),
        h('span', { class: `li-chev${isOpen ? ' up' : ''}` }, icon('fa-chevron-down'))));
  }

  function draw() {
    const vis = visible();
    root.replaceChildren(...vis.map(({ it, i }, pos) => {
      const isOpen = open.has(keyOf(it));
      const item = h('div', { class: `li${isOpen ? ' open' : ''}${opts.dim?.(it) ? ' dim' : ''}` }, header(it, i, vis, pos));
      if (isOpen) {
        const body = h('div', { class: 'li-body' }, opts.body(it));
        // keep the header text in sync while typing
        body.addEventListener('input', () => {
          item.querySelector('.li-title').textContent = opts.title(it) || 'Untitled';
          if (opts.sub) item.querySelector('.li-sub').textContent = opts.sub(it);
        });
        body.addEventListener('change', () => {
          if (opts.sub) item.querySelector('.li-sub').textContent = opts.sub(it);
          item.classList.toggle('dim', !!opts.dim?.(it));
        });
        item.append(body);
      }
      item.addEventListener('dragstart', (e) => { dragFrom = i; item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      item.addEventListener('dragend', () => { item.draggable = false; item.classList.remove('dragging'); dragFrom = -1; });
      item.addEventListener('dragover', (e) => { if (dragFrom >= 0) { e.preventDefault(); item.classList.add('drop'); } });
      item.addEventListener('dragleave', () => item.classList.remove('drop'));
      item.addEventListener('drop', (e) => { e.preventDefault(); item.classList.remove('drop'); if (dragFrom >= 0) move(dragFrom, i); });
      return item;
    }));
    if (!vis.length) root.append(h('p', { class: 'list-empty' }, opts.empty || 'Nothing here yet.'));
  }

  draw();
  const add = opts.create ? h('button', { type: 'button', class: 'btn add', onclick: () => {
    const it = opts.create();
    if (!it) return;
    arr[opts.addToTop ? 'unshift' : 'push'](it);
    open.add(keyOf(it));
    draw();
    changed();
    requestAnimationFrame(() => root.querySelector('.li.open:' + (opts.addToTop ? 'first-child' : 'last-child'))?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  } }, icon('fa-plus'), opts.addLabel || 'Add') : null;

  const el = h('div', { class: 'list-wrap' }, root, add);
  el.refresh = draw;
  return el;
}

export function mediaList(arr, { label, help, onMedia } = {}) {
  return h('div', { class: 'f f-wide' },
    h('span', { class: 'f-label' }, label),
    help ? h('span', { class: 'f-help' }, help) : null,
    list(arr, {
      title: (m) => (m.url ? TYPE_NAMES[parse(m.url)?.type] || 'Not a valid link' : 'Empty: paste a link or upload'),
      sub: (m) => m.caption || m.url || '',
      thumb: (m) => thumbUrl(parse(m.url), 200),
      icon: () => 'fa-photo-film',
      body: (m) => h('div', { class: 'grid' }, media(m, 'url', { label: 'Media', onMedia }), text(m, 'caption', { label: 'Caption (optional)', cls: 'f-wide' })),
      create: () => ({ url: '', caption: '' }),
      addLabel: 'Add media',
      empty: 'No media yet.',
    }));
}
