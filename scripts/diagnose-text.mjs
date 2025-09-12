#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const inPath = process.argv[2] || path.join(projectRoot, 'QuestionAnswers', '1 (2).txt');

function normalizeWhitespace(s) {
  return String(s || '')
    .replace(/\u000c/g, '\n')
    .replace(/[\r\t]+/g, ' ')
    .replace(/[ \u00A0]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/ +/g, ' ')
    .trim();
}

function preprocess(text) {
  const t = normalizeWhitespace(text);
  const lines = t.split(/\n/);
  const cleaned = [];
  for (let raw of lines) {
    let line = raw.trim();
    line = line.replace(/^\d{1,6}[\-:]\s*/, '');
    if (!line) { cleaned.push(''); continue; }
    if (/^Page \d+ of \d+$/i.test(line)) continue;
    if (/^STATE EXAMS\s+\d+/i.test(line)) continue;
    if (/^TABLE OF CONTENTS$/i.test(line)) continue;
    if (/^QUESTIONS$/i.test(line)) continue;
    if (/^PAGES$/i.test(line)) continue;
    cleaned.push(line);
  }
  return cleaned.join('\n');
}

if (!fs.existsSync(inPath)) {
  console.error('Missing', inPath);
  process.exit(1);
}
const raw = fs.readFileSync(inPath, 'utf8');
const pre = preprocess(raw);
const lines = pre.split(/\n/);
const qStartFull = /^(\d+)\.?\s+(.*)$/;
const qStartBare = /^(\d+)\.?\s*$/;
let full = 0, bare = 0;
for (const line of lines) {
  if (qStartFull.test(line)) full++;
  else if (qStartBare.test(line)) bare++;
}
console.log(JSON.stringify({ full, bare, total: full + bare }, null, 2));
