#!/usr/bin/env node
// Minimal importer: PDF -> text -> parse -> QA.json
// Heuristics assume questions like "1. ..." and options like "A) ..."
// Answer key section headed by "Answer Key" or similar; answers lines like "1. Answer: B" or "1) B".

import fs from 'fs';
import path from 'path';
// Import internal implementation to avoid debug code in pdf-parse index.js
import pdf from 'pdf-parse/lib/pdf-parse.js';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pdfPath = process.argv[2] || path.join(projectRoot, 'QuestionAnswers', '1 (2).pdf');
const outPath = path.join(projectRoot, 'QuestionAnswers', 'QA.json');

function clean(s) {
  return String(s || '')
    .replace(/[\r\t]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}

function splitQuestionsAndAnswers(text) {
  // Try to split around common headings
  const markers = [
    /\n\s*Answer Key\s*(?:&\s*Rationale)?\s*\n/i,
    /\n\s*Answers\s*(?:and\s*Rationales)?\s*\n/i,
    /\n\s*Answer\s*Section\s*\n/i
  ];
  for (const re of markers) {
    const parts = text.split(re);
    if (parts.length === 2 && parts[0].length > 200 && parts[1].length > 10) {
      return { questionsBlock: parts[0], answersBlock: parts[1] };
    }
  }
  // If cannot split, treat entire text as questions block (answers may be inline or absent)
  return { questionsBlock: text, answersBlock: '' };
}

function parseAnswers(answersBlock) {
  const map = new Map();
  if (!answersBlock) return map;

  // Support patterns:
  // 1. Answer: B, D. Rationale ...
  // 1) B
  // 1 - B
  const patterns = [
    /(\n|^)\s*(\d+)\.?\)?\s*Answer\s*[:\-]\s*([A-E](?:\s*,\s*[A-E])*)/gim,
    /(\n|^)\s*(\d+)\s*[\)\.-]\s*([A-E](?:\s*,\s*[A-E])*)/gim
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(answersBlock)) !== null) {
      const qn = Number(m[2]);
      const letters = m[3].split(/\s*,\s*/).map(x => x.trim().toUpperCase());
      map.set(qn, letters);
    }
  }
  return map;
}

function parseQuestions(questionsBlock) {
  const lines = questionsBlock.split(/\n/).map(clean);
  const qStart = /^(\d+)\.?\s+(.*)$/;
  const opt = /^([A-E])[\)\.]\s+(.*)$/;

  const items = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(qStart);
    if (!m) { i++; continue; }
    const id = Number(m[1]);
    let qtext = m[2];
    const options = [];
    i++;
    while (i < lines.length) {
      const lm = lines[i].match(opt);
      if (lm) {
        options.push(clean(lm[2]));
        i++;
        continue;
      }
      // Stop when next question starts
      if (qStart.test(lines[i])) break;
      // Append stray text to question
      if (lines[i]) qtext += ' ' + lines[i];
      i++;
    }
    items.push({ id, question_text: clean(qtext), options });
  }
  return items;
}

async function main() {
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }
  const dataBuffer = fs.readFileSync(pdfPath);
  const result = await pdf(dataBuffer);
  const rawText = result.text || '';
  const text = rawText.replace(/\r/g, '');

  const { questionsBlock, answersBlock } = splitQuestionsAndAnswers(text);
  const answerMap = parseAnswers(answersBlock);
  const questions = parseQuestions(questionsBlock);

  // Attach correct_answer by matching letter to option text if possible
  const KEY_ORDER = ['A','B','C','D','E'];
  const enriched = questions.map(q => {
    const letters = answerMap.get(q.id) || [];
    let correct_answer = '';
    if (letters.length === 1) {
      const idx = KEY_ORDER.indexOf(letters[0]);
      if (idx >= 0 && q.options[idx]) correct_answer = q.options[idx];
    }
    return { ...q, correct_answer };
  });

  // Backup
  if (fs.existsSync(outPath)) {
    const backup = outPath.replace(/\.json$/, `.backup.${Date.now()}.json`);
    fs.copyFileSync(outPath, backup);
    console.log(`Backed up existing QA.json -> ${backup}`);
  }

  const payload = { exam_questions_set_1: enriched };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${enriched.length} questions to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
