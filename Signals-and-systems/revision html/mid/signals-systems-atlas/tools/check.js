#!/usr/bin/env node
/**
 * check_pages.py 的 Node 等价版：静态自检
 *   1) 内联脚本语法（node --check 等价：vm.Script 编译）
 *   2) 每个页面必须有：data-page、本站位置(position)、pager、至少 1 个 lab、至少 1 个 quiz
 *   3) 链接可达性：所有本站 .html 链接必须存在
 *   4) 禁止外部资源（http/https/CDN），保证离线可用
 *   5) ssc.js 中 PAGES 的每个 href 都必须存在；存在的页面必须在 PAGES 里
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ssc = fs.readFileSync(path.join(ROOT, 'assets', 'ssc.js'), 'utf8');
const pages = [...ssc.matchAll(/href:\s*'([^']+\.html)'/g)].map(m => m[1]);
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

let bad = 0;
function fail(msg) { bad++; console.log('  ✗ ' + msg); }

for (const href of pages) if (!fs.existsSync(path.join(ROOT, href))) fail('ssc.js 里的 ' + href + ' 不存在');
for (const f of files) if (!pages.includes(f)) fail(f + ' 没有登记进 ssc.js 的 PAGES（侧栏与翻页会漏掉它）');

for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const issues = [];
  if (!/data-page="[^"]+"/.test(html)) issues.push('缺 data-page');
  if (!/class="position"/.test(html)) issues.push('缺 本站位置(position)');
  if (!/id="pager"/.test(html)) issues.push('缺 pager');
  if (f !== 'index.html' && !/SSC\.lab\(/.test(html)) issues.push('没有任何互动实验台 SSC.lab');
  if (!/SSC\.quiz\(/.test(html)) issues.push('没有自测 SSC.quiz');
  if (/(src|href)="https?:\/\//.test(html)) issues.push('引用了外部资源（离线会失效）');

  // 内联脚本语法
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  blocks.forEach((code, i) => {
    try { new vm.Script(code, { filename: f + '#' + (i + 1) }); }
    catch (e) { issues.push('内联脚本语法错误 #' + (i + 1) + ': ' + e.message); }
  });

  // 站内链接
  const links = new Set([...html.matchAll(/href="([^"#][^"]*\.html)(#[^"]*)?"/g)].map(m => m[1]));
  links.forEach(l => { if (!fs.existsSync(path.join(ROOT, l))) issues.push('死链: ' + l); });

  if (issues.length) { bad++; console.log('✗ ' + f); issues.forEach(x => console.log('    - ' + x)); }
  else console.log('✓ ' + f);
}
console.log('----');
console.log(bad ? '发现 ' + bad + ' 处问题' : '静态自检全部通过（' + files.length + ' 页）');
process.exit(bad ? 1 : 0);
