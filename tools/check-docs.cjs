#!/usr/bin/env node
/**
 * Docs integrity check: runs in CI (quality job) to keep the documentation
 * tree from rotting — verifies code-fence balance, mermaid block sanity and
 * that every relative markdown link resolves to an existing file.
 * Usage: node tools/check-docs.cjs [docsDir...]   (default: docs)
 */
const fs = require('fs');
const path = require('path');

const roots = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['docs'];
let files = [];
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    files.push(root);
    continue;
  }
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) files.push(full);
    }
  };
  walk(root);
}

let issues = 0;
const fail = (file, msg) => {
  console.error(`${file}: ${msg}`);
  issues += 1;
};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  // 1. Code fences must be balanced
  const fences = (content.match(/^```/gm) || []).length;
  if (fences % 2 !== 0) fail(file, `unbalanced code fences (${fences})`);

  // 2. Mermaid blocks: known diagram type + common syntax slips
  for (const block of content.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
    const first = (block[1].split('\n').find(l => l.trim()) || '').trim();
    if (!/^(flowchart|sequenceDiagram|erDiagram|stateDiagram-v2|graph|classDiagram|journey|mindmap|timeline|gitGraph|pie|gantt|quadrantChart|requirementDiagram|C4Context)/.test(first)) {
      fail(file, `unknown mermaid diagram type: "${first}"`);
    }
    for (const line of block[1].split('\n')) {
      if (/"\|"/.test(line)) fail(file, `quote-pipe-quote slip: ${line.trim()}`);
      const quotes = (line.match(/"/g) || []).length;
      if (/(-->|-\.->|==)/.test(line) && quotes % 2 !== 0) {
        fail(file, `odd number of quotes on edge line: ${line.trim()}`);
      }
      if (/-->|-\.-->/.test(line) && (line.match(/\[/g) || []).length !== (line.match(/\]/g) || []).length) {
        fail(file, `bracket mismatch on edge line: ${line.trim()}`);
      }
    }
  }

  // 3. Relative markdown links must resolve
  for (const link of content.matchAll(/\]\(([^)#]+?)(?:#[^)]*)?\)/g)) {
    const target = link[1];
    if (/^[a-z]+:\/\//i.test(target) || target.startsWith('mailto:')) continue; // absolute URL
    if (!target.endsWith('.md')) continue; // anchors/non-markdown targets are out of scope
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
    if (!fs.existsSync(resolved)) fail(file, `broken link -> ${target}`);
  }
}

console.log(`${files.length} markdown file(s) checked, ${issues} issue(s)`);
process.exit(issues > 0 ? 1 : 0);
