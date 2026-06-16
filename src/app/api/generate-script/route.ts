import { NextRequest, NextResponse } from "next/server";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const API_KEY = process.env.OPENAI_API_KEY || "";

// ---------------------------------------------------------------------------
// PASS 1 — Conversion (not generation)
// ---------------------------------------------------------------------------

const GENERATION_SYSTEM = `You are a Google Apps Script CONVERTER for Google Forms.

You are converting an existing questionnaire into Apps Script code.
You are NOT designing a questionnaire. You are NOT a question creator.

CRITICAL RULES — NEVER VIOLATE:
- Use ONLY the questions given in the input. Never add a question that is not in the input.
- Never invent new questions. Never fill in gaps with example questions.
- Do not substantially rewrite question meaning. Copy question text as closely as possible.
- Minor punctuation or capitalisation cleanup is acceptable, but never change the meaning.
- The total number of form question items in the output (not counting section headers) MUST equal
  the total number of source questions you were given. No more. No less.

OUTPUT RULES:
- Output ONLY raw JavaScript. No markdown. No backticks. No code fences.
- No explanatory text before or after the code.
- The output must begin with exactly: function myFunction() {
- The output must end with the final closing brace: }

QUESTION-TYPE RULES:

1. MULTIPLE-CHOICE (Yes/No, options, etc.)
   Use this exact pattern with a named variable per item:

   var item1 = form.addMultipleChoiceItem();
   item1.setTitle('Question text here');
   item1.setChoices([
     item1.createChoice('Option A'),
     item1.createChoice('Option B')
   ]);

   NEVER use .setChoices(['Option A', 'Option B']) — that is invalid Apps Script.
   Each item must use its own variable (item1, item2, item3, …).

2. CHECKBOX (select all that apply)
   Use this exact pattern:

   var item2 = form.addCheckboxItem();
   item2.setTitle('Question text here');
   item2.setChoices([
     item2.createChoice('Option A'),
     item2.createChoice('Option B')
   ]);

   NEVER use .setChoices(['string', 'string']) — always use createChoice().

3. SCALE (Likert / agreement / frequency)
   Use this exact pattern:

   form.addScaleItem()
     .setTitle('Question text here')
     .setBounds(1, 5)
     .setLabels('Strongly disagree', 'Strongly agree');

   Choose labels that match the question wording (e.g., 'Never' / 'Always' for frequency).

4. SHORT ANSWER / NUMERIC / OPEN-ENDED
   Use:
   form.addTextItem().setTitle('Question text here');

   Do NOT add validation unless you are certain the Apps Script syntax is correct.

SECTION RULES:
- If the source questionnaire has named sections, add a section header before each group:
  form.addSectionHeaderItem().setTitle('Section Name');
- Section headers do NOT count toward the question total.
- Number each item variable sequentially across all sections: item1, item2, item3, …

GENERAL RULES:
- Do not number the question titles — the form numbers them automatically.
- Use FormApp.create(title) to create the form.
- Do not add .setRequired() unless the source question clearly indicates it is required.`;

// Source: Chat A answer + Step 2 questions — always merge with explicit count
function buildCombinedPrompt(
  title: string,
  chatAFinalAnswer: string,
  questions: string[]
): string {
  const numbered = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  return `Form title: ${title}

You are converting an existing questionnaire into Apps Script. You are NOT designing a new questionnaire.
Do NOT invent questions. Do NOT add any question not present in the sources below.
Copy all question text verbatim from the sources.

You have two input sources. Read BOTH before deciding how to combine them.

--- SOURCE A: Chat A assistant answer ---
${chatAFinalAnswer}
--- END SOURCE A ---

--- SOURCE B: Selected Step 2 questions (${questions.length} items) ---
${numbered}
--- END SOURCE B ---

DECISION — choose exactly one strategy:

STRATEGY 1 — MERGE (default):
Use when SOURCE A contains only SOME questions (e.g., profile questions, demographic items,
a small group of additions) and is NOT a full replacement for SOURCE B.
→ Convert ALL items from BOTH sources verbatim:
   • SOURCE A items first, with a section header if SOURCE A names a section
   • Then ALL ${questions.length} SOURCE B questions verbatim, with a section header if appropriate
   • Total form question items = (number of questions in SOURCE A) + ${questions.length}

STRATEGY 2 — USE SOURCE A ONLY:
Use ONLY when SOURCE A explicitly says "complete questionnaire", "full questionnaire",
"final questionnaire", or "revised complete questionnaire", OR when SOURCE A contains
the same number or more questions as SOURCE B covering the same research topics.
→ Convert ONLY SOURCE A verbatim.

DEFAULT: When in doubt, choose STRATEGY 1 to avoid losing questions.

Convert the questionnaire above into the Google Apps Script function now.
Output only raw code, starting with function myFunction() {`;
}

// Source: Step 2 selected questions only (no Chat A answer)
function buildPromptFromQuestions(title: string, questions: string[]): string {
  const numbered = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  return `Form title: ${title}

You are converting an existing questionnaire into Apps Script. You are NOT designing a new questionnaire.
Do NOT invent questions. Use ONLY the ${questions.length} questions listed below, copied verbatim.
The form must contain exactly ${questions.length} question items (not counting section headers).

Questions:
${numbered}

Convert the questionnaire above into the Google Apps Script function now.
Output only raw code, starting with function myFunction() {`;
}

// ---------------------------------------------------------------------------
// PASS 2 — Syntax validation only (no content changes)
// ---------------------------------------------------------------------------

const VALIDATION_SYSTEM = `You are a Google Apps Script syntax checker.

Your ONLY job is to fix Apps Script syntax errors in the code you receive.

YOU MUST NOT:
- Add new questions or any content not already in the code.
- Remove questions.
- Change question text (except fixing an obvious single-character typo or punctuation mark).
- Invent any content.

Fix ONLY these syntax issues:

1. MARKDOWN FENCES — remove any line starting with \`\`\` (with or without a language tag).
2. STRING-ARRAY CHOICES — replace any .setChoices(['...', '...']) pattern with the safe createChoice pattern:
   var itemN = form.addMultipleChoiceItem();
   itemN.setTitle('...');
   itemN.setChoices([
     itemN.createChoice('...'),
     itemN.createChoice('...')
   ]);
3. MISSING createChoice — every multiple-choice and checkbox item must use item.createChoice() inside setChoices([]).
4. FUNCTION WRAPPER — the code must start with exactly: function myFunction() {
5. CLOSING BRACE — the code must end with a single } on its own line.
6. STRAY TEXT — remove any explanatory sentences or text outside the function body.

Return ONLY the corrected raw JavaScript code.
No markdown. No backticks. No explanations. No code fences.`;

function buildValidationPrompt(code: string): string {
  return `Fix any Apps Script syntax errors in the following code. Do not add, remove, or rewrite any questions.\n\n${code}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripFences(code: string): string {
  return code
    .replace(/^```[a-z]*\n?/im, "")
    .replace(/\n?```$/im, "")
    .trim();
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  temperature: number
): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${errText}`);
  }

  const json = await res.json();
  return ((json?.choices?.[0]?.message?.content) ?? "").trim();
}

function buildMockCode(title: string, questions: string[]): string {
  const escaped = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const lines: string[] = [`function myFunction() {`];
  lines.push(`  var form = FormApp.create('${escaped(title)}');`);
  questions.forEach((q, i) => {
    const n = i + 1;
    lines.push(`  var item${n} = form.addMultipleChoiceItem();`);
    lines.push(`  item${n}.setTitle('${escaped(q)}');`);
    lines.push(`  item${n}.setChoices([`);
    lines.push(`    item${n}.createChoice('Yes'),`);
    lines.push(`    item${n}.createChoice('No')`);
    lines.push(`  ]);`);
  });
  lines.push(`}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title: string = String(body?.title || "Research Questionnaire").trim();
    const chatAFinalAnswer: string = String(body?.chatAFinalAnswer ?? "").trim();
    const questions: string[] = Array.isArray(body?.questions) ? body.questions : [];

    if (!chatAFinalAnswer && questions.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No questionnaire content provided." },
        { status: 400 }
      );
    }

    if (!API_KEY) {
      const mockQuestions = questions.length > 0
        ? questions
        : ["(questions extracted from Chat A — API key required for full conversion)"];
      return NextResponse.json({ ok: true, code: buildMockCode(title, mockQuestions) });
    }

    // Pass 1 — convert: merge Chat A + Step 2 when Chat A has content, otherwise Step 2 only
    const conversionPrompt = chatAFinalAnswer
      ? buildCombinedPrompt(title, chatAFinalAnswer, questions)
      : buildPromptFromQuestions(title, questions);

    const raw = await callOpenAI(GENERATION_SYSTEM, conversionPrompt, 0.1);
    const afterConversion = stripFences(raw);

    // Pass 2 — syntax validation only, no content changes
    const validated = await callOpenAI(
      VALIDATION_SYSTEM,
      buildValidationPrompt(afterConversion),
      0.0
    );
    const finalCode = stripFences(validated);

    return NextResponse.json({ ok: true, code: finalCode });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
