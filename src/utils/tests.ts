import { parseMock } from './parser';
import { calcSummary } from './helpers';
import { SAMPLE_TEXT } from './sampleData';

type TestCase = { 
  name: string; 
  run: () => void;
};

class Assert {
  static equal(actual: any, expected: any, msg?: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }
  
  static ok(cond: any, msg?: string) {
    if (!cond) throw new Error(msg || "Assertion failed");
  }
}

export function runParserTests(): { 
  passed: number; 
  failed: number; 
  results: { name: string; error?: string }[] 
} {
  const results: { name: string; error?: string }[] = [];
  
  const tests: TestCase[] = [
    {
      name: "Parses sample: 20 questions",
      run: () => {
        const { exam } = parseMock(SAMPLE_TEXT);
        Assert.equal(exam.questions.length, 20);
        Assert.equal(exam.questions[0].id, 1);
        Assert.ok(exam.questions[19].text.toLowerCase().includes("mantoux"));
      }
    },
    {
      name: "Detects multi-select on Q8 & Q19",
      run: () => {
        const { exam } = parseMock(SAMPLE_TEXT);
        const q8 = exam.questions.find(q => q.id === 8)!;
        const q19 = exam.questions.find(q => q.id === 19)!;
        Assert.ok(q8.multi === true, "Q8 should be multi-select");
        Assert.ok(q19.multi === true, "Q19 should be multi-select");
      }
    },
    {
      name: "Answer key supports multiple letters (B, D, E)",
      run: () => {
        const { exam } = parseMock(SAMPLE_TEXT);
        const q8 = exam.questions.find(q => q.id === 8)!;
        Assert.equal(q8.correct.sort(), ["B", "D", "E"].sort());
      }
    },
    {
      name: "qStart regex matches numbered lines only",
      run: () => {
        const qStart = /^(\d+)\.\s*(.*)$/;
        Assert.ok(qStart.test("1. Hello"));
        Assert.ok(qStart.test("10. Something"));
        Assert.ok(!qStart.test("A) Opt"));
      }
    },
    {
      name: "Rationale captured for Q1",
      run: () => {
        const { exam } = parseMock(SAMPLE_TEXT);
        const q1 = exam.questions.find(q => q.id === 1)!;
        Assert.ok((q1.rationale || "").toLowerCase().includes("hypoxic drive"));
      }
    },
    {
      name: "calcSummary scores correctly",
      run: () => {
        const { exam } = parseMock(SAMPLE_TEXT);
        const sel: Record<number, string[]> = {};
        sel[1] = ["D"];
        sel[2] = ["B"]; // correct
        sel[8] = ["B", "D", "E"];
        sel[14] = ["C"]; // correct
        const sum = calcSummary(exam, sel, 80);
        Assert.equal(sum.correctCount, 4);
        Assert.equal(sum.total, 20);
        Assert.equal(sum.scorePct, Math.round((4 / 20) * 100));
      }
    },
    {
      name: "Parses alternative spacing",
      run: () => {
        const mini = `Mini Mock\n\n1.  First?\nA) One\nB) Two\n\nAnswer Key & Rationale\n\n1. Answer: A. Because.`;
        const { exam } = parseMock(mini);
        Assert.equal(exam.questions.length, 1);
        Assert.equal(exam.questions[0].correct, ["A"]);
      }
    },
    {
      name: "Detects categories automatically",
      run: () => {
        const { exam } = parseMock(SAMPLE_TEXT);
        Assert.ok(exam.categories && exam.categories.length > 0, "Should detect categories");
        Assert.ok(exam.categories?.includes("Respiratory"), "Should detect Respiratory category");
        Assert.ok(exam.categories?.includes("Gastrointestinal"), "Should detect Gastrointestinal category");
      }
    },
    {
      name: "Handles large question sets (150+)",
      run: () => {
        // Generate a large mock test
        let largeMock = "Large Mock Test\n\n";
        for (let i = 1; i <= 150; i++) {
          largeMock += `${i}. Question ${i} text here?\n`;
          largeMock += `A) Option A\nB) Option B\nC) Option C\nD) Option D\n\n`;
        }
        largeMock += "\nAnswer Key & Rationale\n\n";
        for (let i = 1; i <= 150; i++) {
          largeMock += `${i}. Answer: A. Rationale for question ${i}.\n`;
        }
        
        const { exam } = parseMock(largeMock);
        Assert.equal(exam.questions.length, 150);
      }
    },
    {
      name: "Option parsing stops at next question",
      run: () => {
        const mini = `T\n\n1. Q1?\nA) One\nB) Two\n2. Q2?\nA) A1\n\nAnswer Key & Rationale\n\n1. Answer: A. R\n2. Answer: A. R`;
        const { exam } = parseMock(mini);
        Assert.equal(exam.questions.length, 2);
        Assert.equal(exam.questions[0].choices.length, 2);
      }
    }
  ];

  for (const t of tests) {
    try {
      t.run();
      results.push({ name: t.name });
    } catch (e: any) {
      results.push({ name: t.name, error: e.message || String(e) });
    }
  }

  const failed = results.filter(r => r.error).length;
  const passed = results.length - failed;
  
  return { passed, failed, results };
}
