/* ============================================================
   ssc.js —— 《信号与系统》交互图谱 共享内核
   纯前端 · 零依赖 · 支持 file:// 直接打开（不要改成 ES module）
   提供五类东西：
     1) 站点导航 / 学习进度 / 术语气泡 / 主题切换
     2) 画布绘图：plot（连续曲线、离散茎叶、谱线、图例）、plane（复平面）
     3) 信号数学：矩形/三角/sinc/阶跃、CTFT 数值积分、方波部分和、
        DFT/FFT、卷积、极零频响、多项式求根、sinc 内插
     4) 互动实验台 lab()：滑块/下拉 → 立即重绘（这是"改参数看变化"的实现方式）
     5) 测验 quiz() / 分页 tabs()
   顶层不触碰 document，因此可以在 Node 桩环境里做冒烟测试。
   ============================================================ */
(function (global) {
  'use strict';

  /* ================= 站点结构 ================= */
  var PAGES = [
    { id: 'index', href: 'index.html', short: '学习地图 · 总览', title: '学习地图：一张图看懂整门课', group: '起点' },

    { id: 'ch01', href: 'ch01-signals.html', short: '1 · 信号与系统基本概念', title: '第 1 章　信号是什么、系统是什么', group: '第一段　地基' },
    { id: 'ch02', href: 'ch02-convolution.html', short: '2 · LTI 系统与卷积', title: '第 2 章　LTI 系统与卷积', group: '第一段　地基' },
    { id: 'ch03', href: 'ch03-eigenfunction.html', short: '3 · 复指数：频域分析为什么可行', title: '第 3 章　复指数：频域分析为什么可行', group: '第一段　地基' },

    { id: 'ch04', href: 'ch04-ctfs.html', short: '4 · 连续时间傅里叶级数 CTFS', title: '第 4 章　连续时间傅里叶级数（CTFS）', group: '第二段　傅里叶家族' },
    { id: 'ch05', href: 'ch05-dtfs.html', short: '5 · 离散时间傅里叶级数 DTFS', title: '第 5 章　离散时间傅里叶级数（DTFS）', group: '第二段　傅里叶家族' },
    { id: 'ch06', href: 'ch06-ctft.html', short: '6 · 连续时间傅里叶变换 CTFT', title: '第 6 章　连续时间傅里叶变换（CTFT）', group: '第二段　傅里叶家族' },
    { id: 'ch07', href: 'ch07-dtft.html', short: '7 · 离散时间傅里叶变换 DTFT', title: '第 7 章　离散时间傅里叶变换（DTFT）', group: '第二段　傅里叶家族' },
    { id: 'ch08', href: 'ch08-dft.html', short: '8 · DFT 与 FFT：计算机怎么算傅里叶', title: '第 8 章　DFT 与 FFT：计算机怎么算傅里叶', group: '第二段　傅里叶家族' },

    { id: 'ch09', href: 'ch09-sampling.html', short: '9 · 采样定理与信号重建', title: '第 9 章　采样定理与信号重建', group: '第三段　从连续到离散' },

    { id: 'ch10', href: 'ch10-filters.html', short: '10 · 时频特性与滤波器', title: '第 10 章　时频特性与滤波器', group: '第四段　系统与频域' },
    { id: 'ch11', href: 'ch11-modulation.html', short: '11 · 调制、解调与通信', title: '第 11 章　调制、解调与通信', group: '第四段　系统与频域' },

    { id: 'ch12', href: 'ch12-laplace.html', short: '12 · 拉普拉斯变换', title: '第 12 章　拉普拉斯变换（连续世界的 z）', group: '第五段　两个"万能"变换' },
    { id: 'ch13', href: 'ch13-ztransform.html', short: '13 · z 变换', title: '第 13 章　z 变换（离散世界的拉普拉斯）', group: '第五段　两个"万能"变换' },
    { id: 'ch14', href: 'ch14-atlas.html', short: '14 · 四大变换总对照', title: '第 14 章　四大变换总对照：级数 / 变换 / 拉氏 / z', group: '第五段　两个"万能"变换' },

    { id: 'ch15', href: 'ch15-applications.html', short: '附 A · 应用串讲', title: '附 A　应用串讲：滤波、调制、图像、降维', group: '附录' },
    { id: 'ch16', href: 'ch16-cheatsheet.html', short: '附 B · 速查表与常见坑', title: '附 B　速查表与常见坑', group: '附录' }
  ];
  var LS_KEY = 'ssc-progress-v2';
  var LS_THEME = 'ssc-theme-v2';

  /* ================= 小工具 ================= */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null');
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return null; }
  }
  function progress() { return store(LS_KEY) || {}; }
  function markDone(id) { var p = progress(); p[id] = 1; store(LS_KEY, p); }
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function fmt(v, d) {
    d = d == null ? 3 : d;
    if (v == null || (typeof v === 'number' && isNaN(v))) return '—';
    if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
    if (v === 0) return '0';
    var av = Math.abs(v);
    if (av >= 1e5 || av < 1e-4) return v.toExponential(2);
    return String(+v.toFixed(d));
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  var COLORS = ['#4338ca', '#dc2626', '#0e7490', '#15803d', '#b45309', '#7c3aed', '#db2777', '#0891b2'];

  /* ================= 导航 / 主题 / 术语气泡 ================= */
  function initTheme() {
    var t = store(LS_THEME);
    if (t === 'dark') document.body.classList.add('dark');
  }
  function initNav() {
    var id = document.body.getAttribute('data-page') || 'index';
    var side = document.getElementById('side');
    var cur = null;
    PAGES.forEach(function (p) { if (p.id === id) cur = p; });

    if (side) {
      var done = progress();
      side.appendChild(el('div', 'brand',
        '<b>信号与系统 · 交互图谱</b><span>傅里叶级数 → 傅里叶变换 → 采样 → 拉普拉斯 → z 变换<br>' +
        '零基础可读 · 每页可动手改参数</span>'));
      var ul = el('ul', 'navlist');
      var groups = {};
      PAGES.forEach(function (p) { (groups[p.group] = groups[p.group] || []).push(p); });
      Object.keys(groups).forEach(function (g) {
        ul.appendChild(el('li', 'sep', g));
        groups[g].forEach(function (p) {
          var a = el('a', (p.id === id ? 'active ' : '') + (done[p.id] ? 'done' : ''));
          a.href = p.href;
          a.innerHTML = '<span class="tick">✓</span><span>' + p.short + '</span>';
          ul.appendChild(a);
        });
      });
      side.appendChild(ul);

      var bottom = el('div', 'small muted', '<hr style="margin:14px 0">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn ghost sm" id="resetProgress">重置进度</button>' +
        '<button class="btn ghost sm" id="toggleTheme">夜间 / 日间</button></div>');
      side.appendChild(bottom);

      var rb = document.getElementById('resetProgress');
      if (rb) rb.addEventListener('click', function () { store(LS_KEY, {}); location.reload(); });
      var tb = document.getElementById('toggleTheme');
      if (tb) tb.addEventListener('click', function () {
        document.body.classList.toggle('dark');
        store(LS_THEME, document.body.classList.contains('dark') ? 'dark' : 'light');
        redrawAll();
      });
    }

    var pager = document.getElementById('pager');
    if (pager && cur) {
      var i = PAGES.indexOf(cur);
      var prev = PAGES[i - 1], next = PAGES[i + 1];
      if (prev) {
        var a1 = el('a', 'prev', '<span class="k">上一站</span><span class="v">' + prev.short + '</span>');
        a1.href = prev.href; pager.appendChild(a1);
      } else { pager.appendChild(el('span', '', '')); }
      if (next) {
        var a2 = el('a', 'next', '<span class="k">下一站</span><span class="v">' + next.short + '</span>');
        a2.href = next.href; pager.appendChild(a2);
      }
      var box = el('div', 'center'); box.style.margin = '30px 0 0';
      var btn = el('button', 'btn', '这一站学完了，标记 ✓');
      btn.addEventListener('click', function () { markDone(cur.id); btn.textContent = '已记录 ✓（侧栏可看到对勾）'; btn.disabled = true; });
      box.appendChild(btn);
      pager.parentNode.insertBefore(box, pager);
    }
    initTerms();
  }

  function initTerms() {
    var terms = document.querySelectorAll('.term[data-def]');
    if (!terms.length) return;
    var tip = el('div', '', '');
    tip.style.cssText = 'position:fixed;z-index:99;max-width:330px;background:var(--ink);color:var(--bg);' +
      'font-size:13.5px;line-height:1.6;padding:8px 11px;border-radius:9px;box-shadow:var(--shadow);' +
      'pointer-events:none;display:none;opacity:.97';
    document.body.appendChild(tip);
    function show(e) {
      var t = e.currentTarget;
      tip.innerHTML = t.getAttribute('data-def');
      tip.style.display = 'block';
      var r = t.getBoundingClientRect();
      var x = clamp(r.left, 8, (global.innerWidth || 800) - 340);
      var y = r.bottom + 8;
      if (y + 90 > (global.innerHeight || 600)) y = r.top - tip.offsetHeight - 8;
      tip.style.left = x + 'px'; tip.style.top = Math.max(8, y) + 'px';
    }
    function hide() { tip.style.display = 'none'; }
    Array.prototype.forEach.call(terms, function (t) {
      t.addEventListener('mouseenter', show);
      t.addEventListener('mouseleave', hide);
      t.addEventListener('focus', show);
      t.addEventListener('blur', hide);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '0');
    });
  }

  /* ================= 画布基础 ================= */
  function setupCanvas(cv) {
    var dpr = global.devicePixelRatio || 1;
    var w = cv.clientWidth || cv.parentNode && cv.parentNode.clientWidth || 640;
    var h = cv.clientHeight || 240;
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
    var ctx = cv.getContext('2d');
    if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '12px ui-monospace, Menlo, monospace';
    return { ctx: ctx, W: w, H: h };
  }
  function niceTicks(min, max, count) {
    var span = max - min;
    if (!(span > 0)) return [min];
    var step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = span / count / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var out = [], v = Math.ceil(min / step - 1e-9) * step;
    for (var i = 0; i < 300 && v <= max + 1e-9 * span; i++) { out.push(+v.toFixed(12)); v += step; }
    return out;
  }

  /* 直角坐标绘图。
     spec: { xmin,xmax,ymin,ymax(可缺省自动), xlabel,ylabel, xticks,yticks,
             tickFmt, legend:true/false,
             curves:[{f,color,width,dash,domain,samples,fill,alpha,label}],
             stems:[{xs,ys,color,width,r,label}],
             hlines:[{y,color,dash,width,label}], vlines:[{x,...}],
             points:[{x,y,color,r}], bands:[{x1,x2,color}], pad }  */
  function plot(cv, spec) {
    var s = setupCanvas(cv), ctx = s.ctx, W = s.W, H = s.H;
    spec = spec || {};
    var pad = spec.pad || { l: 54, r: 16, t: 16, b: 34 };
    var xmin = spec.xmin, xmax = spec.xmax;
    if (xmax == null) { xmax = 1; xmin = 0; }
    var curves = spec.curves || [], stems = spec.stems || [];
    var i, x, y;
    var tf = spec.tickFmt || function (v) { return fmt(v, 3); };

    var ymin = spec.ymin, ymax = spec.ymax;
    if (ymin == null || ymax == null) {
      var lo = Infinity, hi = -Infinity;
      curves.forEach(function (c) {
        var d = c.domain || [xmin, xmax], N = 400;
        for (var j = 0; j <= N; j++) {
          var xx = d[0] + (d[1] - d[0]) * j / N, yy = c.f(xx);
          if (isFinite(yy)) { if (yy < lo) lo = yy; if (yy > hi) hi = yy; }
        }
      });
      stems.forEach(function (st) {
        (st.ys || []).forEach(function (yy) { if (isFinite(yy)) { if (yy < lo) lo = yy; if (yy > hi) hi = yy; } });
      });
      (spec.hlines || []).forEach(function (h) { lo = Math.min(lo, h.y); hi = Math.max(hi, h.y); });
      (spec.points || []).forEach(function (p) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); });
      if (!isFinite(lo)) { lo = -1; hi = 1; }
      if (hi - lo < 1e-12) { hi = lo + 1; }
      var m = (hi - lo) * 0.14;
      if (spec.ymin == null) ymin = Math.min(0, lo) - m * 0.4;
      if (spec.ymax == null) ymax = hi + m;
      if (spec.symmetric) { var A = Math.max(Math.abs(ymin), Math.abs(ymax)); ymin = -A; ymax = A; }
    }
    if (!(ymax > ymin)) ymax = ymin + 1;

    var X = function (v) { return pad.l + (v - xmin) / (xmax - xmin) * (W - pad.l - pad.r); };
    var Y = function (v) { return H - pad.b - (v - ymin) / (ymax - ymin) * (H - pad.t - pad.b); };

    // 背景带
    (spec.bands || []).forEach(function (b) {
      ctx.save(); ctx.fillStyle = b.color || 'rgba(120,140,180,.10)';
      ctx.fillRect(X(b.x1), pad.t, X(b.x2) - X(b.x1), H - pad.t - pad.b); ctx.restore();
    });

    // 网格
    var xt = spec.xticks || niceTicks(xmin, xmax, spec.xcount || 6);
    var yt = spec.yticks || niceTicks(ymin, ymax, spec.ycount || 4);
    ctx.strokeStyle = 'rgba(130,150,185,.20)'; ctx.fillStyle = '#8b96ad'; ctx.lineWidth = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    xt.forEach(function (v) {
      ctx.beginPath(); ctx.moveTo(X(v), pad.t); ctx.lineTo(X(v), H - pad.b); ctx.stroke();
      ctx.fillText(tf(v), X(v), H - pad.b + 6);
    });
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    yt.forEach(function (v) {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke();
      ctx.fillText(tf(v), pad.l - 6, Y(v));
    });
    // 坐标轴
    var y0 = clamp(0, ymin, ymax);
    ctx.strokeStyle = 'rgba(110,130,165,.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pad.l, Y(y0)); ctx.lineTo(W - pad.r, Y(y0)); ctx.stroke();
    if (xmin <= 0 && xmax >= 0) { ctx.beginPath(); ctx.moveTo(X(0), pad.t); ctx.lineTo(X(0), H - pad.b); ctx.stroke(); }

    if (spec.xlabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#6a7793'; ctx.fillText(spec.xlabel, W - pad.r, H - 3); }
    if (spec.ylabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#6a7793'; ctx.fillText(spec.ylabel, pad.l + 4, pad.t - 2); }

    function lab(text, x, y, color, align, base) {
      ctx.save(); ctx.fillStyle = color || '#5b6780'; ctx.font = '11.5px ui-monospace, monospace';
      ctx.textAlign = align || 'left'; ctx.textBaseline = base || 'bottom';
      ctx.fillText(text, x, y); ctx.restore();
    }
    (spec.hlines || []).forEach(function (h) {
      ctx.save(); ctx.setLineDash(h.dash || [5, 5]); ctx.strokeStyle = h.color || '#c3ccdd'; ctx.lineWidth = h.width || 1.2;
      ctx.beginPath(); ctx.moveTo(pad.l, Y(h.y)); ctx.lineTo(W - pad.r, Y(h.y)); ctx.stroke(); ctx.restore();
      if (h.label) lab(h.label, pad.l + 4, Y(h.y) - 3, h.color);
    });
    (spec.vlines || []).forEach(function (v) {
      ctx.save(); ctx.setLineDash(v.dash || [5, 5]); ctx.strokeStyle = v.color || '#c3ccdd'; ctx.lineWidth = v.width || 1.2;
      ctx.beginPath(); ctx.moveTo(X(v.x), pad.t); ctx.lineTo(X(v.x), H - pad.b); ctx.stroke(); ctx.restore();
      if (v.label) lab(v.label, X(v.x) + 4, pad.t + 12, v.color, v.align || 'left', 'top');
    });

    curves.forEach(function (c) {
      var d = c.domain || [xmin, xmax], N = c.samples || 700;
      ctx.save();
      ctx.strokeStyle = c.color || COLORS[0]; ctx.lineWidth = c.width || 2;
      if (c.dash) ctx.setLineDash(c.dash);
      ctx.beginPath();
      if (c.fill) {
        ctx.moveTo(X(d[0]), Y(y0));
        for (i = 0; i <= N; i++) { x = d[0] + (d[1] - d[0]) * i / N; y = c.f(x); if (isFinite(y)) ctx.lineTo(X(x), Y(y)); }
        ctx.lineTo(X(d[1]), Y(y0)); ctx.closePath();
        ctx.fillStyle = c.color || COLORS[0]; ctx.globalAlpha = c.alpha == null ? .18 : c.alpha; ctx.fill(); ctx.globalAlpha = 1;
      } else {
        var pen = false;
        for (i = 0; i <= N; i++) {
          x = d[0] + (d[1] - d[0]) * i / N; y = c.f(x);
          if (!isFinite(y) || y > ymax + (ymax - ymin) * 6 || y < ymin - (ymax - ymin) * 6) { pen = false; continue; }
          if (!pen) { ctx.moveTo(X(x), Y(y)); pen = true; } else ctx.lineTo(X(x), Y(y));
        }
      }
      ctx.stroke(); ctx.restore();
    });

    // 离散茎叶（离散时间信号 / 线谱）
    stems.forEach(function (st) {
      var col = st.color || COLORS[0], yb = Y(clamp(0, ymin, ymax));
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = st.width || 1.6; ctx.fillStyle = col;
      (st.xs || []).forEach(function (xv, idx) {
        var yv = st.ys[idx];
        if (!isFinite(yv)) return;
        ctx.beginPath(); ctx.moveTo(X(xv), yb); ctx.lineTo(X(xv), Y(yv)); ctx.stroke();
        ctx.beginPath(); ctx.arc(X(xv), Y(yv), st.r || 2.8, 0, 7); ctx.fill();
      });
      ctx.restore();
    });

    (spec.points || []).forEach(function (p) {
      ctx.beginPath(); ctx.fillStyle = p.color || '#dc2626';
      ctx.arc(X(p.x), Y(p.y), p.r || 3.4, 0, 7); ctx.fill();
    });

    // 图例
    if (spec.legend) {
      var items = [];
      curves.forEach(function (c) { if (c.label) items.push(c); });
      stems.forEach(function (st) { if (st.label) items.push({ label: st.label, color: st.color }); });
      if (items.length) {
        var bw = 0;
        ctx.font = '12px ui-monospace, monospace';
        items.forEach(function (it) { bw = Math.max(bw, ctx.measureText(it.label).width); });
        var bx = W - pad.r - bw - 30, by = pad.t + 6;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.strokeStyle = 'rgba(130,150,185,.5)';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw + 26, items.length * 17 + 10, 7); ctx.fill(); ctx.stroke(); }
        else ctx.fillRect(bx, by, bw + 26, items.length * 17 + 10);
        items.forEach(function (it, k) {
          var yy = by + 15 + k * 17;
          ctx.strokeStyle = it.color || COLORS[0]; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(bx + 8, yy); ctx.lineTo(bx + 20, yy); ctx.stroke();
          ctx.fillStyle = '#41506b'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(it.label, bx + 24, yy);
        });
        ctx.restore();
      }
    }
    return { X: X, Y: Y, ctx: ctx, W: W, H: H, pad: pad, xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax };
  }

  /* 复平面（等比例）。opts:{R, unit:是否画单位圆, axesLabel} */
  function plane(cv, opts) {
    var s = setupCanvas(cv), ctx = s.ctx, W = s.W, H = s.H;
    opts = opts || {};
    var R = opts.R || 1.6, pad = opts.pad || 26;
    var sc = Math.min((W - 2 * pad) / (2 * R), (H - 2 * pad) / (2 * R));
    var cx = W / 2, cy = H / 2;
    var X = function (x) { return cx + x * sc; }, Y = function (y) { return cy - y * sc; };
    var invX = function (px) { return (px - cx) / sc; }, invY = function (py) { return (cy - py) / sc; };

    ctx.strokeStyle = 'rgba(130,150,185,.18)'; ctx.lineWidth = 1;
    for (var t = -Math.ceil(R); t <= R; t++) {
      if (!t) continue;
      ctx.beginPath(); ctx.moveTo(X(t), Y(-R)); ctx.lineTo(X(t), Y(R)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(-R), Y(t)); ctx.lineTo(X(R), Y(t)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(110,130,165,.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(X(-R), Y(0)); ctx.lineTo(X(R), Y(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0), Y(-R)); ctx.lineTo(X(0), Y(R)); ctx.stroke();
    if (opts.unit !== false) {
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = '#0e7490'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(X(0), Y(0), sc, 0, 7); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#8b96ad'; ctx.font = '12px ui-monospace, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(opts.axesLabel ? opts.axesLabel[0] : 'Re', X(R) - 20, Y(0) + 5);
    ctx.fillText(opts.axesLabel ? opts.axesLabel[1] : 'Im', X(0) + 5, Y(R) + 2);
    return {
      ctx: ctx, W: W, H: H, sc: sc, R: R, X: X, Y: Y, invX: invX, invY: invY,
      drawPZ: function (poles, zeros, o) { return drawPZ(ctx, X, Y, poles, zeros, o); },
      dot: function (x, y, color, r) { ctx.beginPath(); ctx.fillStyle = color; ctx.arc(X(x), Y(y), r || 3.5, 0, 7); ctx.fill(); },
      line: function (x1, y1, x2, y2, color, dash) {
        ctx.save(); if (dash) ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke(); ctx.restore();
      },
      circle: function (r, color, fill) {
        ctx.save(); ctx.beginPath(); ctx.arc(X(0), Y(0), r * sc, 0, 7);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (color) { ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke(); }
        ctx.restore();
      },
      annulus: function (r1, r2, fill) {
        ctx.save(); ctx.beginPath();
        ctx.arc(X(0), Y(0), r2 * sc, 0, 7);
        ctx.arc(X(0), Y(0), r1 * sc, 0, 7, true);
        ctx.fillStyle = fill; ctx.fill(); ctx.restore();
      },
      outside: function (r, fill) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H);
        ctx.arc(X(0), Y(0), Math.max(r, 1e-6) * sc, 0, 7, true);
        ctx.fillStyle = fill; ctx.fill(); ctx.restore();
      },
      inside: function (r, fill) { ctx.save(); ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(r, 1e-6) * sc, 0, 7); ctx.fillStyle = fill; ctx.fill(); ctx.restore(); },
      halfplane: function (side, sigma, fill) {
        ctx.save(); ctx.beginPath();
        var x = X(sigma);
        if (side === 'right') ctx.rect(x, 0, W - x, H); else ctx.rect(0, 0, x, H);
        ctx.fillStyle = fill; ctx.fill(); ctx.restore();
      },
      strip: function (s1, s2, fill) {
        ctx.save(); ctx.beginPath(); ctx.rect(X(s1), 0, X(s2) - X(s1), H);
        ctx.fillStyle = fill; ctx.fill(); ctx.restore();
      },
      text: function (x, y, str, color, dx, dy) {
        ctx.fillStyle = color || '#33415c'; ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(str, X(x) + (dx == null ? 7 : dx), Y(y) + (dy == null ? -9 : dy));
      }
    };
  }

  function drawPZ(ctx, X, Y, poles, zeros, o) {
    o = o || {};
    (poles || []).forEach(function (p) {
      var x = X(p[0]), y = Y(p[1]), r = o.r || 6;
      ctx.save(); ctx.strokeStyle = o.poleColor || '#dc2626'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); ctx.restore();
    });
    (zeros || []).forEach(function (p) {
      var x = X(p[0]), y = Y(p[1]), r = o.r || 6;
      ctx.save(); ctx.strokeStyle = o.zeroColor || '#4338ca'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.restore();
    });
  }

  /* ================= 信号与系统数学 ================= */
  function rect(x) { return Math.abs(x) < 0.5 ? 1 : (Math.abs(x) === 0.5 ? 0.5 : 0); }
  function tri(x) { return Math.abs(x) < 1 ? 1 - Math.abs(x) : 0; }
  function sinc(t) { return Math.abs(t) < 1e-12 ? 1 : Math.sin(t) / t; }           /* sin(t)/t */
  function sincPi(x) { return Math.abs(x) < 1e-12 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x); }
  function uStep(t) { return t >= 0 ? 1 : 0; }
  function uSeq(n) { return n >= 0 ? 1 : 0; }
  function rectSeq(n) { return Math.abs(n) <= 0.5 ? 1 : 0; }

  /* 方波的傅里叶级数部分和（周期 T，占空比 duty∈(0,1)，幅度 ±1）
     占空比 d 的偶方波：a0=2d−1，a_k=2·sin(2πkd)/(2πk)·2 … 这里用标准结果：
     x(t) = (2d−1) + Σ_k (4/(kπ))·sin(kπd)·cos(kω0 t)，ω0=2π/T */
  function squarePartial(t, N, T, duty) {
    var w0 = 2 * Math.PI / T, s = 2 * duty - 1;
    for (var k = 1; k <= N; k++) {
      var ak = 4 * Math.sin(k * Math.PI * duty) / (k * Math.PI);
      s += ak * Math.cos(k * w0 * t);
    }
    return s;
  }
  function squareCoeff(k, duty) { /* k≥1 时返回 a_k（cos 系数） */
    if (k === 0) return 2 * duty - 1;
    return 4 * Math.sin(k * Math.PI * duty) / (k * Math.PI);
  }

  /* 连续时间傅里叶变换数值积分：X(jw)=∫_{a}^{b} f(t) e^{-jwt} dt */
  function ctft(f, w, o) {
    o = o || {};
    var a = o.a == null ? -10 : o.a, b = o.b == null ? 10 : o.b, N = o.N || 3000;
    var h = (b - a) / N, re = 0, im = 0, i, t, v, c, s;
    for (i = 0; i <= N; i++) {
      t = a + i * h; v = f(t); if (!isFinite(v)) continue;
      c = Math.cos(w * t); s = -Math.sin(w * t);
      var wt = (i === 0 || i === N) ? 0.5 : 1;
      re += wt * v * c * h; im += wt * v * s * h;
    }
    return { re: re, im: im, mag: Math.hypot(re, im), ph: Math.atan2(im, re) };
  }

  /* 离散傅里叶变换（O(N²)，N 小的时候够用；也用于校验 FFT） */
  function dft(x) {
    var N = x.length, out = [], k, n;
    for (k = 0; k < N; k++) {
      var re = 0, im = 0;
      for (n = 0; n < N; n++) {
        var ang = -2 * Math.PI * k * n / N, v = typeof x[n] === 'number' ? x[n] : x[n].re;
        re += v * Math.cos(ang); im += v * Math.sin(ang);
      }
      out.push({ re: re, im: im });
    }
    return out;
  }
  function idft(X) {
    var N = X.length, out = [], n, k;
    for (n = 0; n < N; n++) {
      var re = 0, im = 0;
      for (k = 0; k < N; k++) {
        var ang = 2 * Math.PI * k * n / N;
        re += X[k].re * Math.cos(ang) - X[k].im * Math.sin(ang);
        im += X[k].re * Math.sin(ang) + X[k].im * Math.cos(ang);
      }
      out.push({ re: re / N, im: im / N });
    }
    return out;
  }
  /* 迭代式基 2 FFT（长度须为 2 的幂）：输入实数或 {re,im} 数组，返回 {re,im} 数组 */
  function fft(x) {
    var n = x.length;
    if ((n & (n - 1)) !== 0) throw new Error('fft 需要 2 的幂长度');
    var re = [], im = [], i;
    for (i = 0; i < n; i++) { re.push(typeof x[i] === 'number' ? x[i] : x[i].re); im.push(typeof x[i] === 'number' ? 0 : x[i].im); }
    for (i = 1; i < n; i++) {                     /* 位反转置换 */
      var j = 0, bit;
      for (bit = 0; bit < Math.log2(n); bit++) if (i & (1 << bit)) j |= 1 << (Math.log2(n) - 1 - bit);
      if (j > i) { var t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (var len = 2; len <= n; len *= 2) {
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (var s = 0; s < n; s += len) {
        var cr = 1, ci = 0;
        for (var k = 0; k < len / 2; k++) {
          var i1 = s + k, i2 = s + k + len / 2;
          var tr = re[i2] * cr - im[i2] * ci, ti = re[i2] * ci + im[i2] * cr;
          re[i2] = re[i1] - tr; im[i2] = im[i1] - ti;
          re[i1] += tr; im[i1] += ti;
          var ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
    var out = [];
    for (i = 0; i < n; i++) out.push({ re: re[i], im: im[i] });
    return out;
  }

  /* 离散卷积（有限长序列，直接按定义累加） */
  function convSeq(x, h) {
    var y = new Array(x.length + h.length - 1).fill(0), n, k;
    for (n = 0; n < y.length; n++)
      for (k = 0; k < x.length; k++)
        if (n - k >= 0 && n - k < h.length) y[n] += x[k] * h[n - k];
    return y;
  }

  /* 由极点/零点算频率响应。
     opts:{ ct:false } → DT，取 z=e^{jω}，ω∈[0,π]
     opts:{ ct:true, wmax } → CT，取 s=jω，ω∈[0,wmax]（默认 10） */
  function respPZ(poles, zeros, K, N, opts) {
    opts = opts || {};
    N = N || 400; K = (K == null ? 1 : K);
    var dt = !opts.ct;
    var out = [], i, n, top = dt ? Math.PI : (opts.wmax || 10);
    for (i = 0; i <= N; i++) {
      var w = top * i / N;
      var zr = dt ? Math.cos(w) : 0, zi = dt ? Math.sin(w) : w;
      var num = K, den = 1, ph = 0;
      for (n = 0; n < (zeros || []).length; n++) {
        var dr = zr - zeros[n][0], di = zi - zeros[n][1];
        num *= Math.hypot(dr, di); ph += Math.atan2(di, dr);
      }
      for (n = 0; n < (poles || []).length; n++) {
        var er = zr - poles[n][0], ei = zi - poles[n][1];
        den *= Math.hypot(er, ei); ph -= Math.atan2(ei, er);
      }
      var mag = den === 0 ? Infinity : num / den;
      out.push({ w: w, mag: mag, db: 20 * Math.log10(mag + 1e-300), ph: ph });
    }
    return out;
  }
  /* 由差分方程系数算频响：H(z)=Σb_k z^{-k} / (1+Σ_{k≥1} a_k z^{-k}) */
  function respBA(b, a, N) {
    N = N || 400; a = a || [1];
    var out = [], i, k;
    for (i = 0; i <= N; i++) {
      var w = Math.PI * i / N, numr = 0, numi = 0, denr = 0, deni = 0;
      for (k = 0; k < b.length; k++) { numr += b[k] * Math.cos(-w * k); numi += b[k] * Math.sin(-w * k); }
      for (k = 0; k < a.length; k++) { denr += a[k] * Math.cos(-w * k); deni += a[k] * Math.sin(-w * k); }
      var dd = denr * denr + deni * deni || 1e-300;
      var hr = (numr * denr + numi * deni) / dd, hi = (numi * denr - numr * deni) / dd;
      var mag = Math.hypot(hr, hi);
      out.push({ w: w, mag: mag, db: 20 * Math.log10(mag + 1e-300), ph: Math.atan2(hi, hr) });
    }
    return out;
  }
  /* 差分方程仿真（直接 I 型）：y[n]=Σb_k x[n-k] − Σ_{k≥1} a_k y[n-k] */
  function diffEq(b, a, x) {
    a = a || [1]; var y = new Array(x.length).fill(0), n, k;
    for (n = 0; n < x.length; n++) {
      var acc = 0;
      for (k = 0; k < b.length; k++) if (n - k >= 0) acc += b[k] * x[n - k];
      for (k = 1; k < a.length; k++) if (n - k >= 0) acc -= a[k] * y[n - k];
      y[n] = acc / a[0];
    }
    return y;
  }

  /* sinc 内插重建（采样定理的"理想重建"）：
     x(t) = Σ_n x[n] · sinc((t − nTs)/Ts)  —— 只对给定 t 直接求和 */
  function sincInterp(samples, Ts, t) {
    var s = 0;
    for (var n = 0; n < samples.length; n++) s += samples[n] * sincPi((t - n * Ts) / Ts);
    return s;
  }

  /* ---- 复数小工具 ---- */
  function C(re, im) { return { re: re, im: im || 0 }; }
  function cadd(p, q) { return C(p.re + q.re, p.im + q.im); }
  function csub(p, q) { return C(p.re - q.re, p.im - q.im); }
  function cmul(p, q) { return C(p.re * q.re - p.im * q.im, p.re * q.im + p.im * q.re); }
  function cdiv(p, q) { var d = q.re * q.re + q.im * q.im; return C((p.re * q.re + p.im * q.im) / d, (p.im * q.re - p.re * q.im) / d); }
  function cabs(p) { return Math.hypot(p.re, p.im); }
  function cstr(p, d) {
    d = d == null ? 2 : d;
    if (Math.abs(p[1] != null ? p[1] : p.im) < 1e-7) return fmt(p[0] != null ? p[0] : p.re, d);
    var re = p[0] != null ? p[0] : p.re, im = p[1] != null ? p[1] : p.im;
    return fmt(re, d) + (im >= 0 ? '+' : '−') + fmt(Math.abs(im), d) + 'j';
  }

  /* 多项式求根：Durand–Kerner（系数按降幂 c[0]z^n+…+c[n]） */
  function polyRoots(c) {
    var n = c.length - 1;
    if (n < 1) return [];
    var a = c.map(function (v) { return v / c[0]; });
    var mx = 0; for (var k = 1; k <= n; k++) mx = Math.max(mx, Math.abs(a[k]));
    var r0 = Math.max(0.4, Math.min(4, 1 + mx));
    var roots = [];
    for (var i = 0; i < n; i++) {
      var ang = 2 * Math.PI * i / n + 0.4;
      roots.push(C(r0 * Math.cos(ang), r0 * Math.sin(ang)));
    }
    function pv(z) {
      var acc = C(a[0], 0);
      for (var k = 1; k <= n; k++) acc = cadd(cmul(acc, z), C(a[k], 0));
      return acc;
    }
    for (var it = 0; it < 400; it++) {
      var maxd = 0;
      for (var j = 0; j < n; j++) {
        var den = C(1, 0);
        for (var m = 0; m < n; m++) if (m !== j) den = cmul(den, csub(roots[j], roots[m]));
        var delta = cdiv(pv(roots[j]), den);
        roots[j] = csub(roots[j], delta);
        maxd = Math.max(maxd, cabs(delta));
      }
      if (maxd < 1e-13) break;
    }
    return roots.sort(function (p, q) { return p.re - q.re || p.im - q.im; });
  }
  function polyVal(c, x) { var acc = 0; for (var i = 0; i < c.length; i++) acc = acc * x + c[i]; return acc; }
  function polyDer(c) { var n = c.length - 1, out = []; for (var i = 0; i < n; i++) out.push(c[i] * (n - i)); return out.length ? out : [0]; }
  function ba2pz(b, a) {
    var N = Math.max(b.length, a.length) - 1;
    if (N < 1) return { zeros: [], poles: [] };
    function pad(c) { var o = []; for (var i = 0; i <= N; i++) o.push(i < c.length ? c[i] : 0); return o; }
    function rootsOf(c) {
      var t = c.slice();
      while (t.length > 1 && Math.abs(t[0]) < 1e-15) t.shift();
      if (t.length < 2) return [];
      return polyRoots(t).map(function (z) { return [z.re, z.im]; });
    }
    return { zeros: rootsOf(pad(b)), poles: rootsOf(pad(a)) };
  }

  /* ================= 互动实验台 lab() ================= */
  var LABS = [];
  function redrawAll() { LABS.forEach(function (L) { try { L.draw(); } catch (e) { /* 忽略重绘异常 */ } }); }

  /* opts:
     { mount:'#id' | element, title, hint, note(字符串或函数),
       canvases:[{id,label,height}] | 单画布时可以省略（自动一个 'main'）,
       columns:1|2, height:220,
       controls:[{id,label,min,max,step,value,unit,fmt,options}],
       buttons:[{label,onClick(vals,api)}],
       draw:function(cvMap, vals, api)  // 每次改参数都被调用
     }  */
  function lab(o) {
    var mount = typeof o.mount === 'string' ? document.getElementById(o.mount.replace('#', '')) : o.mount;
    if (!mount) return null;
    var rows = o.canvases || [{ id: 'main', label: '', height: o.height || 220 }];
    var box = el('div', 'lab');
    if (o.title) {
      var head = el('div', 'lab-head');
      head.appendChild(el('b', '', o.title));
      if (o.hint) head.appendChild(el('span', 'hint', o.hint));
      box.appendChild(head);
    }
    var grid = el('div', 'canvases' + (rows.length > 1 && (o.columns !== 1) ? ' g2c' : ''));
    var cvMap = {};
    rows.forEach(function (r) {
      var cell = el('div', 'cv-cell');
      if (r.label) cell.appendChild(el('div', 'cv-label', r.label));
      var cv = document.createElement('canvas');
      cv.id = o.mount.toString().replace('#', '') + '-' + r.id;
      cv.style.height = (r.height || o.height || 220) + 'px';
      cell.appendChild(cv); grid.appendChild(cell);
      cvMap[r.id] = cv;
    });
    box.appendChild(grid);

    var ctlBox = null, vals = {}, inputs = {};
    if (o.controls && o.controls.length) {
      ctlBox = el('div', 'lab-controls');
      o.controls.forEach(function (c) {
        var w = el('div', 'ctl');
        var row = el('div', 'row');
        row.appendChild(el('span', '', c.label));
        var valEl = el('span', 'val', '');
        row.appendChild(valEl);
        w.appendChild(row);
        var inp;
        if (c.options) {
          inp = document.createElement('select');
          c.options.forEach(function (op) {
            var opt = document.createElement('option');
            opt.value = op.v; opt.textContent = op.t;
            inp.appendChild(opt);
          });
          inp.value = c.value != null ? c.value : c.options[0].v;
          vals[c.id] = isNaN(+inp.value) ? inp.value : +inp.value;
          inp.addEventListener('change', function () {
            vals[c.id] = isNaN(+inp.value) ? inp.value : +inp.value;
            valEl.textContent = '';
            fire();
          });
        } else {
          inp = document.createElement('input');
          inp.type = 'range'; inp.min = c.min; inp.max = c.max;
          inp.step = c.step == null ? 0.01 : c.step;
          inp.value = c.value == null ? c.min : c.value;
          vals[c.id] = +inp.value;
          var show = function () { valEl.textContent = (c.fmt ? c.fmt(vals[c.id]) : fmt(vals[c.id], 2)) + (c.unit || ''); };
          show();
          inp.addEventListener('input', function () { vals[c.id] = +inp.value; show(); fire(); });
          valEl.textContent = (c.fmt ? c.fmt(vals[c.id]) : fmt(vals[c.id], 2)) + (c.unit || '');
        }
        inp.setAttribute('aria-label', c.label);
        w.appendChild(inp);
        inputs[c.id] = inp;
        ctlBox.appendChild(w);
      });
      box.appendChild(ctlBox);
    }
    var actBox = null;
    if (o.buttons && o.buttons.length) {
      actBox = el('div', 'lab-actions');
      o.buttons.forEach(function (b) {
        var bt = el('button', 'btn ghost sm', b.label);
        bt.addEventListener('click', function () { b.onClick(vals, api); });
        actBox.appendChild(bt);
      });
      box.appendChild(actBox);
    }
    var readEl = el('div', 'readout');
    box.appendChild(readEl);
    var noteEl = el('div', 'lab-note');
    box.appendChild(noteEl);
    mount.appendChild(box);

    function setNote(text) {
      if (text == null) { noteEl.innerHTML = ''; return; }
      noteEl.innerHTML = o.note && typeof o.note === 'function' ? o.note(vals, api) : (typeof text === 'string' ? text : '');
    }
    function draw() {
      try { o.draw(cvMap, vals, api); } catch (e) { if (global.console) console.error('lab draw 出错:', e); }
      if (o.note) setNote(o.note(vals, api));
    }
    function fire() { draw(); }
    var api = {
      vals: vals, canvases: cvMap, redraw: draw,
      readout: function (html) { readEl.innerHTML = html; },
      note: function (html) { noteEl.innerHTML = html; },
      set: function (id, v) {
        vals[id] = v;
        if (inputs[id]) {
          inputs[id].value = v;
          var row = inputs[id].parentNode && inputs[id].parentNode.querySelector('.val');
          var cdef = null;
          (o.controls || []).forEach(function (c) { if (c.id === id) cdef = c; });
          if (row && cdef && !cdef.options) row.textContent = (cdef.fmt ? cdef.fmt(v) : fmt(v, 2)) + (cdef.unit || '');
        }
        draw();
      }
    };
    LABS.push({ draw: draw });
    draw();
    return api;
  }

  /* ================= 测验 ================= */
  /* items: [{q, opts:[...], a:index, why, tag}] */
  function quiz(mount, items, title) {
    var box = typeof mount === 'string' ? document.getElementById(mount.replace('#', '')) : mount;
    if (!box) return;
    var card = el('div', 'quiz');
    var head = el('div', 'qh', '<span>' + (title || '自测 · 检验理解') + '</span>' +
      '<span>共 ' + items.length + ' 题　已答 <b class="score">0</b>　正确 <b class="score ok-n">0</b></span>');
    card.appendChild(head);
    var answered = 0, correct = 0;
    items.forEach(function (it, i) {
      var q = el('div', 'q', (i + 1) + '. ' + it.q + (it.tag ? ' <span class="badge cy">' + it.tag + '</span>' : ''));
      card.appendChild(q);
      var opts = el('div', 'opts');
      var fb = el('div', 'fb');
      var locked = false;
      it.opts.forEach(function (o, j) {
        var b = el('button', 'opt', o);
        b.addEventListener('click', function () {
          if (locked) return; locked = true;
          answered++;
          Array.prototype.slice.call(opts.children).forEach(function (c, k) {
            c.classList.add('locked');
            if (k === it.a) c.classList.add('correct');
          });
          if (j === it.a) { correct++; fb.className = 'fb good show'; fb.innerHTML = '✅ 正确。<br>' + (it.why || ''); }
          else { b.classList.add('wrong'); fb.className = 'fb bad show'; fb.innerHTML = '❌ 再想想（正确项已标绿）。<br>' + (it.why || ''); }
          head.querySelector('.score').textContent = answered;
          head.querySelector('.ok-n').textContent = correct;
        });
        opts.appendChild(b);
      });
      card.appendChild(opts);
      card.appendChild(fb);
    });
    box.appendChild(card);
  }

  /* ================= 分页 tabs ================= */
  function tabs(mount, list) {
    var box = typeof mount === 'string' ? document.getElementById(mount.replace('#', '')) : mount;
    if (!box) return;
    var bar = el('div', 'lab-actions'), pane = el('div', '');
    list.forEach(function (t, i) {
      var b = el('button', 'btn ' + (i === 0 ? '' : 'ghost') + ' sm', t.title);
      b.addEventListener('click', function () {
        Array.prototype.slice.call(bar.children).forEach(function (c, k) {
          c.className = 'btn ' + (k === i ? '' : 'ghost') + ' sm';
        });
        pane.innerHTML = t.html;
      });
      bar.appendChild(b);
    });
    pane.innerHTML = list[0].html;
    box.appendChild(bar); box.appendChild(pane);
  }

  /* ================= 可拖动极点零点实验室 =================
     domain:'z'（默认，单位圆）或 's'（虚轴）
     opts:{ domain, canvas, respCanvas, statsEl, noteEl, poles, zeros, K, R,
            mode:'causal'|'anticausal'|'annulus', wmax, onChange, respLabel, dtf }
     返回 { draw, state, set, setMode, reset } */
  function pzLab(o) {
    var cv = typeof o.canvas === 'string' ? document.getElementById(o.canvas.replace('#', '')) : o.canvas;
    var rcv = typeof o.respCanvas === 'string' ? document.getElementById(o.respCanvas.replace('#', '')) : o.respCanvas;
    var statsEl = typeof o.statsEl === 'string' ? document.getElementById(o.statsEl.replace('#', '')) : o.statsEl;
    var noteEl = typeof o.noteEl === 'string' ? document.getElementById(o.noteEl.replace('#', '')) : o.noteEl;
    if (!cv) return null;
    var domain = o.domain || 'z';
    var initP = (o.poles || []).map(function (p) { return [p[0], p[1]]; });
    var initZ = (o.zeros || []).map(function (p) { return [p[0], p[1]]; });
    var poles = initP.map(function (p) { return p.slice(); });
    var zeros = initZ.map(function (p) { return p.slice(); });
    var K = o.K == null ? 1 : o.K;
    var R = o.R || (domain === 'z' ? 1.9 : 2.4);
    var mode = o.mode || 'causal';
    var wmax = o.wmax || (domain === 'z' ? Math.PI : 6);
    var drag = null, view = null;

    function maxAbs(list) {
      var m = 0; (list || []).forEach(function (p) { m = Math.max(m, Math.hypot(p[0], p[1])); }); return m;
    }
    function minAbs(list) {
      var m = Infinity; (list || []).forEach(function (p) { m = Math.min(m, Math.hypot(p[0], p[1])); }); return m;
    }
    function curR() {
      var need = Math.max(1.25, maxAbs(poles) * 1.35, maxAbs(zeros) * 1.35);
      return Math.min(R, Math.max(need, 0.7));
    }
    var ROC_FILL = 'rgba(21,128,61,.13)';

    function draw() {
      view = plane(cv, { R: curR(), unit: domain === 'z' });
      var rmax = maxAbs(poles), rmin = minAbs(poles);
      var noPole = poles.length === 0;
      if (domain === 'z') {
        if (noPole) { view.ctx.save(); view.ctx.fillStyle = ROC_FILL; view.ctx.fillRect(0, 0, view.W, view.H); view.ctx.restore(); }
        else if (mode === 'causal') view.outside(rmax, ROC_FILL);
        else if (mode === 'anticausal') view.inside(rmin, ROC_FILL);
        else view.annulus(Math.min(rmin, rmax), Math.max(rmin, rmax), ROC_FILL);
      } else {
        var sMax = -Infinity, sMin = Infinity;
        poles.forEach(function (p) { sMax = Math.max(sMax, p[0]); sMin = Math.min(sMin, p[0]); });
        if (noPole) { view.ctx.save(); view.ctx.fillStyle = ROC_FILL; view.ctx.fillRect(0, 0, view.W, view.H); view.ctx.restore(); }
        else if (mode === 'causal') view.halfplane('right', sMax, ROC_FILL);
        else if (mode === 'anticausal') view.halfplane('left', sMin, ROC_FILL);
        else view.strip(Math.min(sMin, sMax), Math.max(sMin, sMax), ROC_FILL);
      }
      view.drawPZ(poles, zeros);
      poles.forEach(function (p, i) { view.text(p[0], p[1], 'p' + (i + 1)); });
      zeros.forEach(function (z, i) { view.text(z[0], z[1], 'z' + (i + 1)); });

      // 频响
      function magAtW(w) {
        var zr, zi;
        if (domain === 'z') { zr = Math.cos(w); zi = Math.sin(w); } else { zr = 0; zi = w; }
        var num = K, den = 1, i;
        for (i = 0; i < zeros.length; i++) num *= Math.hypot(zr - zeros[i][0], zi - zeros[i][1]);
        for (i = 0; i < poles.length; i++) den *= Math.hypot(zr - poles[i][0], zi - poles[i][1]);
        return den === 0 ? 1e12 : num / den;
      }
      var N = 400, mx = 0, mxi = 0;
      for (var i = 0; i <= N; i++) { var m = magAtW(wmax * i / N); if (isFinite(m) && m > mx) { mx = m; mxi = i; } }
      var onAxis = false;
      poles.forEach(function (p) {
        if (domain === 'z' ? Math.abs(Math.hypot(p[0], p[1]) - 1) < 0.01 : Math.abs(p[0]) < 0.01) onAxis = true;
      });
      var plotMax = Math.min(1e3, Math.max(1.05, (isFinite(mx) ? mx : 1) * 1.12));
      if (rcv) {
        plot(rcv, {
          xmin: 0, xmax: wmax, ymin: 0, ymax: plotMax,
          xticks: domain === 'z' ? [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI] : undefined,
          xlabel: domain === 'z' ? 'ω (rad/样本)' : 'ω (rad/s)',
          ylabel: o.respLabel || (domain === 'z' ? '|H(e^{jω})|' : '|H(jω)|'),
          curves: [{ f: function (w) { return Math.min(plotMax, magAtW(w)); }, color: '#0e7490', width: 2.2 }]
        });
      }
      if (statsEl) {
        var stable;
        if (domain === 'z') {
          if (noPole) stable = true;
          else if (mode === 'causal') stable = rmax < 1 - 1e-9;
          else if (mode === 'anticausal') stable = rmin > 1 + 1e-9;
          else stable = (rmin < 1 - 1e-9) && (rmax > 1 + 1e-9);
        } else {
          var mxRe = noPole ? 0 : Math.max.apply(null, poles.map(function (p) { return p[0]; }));
          var mnRe = noPole ? 0 : Math.min.apply(null, poles.map(function (p) { return p[0]; }));
          if (noPole) stable = true;
          else if (mode === 'causal') stable = mxRe < -1e-9;
          else if (mode === 'anticausal') stable = mnRe > 1e-9;
          else stable = (mnRe < -1e-9) && (mxRe > 1e-9);
        }
        var poleStr = poles.length ? poles.map(function (p) { return cstr(p); }).join(', ') : '（无）';
        var zeroStr = zeros.length ? zeros.map(function (p) { return cstr(p); }).join(', ') : '（无）';
        statsEl.innerHTML =
          '<div class="stat"><div class="k">极点 poles</div><div class="v" style="font-size:13px">' + poleStr + '</div></div>' +
          '<div class="stat"><div class="k">零点 zeros</div><div class="v" style="font-size:13px">' + zeroStr + '</div></div>' +
          '<div class="stat"><div class="k">' + (domain === 'z' ? 'max|p|' : 'max Re{p}') + '</div><div class="v">' +
          fmt(domain === 'z' ? rmax : (noPole ? 0 : Math.max.apply(null, poles.map(function (p) { return p[0]; }))), 3) + '</div></div>' +
          '<div class="stat"><div class="k">峰值增益</div><div class="v">' + (onAxis ? '∞' : fmt(mx, 3)) + '</div></div>' +
          '<div class="stat"><div class="k">峰值位置</div><div class="v">' + fmt(wmax * mxi / N, 3) + '</div></div>' +
          '<div class="stat"><div class="k">稳定性</div><div class="v" style="color:' +
          (onAxis ? '#b45309' : (stable ? '#15803d' : '#b91c1c')) + '">' +
          (onAxis ? '临界（落在轴上）' : (stable ? '稳定' : '不稳定')) + '</div></div>';
      }
      if (noteEl && o.note !== false) {
        var t;
        if (domain === 'z') {
          if (noPole) t = '没有极点：ROC 是<b>整个 z 平面</b>（有限长脉冲响应，FIR）。';
          else if (mode === 'causal') t = '因果（右边）序列：<b>ROC = { |z| &gt; ' + fmt(rmax, 3) + ' }</b>（绿色，最外极点<b>之外</b>）。' +
            (rmax < 1 ? '单位圆整圈落在 ROC 内 → <b>DTFT 存在</b>，系统<b>稳定</b>。' : '最外极点在单位圆外 → 单位圆不在 ROC 内，系统<b>不稳定</b>。');
          else if (mode === 'anticausal') t = '反因果（左边）序列：<b>ROC = { |z| &lt; ' + fmt(rmin, 3) + ' }</b>（绿色，最内极点<b>之内</b>）。' +
            '同一个 X(z) 配不同 ROC，对应<b>完全不同的序列</b>。';
          else t = '双边序列：<b>ROC = { ' + fmt(Math.min(rmin, rmax), 3) + ' &lt; |z| &lt; ' + fmt(Math.max(rmin, rmax), 3) + ' }</b>（环形，两个极点之间）。';
        } else {
          if (noPole) t = '没有极点：ROC 是<b>整个 s 平面</b>。';
          else if (mode === 'causal') t = '因果（右边）信号：<b>ROC = { Re{s} &gt; ' + fmt(Math.max.apply(null, poles.map(function (p) { return p[0]; })), 3) + ' }</b>。' +
            (Math.max.apply(null, poles.map(function (p) { return p[0]; })) < 0 ? '虚轴整条落在 ROC 内 → <b>傅里叶变换存在</b>，系统<b>稳定</b>。' : '极点在右半平面 → 虚轴不在 ROC 内，系统<b>不稳定</b>。');
          else if (mode === 'anticausal') t = '反因果（左边）信号：<b>ROC = { Re{s} &lt; ' + fmt(Math.min.apply(null, poles.map(function (p) { return p[0]; })), 3) + ' }</b>。';
          else t = '双边信号：<b>ROC 是竖直条带 ' + fmt(Math.min.apply(null, poles.map(function (p) { return p[0]; })), 3) + ' &lt; Re{s} &lt; ' +
            fmt(Math.max.apply(null, poles.map(function (p) { return p[0]; })), 3) + '</b>。';
        }
        noteEl.innerHTML = t;
      }
      if (o.onChange) o.onChange(api);
    }

    function pick(px, py) {
      var best = null, bestD = 18;
      poles.forEach(function (p, i) { var d = Math.hypot(px - view.X(p[0]), py - view.Y(p[1])); if (d < bestD) { bestD = d; best = { type: 'p', i: i }; } });
      zeros.forEach(function (p, i) { var d = Math.hypot(px - view.X(p[0]), py - view.Y(p[1])); if (d < bestD) { bestD = d; best = { type: 'z', i: i }; } });
      return best;
    }
    function pos(e) {
      var r = cv.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function down(e) { var p = pos(e); drag = pick(p.x, p.y); if (drag) e.preventDefault(); }
    function move(e) {
      if (!drag) return;
      var p = pos(e), nx = view.invX(p.x), ny = view.invY(p.y), lim = view.R + 0.4;
      nx = clamp(nx, -lim, lim); ny = clamp(ny, -lim, lim);
      if (o.snapUnit && e.shiftKey) { var m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m; }
      if (drag.type === 'p') poles[drag.i] = [nx, ny]; else zeros[drag.i] = [nx, ny];
      draw(); e.preventDefault();
    }
    function up() { drag = null; }
    cv.addEventListener('mousedown', down);
    cv.addEventListener('mousemove', move);
    global.addEventListener('mouseup', up);
    cv.addEventListener('touchstart', down, { passive: false });
    cv.addEventListener('touchmove', move, { passive: false });
    cv.addEventListener('touchend', up);
    cv.style.cursor = 'grab';

    var api = {
      draw: draw,
      state: function () { return { poles: poles.map(function (p) { return p.slice(); }), zeros: zeros.map(function (p) { return p.slice(); }), mode: mode }; },
      set: function (p, z) {
        if (p) poles = p.map(function (q) { return q.slice(); });
        if (z) zeros = z.map(function (q) { return q.slice(); });
        draw();
      },
      setMode: function (m) { mode = m; draw(); },
      reset: function () { poles = initP.map(function (p) { return p.slice(); }); zeros = initZ.map(function (p) { return p.slice(); }); draw(); }
    };
    draw();
    return api;
  }

  /* 窗口尺寸变化 → 全部实验台重绘（防抖） */
  if (global.addEventListener) {
    var rt = null;
    global.addEventListener('resize', function () {
      if (rt) global.clearTimeout(rt);
      rt = global.setTimeout(redrawAll, 160);
    });
  }

  var API = {
    PAGES: PAGES, el: el, store: store, progress: progress, markDone: markDone, onReady: onReady,
    initNav: initNav, initTerms: initTerms, initTheme: initTheme, redrawAll: redrawAll,
    plot: plot, plane: plane, drawPZ: drawPZ, lab: lab, quiz: quiz, tabs: tabs, pzLab: pzLab,
    rect: rect, tri: tri, sinc: sinc, sincPi: sincPi, uStep: uStep, uSeq: uSeq, rectSeq: rectSeq,
    squarePartial: squarePartial, squareCoeff: squareCoeff, ctft: ctft,
    dft: dft, idft: idft, fft: fft, convSeq: convSeq, respPZ: respPZ, respBA: respBA, diffEq: diffEq,
    sincInterp: sincInterp, polyRoots: polyRoots, polyVal: polyVal, polyDer: polyDer, ba2pz: ba2pz,
    C: C, cadd: cadd, csub: csub, cmul: cmul, cdiv: cdiv, cabs: cabs, cstr: cstr,
    fmt: fmt, clamp: clamp, niceTicks: niceTicks, COLORS: COLORS
  };
  global.SSC = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
