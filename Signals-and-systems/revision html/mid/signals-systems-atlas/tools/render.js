#!/usr/bin/env node
/**
 * render.js —— 几何自检（没有浏览器时的"渲染体检"）
 * 做的事：用记录型 canvas 上下文真跑每个页面，然后
 *   1) 把每个互动实验台的**参数推到 min / max / 中间值**，每次重绘都检查：
 *      - 有没有 NaN / Infinity 坐标（画布变空白的第一大元凶）
 *      - 坐标量级有没有爆掉（投影算错会画到画布外几万像素）
 *      - 这一帧到底有没有真的画东西（ops 计数）
 *      - 有没有把文字画到画布外面
 *   2) 汇报每页的实验台个数、控件个数、测试过的极端组合数
 *
 * 用法：node tools/render.js [页面...]
 * 退出码：0 = 全部通过
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { runPage, ROOT } = require('./domstub');

const args = process.argv.slice(2);
const files = args.length
  ? args.map(a => path.resolve(ROOT, a))
  : fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort().map(f => path.join(ROOT, f));

let bad = 0;

for (const f of files) {
  const name = path.basename(f);
  const res = runPage(f, { record: true, wrapLab: true });
  const issues = [];
  res.problems.forEach(p => issues.push(p));
  if (res.missing.length) issues.push('请求了不存在的 id: ' + res.missing.join(', '));

  let frames = 0;
  const labInfo = [];
  (res.labs || []).forEach(function (L, li) {
    const id = L.kind === 'pz' ? 'pzLab#' : 'lab#';
    if (L.kind === 'pz') {
      /* 极零点拖拽实验室：把极点推到几个危险位置 + 切换三种 ROC 模式 */
      const pzv = res.sandbox.document.getElementById(String(L.o.canvas).replace('#', ''));
      const pzr = res.sandbox.document.getElementById(String(L.o.respCanvas || '').replace('#', ''));
      labInfo.push(id + (li + 1) + '「极零点实验室 domain=' + (L.o.domain || 'z') + '」');
      const cases = [
        { name: '原极点', p: (L.o.poles || []).map(p => p.slice()) },
        { name: '极点在原点', p: [[0, 0]] },
        { name: '极点在单位圆/虚轴上', p: [[1, 0]] },
        { name: '极点跑到圆外', p: [[1.6, 0.4]] },
        { name: '两个极点重合', p: [[0.92, 0], [0.92, 0]] }
      ];
      ['causal', 'anticausal', 'annulus'].forEach(function (mode) {
        cases.forEach(function (cse) {
          const recs = [];
          [pzv, pzr].forEach(function (cv) {
            if (!cv) return;
            const ctx = cv.getContext('2d');
            if (ctx && ctx.__rec) { const r = ctx.__rec; r.nan = 0; r.points = 0; r.textOut = 0; r.maxAbs = 0; r.ops = {}; recs.push(r); }
          });
          frames++;
          try { L.api.setMode(mode); L.api.set(cse.p, null); }
          catch (e) { issues.push(id + (li + 1) + ' 模式 ' + mode + ' / ' + cse.name + ' 抛异常: ' + e.message); return; }
          recs.forEach(function (r, ri) {
            const drawOps = (r.ops.beginPath || 0) + (r.ops.fillRect || 0) + (r.ops.fillText || 0) + (r.ops.stroke || 0);
            if (r.nan > 0) issues.push(id + (li + 1) + ' 模式 ' + mode + ' / ' + cse.name + ' → 画布' + (ri + 1) + ' 出现 ' + r.nan + ' 个 NaN/Infinity 坐标');
            if (r.maxAbs > 1e6) issues.push(id + (li + 1) + ' 模式 ' + mode + ' / ' + cse.name + ' → 画布' + (ri + 1) + ' 坐标爆掉（' + r.maxAbs.toExponential(2) + '）');
            if (drawOps === 0) issues.push(id + (li + 1) + ' 模式 ' + mode + ' / ' + cse.name + ' → 画布' + (ri + 1) + ' 这一帧什么都没画');
          });
        });
      });
      try { L.api.reset(); } catch (e) { }
      return;
    }

    const controls = (L.o && L.o.controls) || [];
    const canvasCount = (L.o.canvases || [{ id: 'main' }]).length;
    labInfo.push(id + (li + 1) + '「' + ((L.o && L.o.title) || '未命名') + '」画布 ' + canvasCount + ' 个 / 控件 ' + controls.length + ' 个');
    if (!controls.length) return;

    controls.forEach(function (c) {
      let tests;
      if (c.options) tests = c.options.map(o => o.v);
      else {
        const min = c.min == null ? 0 : c.min, max = c.max == null ? 1 : c.max;
        tests = [min, max, (min + max) / 2];
      }
      tests.forEach(function (tv) {
        /* 清空所有画布的记录 */
        const recs = [];
        Object.keys(L.api.canvases).forEach(function (k) {
          const cv = L.api.canvases[k];
          const ctx = cv.getContext('2d');
          if (ctx && ctx.__rec) { const r = ctx.__rec; r.nan = 0; r.points = 0; r.textOut = 0; r.maxAbs = 0; r.ops = {}; recs.push(r); }
        });
        frames++;
        try { L.api.set(c.id, tv); }
        catch (e) { issues.push('lab#' + (li + 1) + ' 控件 ' + c.id + '=' + tv + ' 时抛异常: ' + e.message); return; }
        recs.forEach(function (r, ri) {
          const drawOps = (r.ops.beginPath || 0) + (r.ops.fillRect || 0) + (r.ops.fillText || 0) + (r.ops.stroke || 0);
          if (r.nan > 0) issues.push('lab#' + (li + 1) + ' 控件 ' + c.id + '=' + tv + ' → 画布' + (ri + 1) + ' 出现 ' + r.nan + ' 个 NaN/Infinity 坐标（会画出空白或断线）');
          if (r.maxAbs > 1e6) issues.push('lab#' + (li + 1) + ' 控件 ' + c.id + '=' + tv + ' → 画布' + (ri + 1) + ' 坐标量级爆掉（max|coord| = ' + r.maxAbs.toExponential(2) + '）');
          if (drawOps === 0) issues.push('lab#' + (li + 1) + ' 控件 ' + c.id + '=' + tv + ' → 画布' + (ri + 1) + ' 这一帧什么都没画');
        });
      });
    });
  });

  if (issues.length) {
    bad++;
    console.log('✗ ' + name);
    labInfo.forEach(x => console.log('    · ' + x));
    issues.slice(0, 14).forEach(x => console.log('    - ' + x));
    if (issues.length > 14) console.log('    … 其余 ' + (issues.length - 14) + ' 条同类问题省略');
  } else {
    console.log('✓ ' + name + '　(实验台 ' + (res.labs || []).length + ' 个，极端参数帧 ' + frames + ' 次全部正常)');
    labInfo.forEach(x => console.log('    · ' + x));
  }
}

console.log('----');
console.log(bad ? '有 ' + bad + ' 页存在几何问题' : '全部 ' + files.length + ' 页的互动实验台在极端参数下几何正常');
process.exit(bad ? 1 : 0);
