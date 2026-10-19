import { getPath, setPath, subscribe } from './state.js';

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

const refreshers = [];
export const refreshAll = () => refreshers.forEach((f) => f());
subscribe(() => refreshAll());

export function section(title, ...kids) {
  const d = h('details', { class: 'sec', open: '' }, h('summary', {}, title), ...kids);
  return d;
}

export function slider(label, path, min, max, step, onInput) {
  const out = h('span', { class: 'val' });
  const inp = h('input', { type: 'range', min, max, step });
  const sync = () => { const v = getPath(path); if (document.activeElement !== inp) inp.value = v; out.textContent = Number(v).toFixed(step < 0.01 ? 4 : step < 1 ? 2 : 0); };
  inp.addEventListener('input', () => { setPath(path, parseFloat(inp.value)); onInput?.(); });
  refreshers.push(sync); sync();
  return h('label', { class: 'row' }, h('span', { class: 'lab' }, label), inp, out);
}

export function select(label, path, options, onChange) {
  const s = h('select', {}, options.map((o) => h('option', { value: o }, o)));
  const sync = () => { s.value = getPath(path); };
  s.addEventListener('change', () => { setPath(path, s.value); onChange?.(s.value); });
  refreshers.push(sync); sync();
  return h('label', { class: 'row' }, h('span', { class: 'lab' }, label), s);
}

export function check(label, path, onChange) {
  const c = h('input', { type: 'checkbox' });
  const sync = () => { c.checked = !!getPath(path); };
  c.addEventListener('change', () => { setPath(path, c.checked); onChange?.(c.checked); });
  refreshers.push(sync); sync();
  return h('label', { class: 'row' }, h('span', { class: 'lab' }, label), c);
}

export function number(label, path, step = 1) {
  const n = h('input', { type: 'number', step });
  const sync = () => { if (document.activeElement !== n) n.value = getPath(path); };
  n.addEventListener('change', () => setPath(path, parseFloat(n.value)));
  refreshers.push(sync); sync();
  return h('label', { class: 'row' }, h('span', { class: 'lab' }, label), n);
}

export const button = (label, fn, cls = '') => h('button', { class: cls, onclick: fn }, label);
export function register(fn) { refreshers.push(fn); fn(); }
