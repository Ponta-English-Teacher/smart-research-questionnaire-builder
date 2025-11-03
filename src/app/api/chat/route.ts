// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

type ChatBody = {
  mode: "generate" | "regenerate" | "chat";
  topic?: string;
  keywords?: string;
  summary?: string;
  questions?: string[];
  selectedQuestions?: string[];
  message?: string; // the latest user message (for chat)
  history?: { role: "user" | "assistant"; content: string }[]; // optional running chat history
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const API_KEY = process.env.OPENAI_API_KEY || "";

function sysPrompt(mode: ChatBody["mode"]) {
  if (mode === "chat") {
    return `You are a helpful research-assistant chatbot. Be concise, concrete, and give survey-friendly wording when asked.`;
  }
  // generate / regenerate
  return `You create short, answerable survey questions (Likert, Yes/No, short numeric, or brief free-text).
- Keep questions concise and unambiguous.
- Prefer Likert or Yes/No where appropriate.
- Do NOT include numbering or extra commentary.
- Return ONLY a list (one per line), unless user explicitly asks for something else.`;
}

function buildUserPrompt(body: ChatBody) {
  const { mode, topic, keywords, summary, message, questions, selectedQuestions } = body;
  if (mode === "chat") {
    const base = [];
    if (topic) base.push(`Topic: ${topic}`);
    if (keywords) base.push(`Keywords: ${keywords}`);
    if (summary) base.push(`Summary: ${summary}`);
    if (questions?.length) base.push(`Current questions:\n- ${questions.join("\n- ")}`);
    if (message) base.push(`User: ${message}`);
    return base.join("\n\n");
  }

  // generate / regenerate
  const seed = [];
  if (topic) seed.push(`Topic = ${topic}`);
  if (keywords) seed.push(`Keywords = ${keywords}`);
  if (summary) seed.push(`Summary = ${summary}`);
  if (selectedQuestions && selectedQuestions.length) {
    seed.push(`Selected/kept questions:\n- ${selectedQuestions.join("\n- ")}`);
  }
  if (questions && questions.length) {
    seed.push(`Previous draft questions (for reference):\n- ${questions.join("\n- ")}`);
  }

  seed.push(
    `Task: Produce 8–10 concise survey questions about the topic/keywords above. Mix of Likert and Yes/No is welcome. One question per line.`
  );
  return seed.join("\n\n");
}

async function callOpenAI(body: ChatBody) {
  const messages = [
    { role: "system", content: sysPrompt(body.mode) },
    ...(body.history || []),
    { role: "user", content: buildUserPrompt(body) },
  ];

  if (!API_KEY) {
    // Safe fallback for local testing without a key.
    const mock =
      body.mode === "chat"
        ? "Okay. Tell me your constraints and target respondents, and I can polish the wording or generate alternatives."
        : `How much do you spend on ${body.topic || "the topic"} each month? (Numeric)\n` +
          `How often do you plan a budget for ${body.topic || "the topic"}? (Never / Occasionally / Regularly)\n` +
          `How confident are you in managing issues about ${body.topic || "the topic"}? (Low / Medium / High)\n` +
          `Do you have income related to ${body.keywords || "this"}? (Yes/No)\n` +
          `What is the biggest challenge you face about ${body.topic || "the topic"}? (Short answer)\n` +
          `Have you taken any course to improve ${body.topic || "this"}? (Yes/No)\n` +
          `If Yes, which resource helped the most? (Short answer)`;
    return { text: mock };
  }

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: body.mode === "chat" ? 0.7 : 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${errText}`);
  }

  const json = await res.json();
  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    JSON.stringify(json);
  return { text: String(text || "").trim() };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatBody;
    const { text } = await callOpenAI(body);
    return NextResponse.json({ ok: true, text });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
