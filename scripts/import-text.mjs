#!/usr/bin/env node
// TXT -> QA.json importer for IQN app
// Assumes question lines like `1.` then options like `a)`, `b)`, `c)`, `d)` possibly lowercase
// Handles page artifacts like "Page X of Y" and spurious formfeeds.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const inPath = process.argv[2] || path.join(projectRoot, 'QuestionAnswers', '1 (2).txt');
const outPath = path.join(projectRoot, 'QuestionAnswers', 'QA.json');

function normalizeWhitespace(s) {
  return String(s || '')
    .replace(/\u000c/g, '\n') // formfeed -> newline
    .replace(/[\r\t]+/g, ' ')
    .replace(/[ \u00A0]+/g, ' ') // nbsp -> space
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
    // Strip leading line-number prefixes produced by some PDF-to-text tools (e.g., "8875:" or "662-")
    line = line.replace(/^\d{1,6}[\-:]\s*/, '');
    if (!line) { cleaned.push(''); continue; }
    // Remove page markers like "Page 2 of 257" or "STATE EXAMS 21" headings
    if (/^Page \d+ of \d+$/i.test(line)) continue;
    if (/^STATE EXAMS\s+\d+/i.test(line)) continue;
    if (/^TABLE OF CONTENTS$/i.test(line)) continue;
    if (/^QUESTIONS$/i.test(line)) continue;
    if (/^PAGES$/i.test(line)) continue;
    cleaned.push(line);
  }
  return cleaned.join('\n');
}

function parseQuestions(text) {
  const lines = text.split(/\n/);
  const qStartFull = /^(\d+)\.?\s+(.*)$/; // 12. Question text
  const qStartBare = /^(\d+)\.?\s*$/; // 12. (with no trailing text)
  const opt = /^([A-Ea-e])[\)\.:\-]?\s*(.*)$/; // a) Option text (punctuation optional)

  const items = [];
  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i].trim();
    const mFull = rawLine.match(qStartFull);
    const mBare = mFull ? null : rawLine.match(qStartBare);
    if (!mFull && !mBare) { i++; continue; }

    // Build question text
    let qtext = '';
    if (mFull) {
      let qTail = mFull[2].trim();
      // Detect inline start of options like "... question text a) first option ..."
      const inlineOpt = /\b[Aa][\)\.]\s+/.exec(qTail);
      if (inlineOpt && typeof inlineOpt.index === 'number') {
        const idx = inlineOpt.index;
        const rest = qTail.slice(idx).trim();
        qtext = qTail.slice(0, idx).trim();
        if (rest) {
          // Insert the rest back as a new line so the option parser can handle it
          lines.splice(i + 1, 0, rest);
        }
      } else {
        qtext = qTail;
      }
    } else {
      // Bare number line: accumulate subsequent non-empty, non-option, non-question lines as question text
      qtext = '';
    }

    const options = [];
    i++;

    // If we had a bare question number, collect question stem lines until an option or next question starts
    if (mBare) {
      while (i < lines.length) {
        const s = lines[i].trim();
        if (!s) { i++; continue; }
        if (qStartFull.test(s) || qStartBare.test(s) || opt.test(s)) break;
        qtext += (qtext ? ' ' : '') + s;
        i++;
      }
    }

    while (i < lines.length) {
      const s = lines[i].trim();
      const om = s.match(opt);
      if (om) {
        const key = om[1].toUpperCase();
        let val = (om[2] || '').trim();
        // Options may wrap onto multiple lines until next option or next question
        let j = i + 1;
        while (j < lines.length) {
          const next = lines[j].trim();
          if (!next) { j++; continue; }
          if (qStartFull.test(next) || qStartBare.test(next) || opt.test(next)) break;
          // Avoid stray section/page markers already filtered
          val += ' ' + next;
          j++;
        }
        options.push({ key, text: val });
        i = j;
        continue;
      }

      // Stop block if a new question starts
      if (qStartFull.test(s) || qStartBare.test(s)) break;

      // Otherwise, append to question stem
      if (s) qtext += ' ' + s;
      i++;
    }

    let optionTexts = options.map(o => o.text);

    // Aggressive fallback: if not enough options, and env flag is set, infer last 3-4 lines as options
    if (optionTexts.length < 2 && process.env.AGGRESSIVE === '1') {
      const lookahead = [];
      let j = i;
      while (j < lines.length && lookahead.length < 12) {
        const s = lines[j].trim();
        if (qStartFull.test(s) || qStartBare.test(s)) break;
        if (s) lookahead.push(s);
        j++;
      }
      const candidates = lookahead.slice(-4);
      if (candidates.length >= 3) {
        optionTexts = candidates;
      }
    }
    // Assign sequential unique IDs to avoid collisions across sections
    const seqId = items.length + 1;
    if (qtext && qtext.length > 5 && optionTexts.length >= 2) {
      items.push({ id: seqId, question_text: qtext, options: optionTexts, correct_answer: '' });
    }
  }

  return items;
}

function writeOutput(items) {
  const payload = { exam_questions_set_1: items };
  // Backup existing
  if (fs.existsSync(outPath)) {
    const backup = outPath.replace(/\.json$/, `.backup.${Date.now()}.json`);
    fs.copyFileSync(outPath, backup);
    console.log(`Backed up existing QA.json -> ${backup}`);
  }
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${items.length} questions to ${outPath}`);
}

async function main() {
  if (!fs.existsSync(inPath)) {
    console.error(`Input TXT not found: ${inPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(inPath, 'utf8');
  const pre = preprocess(raw);
  const items = parseQuestions(pre);

  // Basic sanity: filter out items without any options or absurdly short text
  const filtered = items.filter(it => it.question_text && it.question_text.length > 10 && it.options.length >= 2);
  writeOutput(filtered);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
