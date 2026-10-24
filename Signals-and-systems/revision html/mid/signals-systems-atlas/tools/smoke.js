#!/usr/bin/env node
/**
 * smoke.js —— 页面冒烟测试（用桩 DOM 真正执行页面内联脚本）
 * 目的：在没有浏览器的环境里抓出 "元素 id 打错 / 运行时异常 / 初始化崩溃"。
 * 几何/极端参数检查在 render.js 里做，这里只管"能不能跑起来"。
 *
 * 用法：
 *     node tools/smoke.js                 # 测试所有 html
 *     node tools/smoke.js ch06-ctft.html  # 只测指定页
 * 退出码：0 = 全部通过
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { runPage, ROOT } = require('./domstub');

const args = process.argv.slice(2);
const files = args.length
  ? args.map(a => path.resolve(ROOT, a))
  : fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort().map(f => path.join(ROOT, f));

let bad = 0;
for (const f of files) {
  const name = path.basename(f);
  const { problems, ids, missing, labs } = runPage(f, { record: false, wrapLab: false });
  let flagged = false;
  if (problems.length) {
    flagged = true;
    console.log('✗ ' + name);
    problems.forEach(p => console.log('    - ' + p));
  }
  if (missing.length) {
    flagged = true;
    console.log((problems.length ? '  ' : '✗ ' + name + '\n') + '    ⚠ 脚本请求了页面中不存在的 id: ' + missing.join(', '));
  }
  if (!flagged) console.log('✓ ' + name + '  (页面内 id: ' + ids.size + '，脚本执行无异常)');
  if (flagged) bad++;
}
console.log('----');
console.log('通过 ' + (files.length - bad) + ' / ' + files.length);
process.exit(bad ? 1 : 0);
