/**
 * domstub.js —— 浏览器环境桩（供 smoke.js / render.js 共用）
 * 目标：在 Node 里真实执行页面内联脚本，并提供：
 *   - 桩 DOM（能创建元素、能挂 id、能记录被请求但不存在的 id）
 *   - 可选择"记录型 canvas 2D 上下文"，把每次绘图调用的坐标记下来做几何自检
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/* ---------- 记录型 2D 上下文 ---------- */
/* 除记录绘图调用外，还提供一块"真实像素缓冲"，让图像处理类的实验台也能在
   Node 里跑通数值（getImageData / putImageData / fillRect 都有实际效果）。 */
function parseColor(c) {
  c = String(c || '').trim();
  var m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16), 255];
  m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 255];
  m = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (m) {
    var p = m[1].split(',').map(function (s) { return parseFloat(s); });
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? Math.round(p[3] * 255) : 255];
  }
  if (c === 'white') return [255, 255, 255, 255];
  if (c === 'black') return [0, 0, 0, 255];
  return [0, 0, 0, 0];
}

function makeRecCtx(cv) {
  const rec = {
    canvas: cv, nan: 0, points: 0, texts: 0, textOut: 0, ops: {}, maxAbs: 0,
    W: cv.__cssW || 420, H: cv.__cssH || 240, pxOps: 0
  };
  const store = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '12px monospace',
    globalAlpha: 1, textAlign: 'left', textBaseline: 'alphabetic', __fill: [0, 0, 0, 0]
  };
  function buf() {
    if (!cv.__px || cv.__px.length !== rec.W * rec.H * 4) cv.__px = new Uint8ClampedArray(rec.W * rec.H * 4);
    return cv.__px;
  }
  function setFill(v) { store.__fill = parseColor(v); store.fillStyle = v; }

  return new Proxy(store, {
    get(t, k) {
      if (k === '__rec') return rec;
      if (k === '__fill') return t.__fill;
      if (k === 'measureText') return function (s) { return { width: String(s || '').length * 6.2 }; };
      if (k === 'canvas') return cv;
      if (k === 'getImageData') return function (x, y, w, h) {
        x = Math.round(x); y = Math.round(y); w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
        const src = buf(), out = new Uint8ClampedArray(w * h * 4);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const sx = x + i, sy = y + j;
          if (sx < 0 || sy < 0 || sx >= rec.W || sy >= rec.H) continue;
          const s = (sy * rec.W + sx) * 4, d = (j * w + i) * 4;
          out[d] = src[s]; out[d + 1] = src[s + 1]; out[d + 2] = src[s + 2]; out[d + 3] = src[s + 3];
        }
        rec.pxOps++;
        return { data: out, width: w, height: h, colorSpace: 'srgb' };
      };
      if (k === 'createImageData') return function (w, h) {
        return { data: new Uint8ClampedArray(Math.max(1, w | 0) * Math.max(1, h | 0) * 4), width: w | 0, height: h | 0, colorSpace: 'srgb' };
      };
      if (k === 'putImageData') return function (img, x, y) {
        x = Math.round(x); y = Math.round(y);
        const dst = buf(), w = img.width, h = img.height, src = img.data;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const dx = x + i, dy = y + j;
          if (dx < 0 || dy < 0 || dx >= rec.W || dy >= rec.H) continue;
          const s = (j * w + i) * 4, d = (dy * rec.W + dx) * 4;
          dst[d] = src[s]; dst[d + 1] = src[s + 1]; dst[d + 2] = src[s + 2]; dst[d + 3] = src[s + 3];
        }
        rec.pxOps++;
        return undefined;
      };
      if (k === 'drawImage') return function () { rec.pxOps++; return undefined; };
      if (k === 'fillRect' || k === 'clearRect') return function (x, y, w, h) {
        if (k === 'fillRect') { const f = t.__fill; const dst = buf(); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dx = Math.round(x + i), dy = Math.round(y + j); if (dx < 0 || dy < 0 || dx >= rec.W || dy >= rec.H) continue; const d = (dy * rec.W + dx) * 4; dst[d] = f[0]; dst[d + 1] = f[1]; dst[d + 2] = f[2]; dst[d + 3] = f[3] === 0 ? 0 : 255; } }
        else { const dst = buf(); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dx = Math.round(x + i), dy = Math.round(y + j); if (dx < 0 || dy < 0 || dx >= rec.W || dy >= rec.H) continue; const d = (dy * rec.W + dx) * 4; dst[d] = dst[d + 1] = dst[d + 2] = dst[d + 3] = 0; } }
        rec.ops[k] = (rec.ops[k] || 0) + 1;
        return undefined;
      };
      if (k in t) return t[k];
      const fn = function () {
        const args = Array.prototype.slice.call(arguments);
        rec.ops[k] = (rec.ops[k] || 0) + 1;
        for (let i = 0; i < args.length; i++) {
          const v = args[i];
          if (typeof v === 'number') {
            if (!isFinite(v)) rec.nan++;
            else rec.maxAbs = Math.max(rec.maxAbs, Math.abs(v));
          }
        }
        if (k === 'moveTo' || k === 'lineTo' || k === 'arc') rec.points++;
        if (k === 'fillText') {
          rec.texts++;
          const x = args[1], y = args[2];
          if (!isFinite(x) || !isFinite(y) || x < -30 || y < -30 || x > rec.W + 30 || y > rec.H + 30) rec.textOut++;
        }
        return undefined;
      };
      t[k] = fn;
      return fn;
    },
    set(t, k, v) {
      if (k === 'fillStyle') { setFill(v); return true; }
      t[k] = v; return true;
    }
  });
}

function makePlainCtx() {
  return new Proxy({ canvas: null }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'measureText') return () => ({ width: 10 });
      return () => { };
    },
    set() { return true; }
  });
}

/* ---------- 桩元素 ---------- */
function makeEl(id, opts) {
  opts = opts || {};
  const el = {
    id: id || '', tagName: (opts.tag || 'DIV').toUpperCase(),
    children: [], style: {}, dataset: {}, value: '0', textContent: '',
    _html: '', __cssW: opts.w || 420, __cssH: opts.h || 240,
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = String(v);
      const m = this._html.match(/\bid="([^"]+)"/g) || [];
      m.forEach(x => opts.dynIds && opts.dynIds.add(x.slice(4, -1)));
    },
    className: '', checked: false, disabled: false, href: '', type: '', min: '0', max: '1', step: '1',
    classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
    appendChild(c) { this.children.push(c); if (c && c.id) opts.dynIds && opts.dynIds.add(c.id); return c; },
    insertBefore(c) { this.children.push(c); return c; },
    removeChild() { }, remove() { },
    addEventListener() { }, removeEventListener() { }, dispatchEvent() { },
    querySelector() { return makeEl('qs', opts); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.__cssW, height: this.__cssH }; },
    getContext(kind) {
      if (!this.__ctx) this.__ctx = opts.record ? makeRecCtx(this) : makePlainCtx();
      return this.__ctx;
    },
    setAttribute(k, v) { if (k === 'id') { this.id = v; opts.dynIds && opts.dynIds.add(v); } },
    getAttribute(k) { return k === 'id' ? this.id : null; },
    hasAttribute() { return false; },
    focus() { }, click() { },
    get parentNode() { return { insertBefore() { }, querySelector() { return null; } }; }
  };
  Object.defineProperty(el, 'clientWidth', {
    get() { const w = parseInt(String(this.style.width || ''), 10); return isFinite(w) && w > 0 ? w : this.__cssW; }
  });
  Object.defineProperty(el, 'clientHeight', {
    get() { const h = parseInt(String(this.style.height || ''), 10); return isFinite(h) && h > 0 ? h : this.__cssH; }
  });
  return el;
}

/* 从 HTML 里预登记静态元素：拿到真实 tag 与 style（画布高度对几何自检很重要） */
function scanStaticElements(html, opts) {
  const reg = new Map();
  const re = /<(\w+)([^>]*?)\bid="([^"]+)"([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[1];
    const attrs = (m[2] || '') + ' ' + (m[4] || '');
    const id = m[3];
    const el = makeEl(id, Object.assign({}, opts, { tag }));
    const h = /style="[^"]*height:\s*(\d+)px/.exec(attrs);
    const w = /style="[^"]*width:\s*(\d+)px/.exec(attrs);
    if (h) el.style.height = h[1] + 'px';
    if (w) el.style.width = w[1] + 'px';
    reg.set(id, el);
  }
  return reg;
}

/* ---------- 运行一个页面 ---------- */
/* opts.record  : 是否使用记录型 canvas（render.js 用）
   opts.wrapLab : 是否包裹 SSC.lab 以便捕获所有实验台（render.js 用） */
function runPage(file, opts) {
  opts = opts || {};
  const html = fs.readFileSync(file, 'utf8');
  const pageId = (html.match(/data-page="([^"]+)"/) || [, ''])[1];
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const dynIds = new Set();
  const requested = new Set();
  const storage = {};
  const elOpts = { dynIds, record: !!opts.record, w: 420, h: 240 };
  const registry = scanStaticElements(html, elOpts);

  const documentStub = {
    readyState: 'complete',
    body: Object.assign(makeEl('body', elOpts), { getAttribute(k) { return k === 'data-page' ? pageId : null; } }),
    documentElement: makeEl('html', elOpts),
    createElement: (t) => makeEl('', Object.assign({}, elOpts, { tag: t })),
    getElementById: (id) => {
      requested.add(id);
      if (registry.has(id)) return registry.get(id);   /* 同一 id 必须返回同一对象，否则画布记录会丢 */
      const el = makeEl(id, elOpts);
      registry.set(id, el);
      return el;
    },
    querySelector: () => makeEl('qs', elOpts),
    querySelectorAll: () => [],
    addEventListener() { }, removeEventListener() { }
  };

  const consoleErrors = [];
  const sandboxConsole = {
    log: function () { console.log.apply(console, arguments); },
    warn: function () { console.warn.apply(console, arguments); },
    info: function () { },
    debug: function () { },
    error: function () {
      const msg = Array.prototype.slice.call(arguments).map(function (a) {
        return a && a.message ? a.message : String(a);
      }).join(' ');
      consoleErrors.push(msg);
    }
  };

  const sandbox = {
    document: documentStub, window: null, devicePixelRatio: 1, console: sandboxConsole,
    setTimeout: (f) => 0, clearTimeout: () => { }, setInterval: () => 0, clearInterval: () => { },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => { },
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; }
    },
    location: { reload() { } },
    addEventListener() { }, removeEventListener() { }, dispatchEvent() { },
    Math, JSON, isFinite, isNaN, parseFloat, parseInt, Date, Array, Object, String, Number, Boolean, Error,
    module: undefined, require: undefined
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const SSC_SRC = fs.readFileSync(path.join(ROOT, 'assets', 'ssc.js'), 'utf8');
  try { vm.runInContext(SSC_SRC, sandbox, { filename: 'ssc.js' }); }
  catch (e) { return { problems: ['ssc.js 加载失败: ' + e.message], ids, missing: [], labs: [] }; }
  if (!sandbox.SSC) return { problems: ['ssc.js 未导出 SSC'], ids, missing: [], labs: [] };

  const labs = [];
  if (opts.wrapLab) {
    const orig = sandbox.SSC.lab;
    sandbox.SSC.lab = function (o) {
      const api = orig(o);
      labs.push({ kind: 'lab', o: o, api: api });
      return api;
    };
    const origPz = sandbox.SSC.pzLab;
    if (origPz) {
      sandbox.SSC.pzLab = function (o) {
        const api = origPz(o);
        labs.push({ kind: 'pz', o: o, api: api });
        return api;
      };
    }
  }

  const problems = [];
  blocks.forEach((code, i) => {
    if (!code.trim()) return;
    try { vm.runInContext(code, sandbox, { filename: file + '#script' + (i + 1), timeout: 30000 }); }
    catch (e) { problems.push('内联脚本 #' + (i + 1) + ' 运行时异常: ' + (e && e.message)); }
  });

  const missing = [...requested].filter(x => x && !ids.has(x) && !dynIds.has(x) && x !== 'qs');
  /* 内核里的 lab() 用 try/catch 吞掉了绘制异常，这里把它们捞出来当成真实问题 */
  consoleErrors.forEach(function (m) { problems.push('实验台绘制被内核捕获的异常: ' + m); });
  return { problems, ids, missing, labs, sandbox, consoleErrors, canvases: collectCanvases(sandbox) };
}

/* 收集页面上所有 canvas（含 lab 动态创建的） */
function collectCanvases(sandbox, labs) {
  const out = [];
  (sandbox.__allEls || []).forEach(function (el) { if (el && el.tagName === 'CANVAS') out.push(el); });
  return out;
}

module.exports = { runPage, makeEl, makeRecCtx, ROOT };
