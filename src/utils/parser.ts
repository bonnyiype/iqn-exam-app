import { ExamData, Question, Choice, ChoiceKey, ParseError } from '../types';

export function cleanLine(s: string): string {
  return s.replace(/\r/g, "").trim();
}

export function parseMock(input: string): { exam: ExamData; errors: ParseError[] } {
  const errors: ParseError[] = [];
  const text = input.replace(/\t/g, "  ");
  const split = text.split(/\n\s*Answer Key\s*&\s*Rationale\s*\n/i);
  const questionsBlockRaw = split[0];
  const answersBlockRaw = split[1];
  
  if (!questionsBlockRaw || !answersBlockRaw) {
    throw new Error("Couldn't locate 'Answer Key & Rationale'. Make sure your text includes that heading.");
  }

  const titleMatch = questionsBlockRaw.match(/^\s*(.+?)\n\n/);
  const title = titleMatch ? cleanLine(titleMatch[1]) : "IQN Mock Test";

  // Parse Answer section
  const answersBlock = answersBlockRaw.replace(/\u00A0/g, " ");
  const answerRegex = /\n\s*(\d+)\.?\s*Answer:\s*([A-E](?:\s*,\s*[A-E])*)\.?\s*(.*?)(?=\n\s*\d+\.?\s*Answer:|\Z)/gis;
  const answerMap: Record<number, { correct: ChoiceKey[]; rationale: string }> = {};
  let m: RegExpExecArray | null;
  
  while ((m = answerRegex.exec(answersBlock)) !== null) {
    const qn = Number(m[1]);
    const correct = m[2]
      .split(/\s*,\s*/)
      .map((x) => x.trim().toUpperCase() as ChoiceKey);
    const rationale = cleanLine(m[3] || "");
    answerMap[qn] = { correct, rationale };
  }

  // Parse questions and choices
  const qLines = questionsBlockRaw.split(/\n/);
  const questions: Question[] = [];
  let i = 0;
  const qStart = /^(\d+)\.\s*(.*)$/;
  const optRe = /^([A-E])\)\s*(.*)$/;
  
  while (i < qLines.length) {
    const line = cleanLine(qLines[i]);
    const qm = line.match(qStart);
    
    if (qm) {
      const qn = Number(qm[1]);
      let qtext = qm[2].trim();
      const multi = /select\s*all\s*that\s*apply/i.test(qtext) || /\(\s*Select.*Apply\s*\)/i.test(qtext);
      const choices: Choice[] = [];
      i++;
      
      while (i < qLines.length) {
        const l2 = cleanLine(qLines[i]);
        const om = l2.match(optRe);
        
        if (om) {
          choices.push({ key: om[1] as ChoiceKey, text: om[2].trim() });
          i++;
          continue;
        }
        
        if (qStart.test(l2) || /Answer Key\s*&\s*Rationale/i.test(l2)) break;
        if (l2) qtext += " " + l2;
        i++;
      }
      
      const meta = answerMap[qn];
      if (!meta) {
        errors.push({
          message: `Question ${qn} has no corresponding answer in the Answer Key`,
          type: 'warning'
        });
      }
      
      questions.push({
        id: qn,
        text: qtext.trim(),
        multi,
        choices,
        correct: meta?.correct || [],
        rationale: meta?.rationale || ""
      });
      continue;
    }
    i++;
  }

  if (!questions.length) {
    throw new Error("No questions found. Each question must start with `1.`, `2.`, etc., and choices as `A)`, `B)`, ...");
  }

  // Detect categories from question text
  const categories = detectCategories(questions);

  return {
    exam: {
      title,
      questions,
      categories,
      createdAt: new Date().toISOString(),
      version: "2.0"
    },
    errors
  };
}

function detectCategories(questions: Question[]): string[] {
  const categoryKeywords = {
    'Respiratory': ['respiratory', 'copd', 'oxygen', 'breath', 'lung', 'airway', 'ventilat'],
    'Cardiovascular': ['cardiac', 'heart', 'blood pressure', 'arrhythm', 'ecg', 'coronary'],
    'Gastrointestinal': ['gastro', 'liver', 'bowel', 'digest', 'abdom', 'intestin'],
    'Neurological': ['neuro', 'brain', 'stroke', 'seizure', 'consciousness', 'mental status'],
    'Pharmacology': ['medication', 'drug', 'dose', 'prescription', 'inhaler'],
    'Infectious Disease': ['infection', 'tuberculosis', 'tb', 'isolation', 'precaution'],
    'Nutrition': ['diet', 'nutrition', 'food', 'meal', 'calorie'],
    'Patient Safety': ['safety', 'fall', 'error', 'alarm', 'emergency']
  };

  const detectedCategories = new Set<string>();

  questions.forEach(q => {
    const text = q.text.toLowerCase();
    Object.entries(categoryKeywords).forEach(([category, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        detectedCategories.add(category);
        if (!q.category) q.category = category;
      }
    });
  });

  return Array.from(detectedCategories);
}
