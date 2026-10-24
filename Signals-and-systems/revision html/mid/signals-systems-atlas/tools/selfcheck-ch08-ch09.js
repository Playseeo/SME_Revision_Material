#!/usr/bin/env node
/**
 * 数值自检：把 ch08 / ch09 页面里**真正写进实验台的函数**抠出来，在 Node 下跑一遍，
 * 确认页面上显示的数字/公式是对的（而不是"看着像对"）。
 *
 * 用法：node tools/selfcheck-ch08-ch09.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SSC = require(path.join(ROOT, 'assets', 'ssc.js'));

/* 从页面里抠出两个锚点之间的源码，然后在 Node 里 eval —— 这样"测的就是页面里的代码" */
function grab(src, startAnchor, endAnchor, label) {
  const i = src.indexOf(startAnchor);
  if (i < 0) throw new Error('找不到起始锚点: ' + label);
  const j = src.indexOf(endAnchor, i);
  if (j < 0) throw new Error('找不到结束锚点: ' + label);
  return src.slice(i, j);
}

const h8 = fs.readFileSync(path.join(ROOT, 'ch08-dft.html'), 'utf8');
const h9 = fs.readFileSync(path.join(ROOT, 'ch09-sampling.html'), 'utf8');

let fails = 0;
function ok(cond, msg, detail) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + msg + (detail ? '   [' + detail + ']' : ''));
  if (!cond) fails++;
}

/* ==================== ch08 ==================== */
console.log('\n=== ch08-dft.html ===');

const code8 = grab(h8, 'function dtftMagAt', '/* ================= 实验 1', 'ch08 helpers');
const ctx8 = { Math: Math, SSC: SSC };
vm.createContext(ctx8);
vm.runInContext(code8, ctx8, { filename: 'ch08-helpers.js' });
const { dtftMagAt, circConv, fitN, makeSeq } = ctx8;

/* 1) 页面自备的 dtftMagAt 必须与内核 dft 在等间隔频点上一致 */
{
  const x = makeSeq(8);
  let worst = 0;
  const X = SSC.dft(fitN(x, 8));
  for (let k = 0; k < 8; k++) {
    worst = Math.max(worst, Math.abs(dtftMagAt(x, 2 * Math.PI * k / 8) - SSC.cabs(X[k])));
  }
  ok(worst < 1e-12, '实验 1：|X[k]| = |DTFT(2πk/N)|（DFT 是 DTFT 的等间隔采样）', 'max|Δ| = ' + worst.toExponential(2));
}

/* 2) 补零：DFT 点变密，但落在同一条 DTFT 上 */
{
  const base = makeSeq(4);
  const X8 = SSC.dft(fitN(base, 8));
  let worst = 0;
  for (let k = 0; k < 8; k++) {
    worst = Math.max(worst, Math.abs(SSC.cabs(X8[k]) - dtftMagAt(base, 2 * Math.PI * k / 8)));
  }
  ok(worst < 1e-12, '实验 1：补零到 8 点的 DFT 仍落在 4 点序列的 DTFT 上', 'max|Δ| = ' + worst.toExponential(2));
}

/* 3) 循环卷积：N ≥ N1+N2−1 时必须等于线性卷积 */
{
  const x = [1, 2, 3, 1], h = [1, -1, 1];
  const lin = SSC.convSeq(x, h);
  const L = lin.length;                                  /* 6 */
  ok(L === 6, '实验 2：线性卷积长度 N₁+N₂−1 = 6', 'lin = [' + lin.join(', ') + ']');

  const c6 = circConv(fitN(x, 6), fitN(h, 6), 6);
  let d6 = 0;
  for (let i = 0; i < 6; i++) d6 = Math.max(d6, Math.abs(c6[i] - lin[i]));
  ok(d6 < 1e-12, '实验 2：N=6 ≥ L ⟹ 循环卷积 == 线性卷积', 'max|Δ| = ' + d6.toExponential(2));

  const c4 = circConv(fitN(x, 4), fitN(h, 4), 4);
  ok(Math.abs(c4[0] - lin[0]) > 1e-9, '实验 2：N=4 < L ⟹ 循环卷积 ≠ 线性卷积（时域混叠）',
    'N=4 循环 = [' + c4.join(', ') + ']');

  /* 混叠的"尾巴"应当正好等于把 n≥N 的线性卷积值加到 n−N 上 */
  let aliasOk = true;
  const expect = lin.slice(0, 4).slice();
  for (let i = 4; i < lin.length; i++) expect[i - 4] += lin[i];
  for (let i = 0; i < 4; i++) if (Math.abs(expect[i] - c4[i]) > 1e-12) aliasOk = false;
  ok(aliasOk, '实验 2：N=4 时循环卷积 == 线性卷积尾部回绕叠加', '[' + expect.join(', ') + '] vs [' + c4.join(', ') + ']');
}

/* 4) 内核 fft 与 dft 一致（页面上用来断言的结论） */
{
  let worst = 0;
  [4, 8, 16, 32, 64].forEach(N => {
    const x = makeSeq(N).map((v, i) => v + 0.3 * Math.sin(i));
    const D = SSC.dft(x), F = SSC.fft(x);
    for (let k = 0; k < N; k++) {
      worst = Math.max(worst, Math.abs(D[k].re - F[k].re), Math.abs(D[k].im - F[k].im));
    }
  });
  ok(worst < 1e-10, 'FFT == DFT（N=4…64，逐位一致，仅浮点噪声）', 'max|Δ| = ' + worst.toExponential(2));
}

/* 5) idft 往返 */
{
  const x = makeSeq(16), y = SSC.idft(SSC.dft(x));
  let worst = 0;
  for (let i = 0; i < x.length; i++) worst = Math.max(worst, Math.abs(x[i] - y[i].re));
  ok(worst < 1e-12, 'idft(dft(x)) == x', 'max|Δ| = ' + worst.toExponential(2));
}

/* 6) FFT 计数（页面对照表里的数字） */
{
  const cases = [[64, 4096, 192], [1024, 1048576, 5120], [4096, 16777216, 24576]];
  let allOk = true, desc = [];
  cases.forEach(([N, n2, nlogn]) => {
    const real = (N / 2) * Math.log2(N);
    if (Math.pow(N, 2) !== n2 || real !== nlogn) allOk = false;
    desc.push('N=' + N + ': N²=' + n2 + ', (N/2)log₂N=' + real.toFixed(0));
  });
  ok(allOk, '第 10 节数量级对照表数字正确', desc.join(' | '));
}

/* ==================== ch09 ==================== */
console.log('\n=== ch09-sampling.html ===');

const code9 = grab(h9, 'function foldFreq', '/* ================= 实验 1', 'ch09 helpers');
const ctx9 = { Math: Math, SSC: SSC };
vm.createContext(ctx9);
vm.runInContext(code9, ctx9, { filename: 'ch09-helpers.js' });
const { foldFreq, foldFreqBrute, sampleSeq, interpAt } = ctx9;

/* 1) 折叠算法 == min_k |f − k·fs|（暴力核对） */
{
  let worst = 0, worstCase = '';
  for (let f = 0.5; f <= 20; f += 0.5) {
    for (let fsx = 1; fsx <= 40; fsx += 0.5) {
      const a = foldFreq(f, fsx).app, b = foldFreqBrute(f, fsx);
      if (Math.abs(a - b) > worst) { worst = Math.abs(a - b); worstCase = 'f=' + f + ', fs=' + fsx; }
    }
  }
  ok(worst < 1e-9, '实验 1/2：表观频率 == min_k |f − k·f_s|（扫遍 f∈[0.5,20], f_s∈[1,40]）',
    'max|Δ| = ' + worst.toExponential(2) + (worstCase ? ' @ ' + worstCase : ''));
}

/* 2) 教材里的五个手算例子 */
{
  const cases = [[3, 10, 3], [7, 10, 3], [13, 10, 3], [1.1, 1, 0.1], [2, 1, 0]];
  let allOk = true, desc = [];
  cases.forEach(([f, fsx, want]) => {
    const got = foldFreqBrute(f, fsx);
    if (Math.abs(got - want) > 1e-9) allOk = false;
    desc.push(f + 'Hz/' + fsx + 'Hz→' + got.toFixed(3) + '(期望' + want + ')');
  });
  ok(allOk, '第 7 节表格：5 个混叠例子全部正确', desc.join(' '));
}

/* 3) 7 Hz 与 13 Hz 在 fs=10 Hz 下采样序列完全相同（无法区分） */
{
  let same = true;
  for (let n = 0; n < 40; n++) {
    const a = Math.cos(2 * Math.PI * 7 * n / 10), b = Math.cos(2 * Math.PI * 13 * n / 10);
    if (Math.abs(a - b) > 1e-12) same = false;
  }
  ok(same, '7 Hz 与 13 Hz 在 f_s=10 Hz 下的样本逐点相同（混叠不可逆）');
}

/* 4) 时域判定：满足定理 ⟹ 重建≈原信号；不满足 ⟹ 重建精确过样本但整体跑偏
      —— 这里用与页面实验 3 **完全相同的样本范围/截断阈值**（MAXSIDE=330, GUARD=300） */
{
  const MAXSIDE = 330, GUARD = 300, MPTS = 700;
  function labRecon(f, fsx, nPer) {
    const half = nPer / (2 * f);
    const win = Math.ceil(half * fsx);
    const need = Math.max(Math.min(MAXSIDE, win + 20), Math.min(MAXSIDE, GUARD / 1.5));
    const n0 = -Math.max(need, 12), n1 = Math.max(need, 12);
    const s = sampleSeq(f, fsx, n0, n1, 0);
    let err = 0;
    for (let i = Math.round(0.05 * MPTS); i <= Math.round(0.95 * MPTS); i++) {
      const t = -half + 2 * half * i / MPTS;
      err = Math.max(err, Math.abs(interpAt(s, fsx, n0, t, GUARD) - Math.cos(2 * Math.PI * f * t)));
    }
    return err;
  }

  /* 扫遍 f、f_s 滑块的全部取值，只要满足定理，误差就必须很小 */
  let worst = 0, worstCase = '';
  for (let f = 1; f <= 6; f += 0.5) {
    for (let fsx = 1.5; fsx <= 30; fsx += 0.5) {
      if (fsx < 2 * f) continue;
      const e = labRecon(f, fsx, 3);
      if (e > worst) { worst = e; worstCase = 'f=' + f + ', f_s=' + fsx; }
    }
  }
  ok(worst < 0.02, '实验 3：满足 f_s ≥ 2f 时重建误差极小（扫遍两滑块全部取值）',
    'max err = ' + worst.toExponential(2) + ' @ ' + worstCase);

  const eBad = labRecon(2, 3, 3);
  ok(eBad > 1.0, '实验 3：f=2Hz, f_s=3Hz（不满足定理）重建彻底跑偏', 'err = ' + eBad.toFixed(3));
  const eEdge = labRecon(2, 1.5, 3);
  ok(eEdge > 1.0, '实验 3：f=2Hz, f_s=1.5Hz 重建同样跑偏', 'err = ' + eEdge.toFixed(3));

  /* 重建曲线一定精确穿过每个样本点（内插公式的必然） */
  const fsx = 3, f = 2, n0 = -30, n1 = 30;
  const s = sampleSeq(f, fsx, n0, n1, 0);
  let worstAtSamples = 0;
  for (let n = -10; n <= 10; n++) {
    worstAtSamples = Math.max(worstAtSamples,
      Math.abs(interpAt(s, fsx, n0, n / fsx, GUARD) - Math.cos(2 * Math.PI * f * n / fsx)));
  }
  ok(worstAtSamples < 1e-6, '实验 3：欠采样时重建曲线仍精确穿过每一个样本点',
    'max|Δ|@样本点 = ' + worstAtSamples.toExponential(2));
}

/* 5) 抽取：频谱展宽 N 倍 + 混叠判定（复现实验 4 的读数） */
{
  /* 页面实验 4 用的是 512 个格点画 [0,fs/2]=[0,8] Hz，所以峰只能落在 f_s/(2·256)=1/32 Hz 的格上；
     这里用 4096 格（16 倍细）来核对"真值"，避免把画图分辨率当成算法误差。 */
  function peakHz(seq, fsx, M) {
    let best = 0, bi = 0;
    for (let m = 1; m < M / 2; m++) {
      const Om = 2 * Math.PI * m / M;
      let re = 0, im = 0;
      for (let n = 0; n < seq.length; n++) { re += seq[n] * Math.cos(Om * n); im -= seq[n] * Math.sin(Om * n); }
      const mag = Math.hypot(re, im);
      if (mag > best) { best = mag; bi = m; }
    }
    return bi * fsx / M;
  }
  const FS = 16, LEN = 16, M = 4096, f2 = 2;
  const x = [];
  for (let n = 0; n < LEN; n++) x.push(Math.cos(2 * Math.PI * f2 * n / FS));
  const pk0 = peakHz(x, FS, M);
  /* 只有 16 个样本 ⇒ 频谱被 Dirichlet 核卷过，主瓣宽约 2fs/L = 2 Hz，
     所以峰位会偏离真值约 0.06 Hz（这正是"观测太短导致分辨差"的真实物理现象，不是算法错误）。
     峰位必须落在真值附近、且主瓣里必须包含真值。 */
  ok(Math.abs(pk0 - f2) < 0.1, '实验 4：原序列（f=2Hz, fs=16Hz，只观测 16 点）谱峰落在 2 Hz 附近',
    pk0.toFixed(4) + ' Hz（短时观测的主瓣偏移，主瓣宽 ≈ 2f_s/L = ' + (2 * FS / LEN) + ' Hz）');

  for (const N of [2, 4]) {
    const xd = [];
    for (let n = 0; n < LEN; n += N) xd.push(x[n]);
    const fsx2 = FS / N;
    const pk = peakHz(xd, fsx2, M);
    ok(Math.abs(pk - f2) < 0.02, '实验 4：抽取 ' + N + ' 倍后峰位置不变（同一数字频率对应更低 Hz）',
      pk.toFixed(4) + ' Hz（新 fs=' + fsx2 + '，新奈奎斯特 ' + fsx2 / 2 + ' Hz）');
  }

  /* 7 Hz + 抽取 4 倍 ⟹ 混叠到 1 Hz */
  const f7 = 7, N4 = 4, fsn = FS / N4;
  const x7 = [], xd7 = [];
  for (let n = 0; n < 64; n++) x7.push(Math.cos(2 * Math.PI * f7 * n / FS));
  for (let n = 0; n < 64; n += N4) xd7.push(x7[n]);
  const pk7 = peakHz(xd7, fsn, 4096);
  const fold7 = foldFreqBrute(f7, fsn);
  ok(Math.abs(pk7 - 1) < 0.05 && Math.abs(fold7 - 1) < 1e-9,
    '实验 4：7 Hz 在 16 Hz 下抽取 4 倍（新 fs=4Hz，新奈奎斯特 2Hz）→ 混叠到 1 Hz',
    '谱峰 ' + pk7.toFixed(3) + ' Hz，公式 |7−k·4| 最小 = ' + fold7);
}

/* 6) C/D 频率换算：ω_s → 2π，ω_s/2 → π */
{
  const fsc = 16, T = 1 / fsc;
  const ws = 2 * Math.PI / T;
  ok(Math.abs(ws * T - 2 * Math.PI) < 1e-12 && Math.abs((ws / 2) * T - Math.PI) < 1e-12,
    '第 10 节：Ω = ωT 把 ω_s 映到 2π、ω_s/2 映到 π');
}

console.log('\n----');
console.log(fails ? '数值自检发现 ' + fails + ' 处问题' : '数值自检全部通过');
process.exit(fails ? 1 : 0);
