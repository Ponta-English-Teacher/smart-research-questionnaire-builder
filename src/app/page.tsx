"use client";
import React, { useMemo, useState, useRef, useEffect } from "react";

type Q = { id: string; text: string; selected: boolean };

function parseList(raw: string): string[] {
  // Accept JSON array or plain text list
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j)) {
      return j.map((x) => String(x).trim()).filter(Boolean);
    }
    if (Array.isArray(j?.items)) {
      return j.items.map((x: any) => String(x).trim()).filter(Boolean);
    }
  } catch {}
  // split bullets / numbers
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*]\s+/, "").replace(/^\s*\d+\.\s+/, "").trim())
    .filter((l) => l.length > 0);
  return lines;
}

export default function Page() {
  // ---- Step 1
  const [topic, setTopic] = useState("Money");
  const [keywords, setKeywords] = useState("");
  const [summary, setSummary] = useState("");
  const [showSummary, setShowSummary] = useState(false);

  // ---- Questions
  const [questions, setQuestions] = useState<Q[]>([]);
  const chosenCount = useMemo(
    () => questions.filter((q) => q.selected).length,
    [questions]
  );

  // ---- Chat A (discuss & regenerate)
  const [chatAInput, setChatAInput] = useState("");
  const [chatALoading, setChatALoading] = useState(false);
  const [chatAErr, setChatAErr] = useState("");
  const [chatAHistory, setChatAHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  // ---- Chat B (general)
  const [chatBInput, setChatBInput] = useState("");
  const [chatBLoading, setChatBLoading] = useState(false);
  const [chatBErr, setChatBErr] = useState("");
  const [chatBHistory, setChatBHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  // --- helpers
  function freshIds(texts: string[]): Q[] {
    return texts.map((t, i) => ({
      id: `q_${Date.now()}_${i}`,
      text: t,
      selected: true,
    }));
  }

  function toggleAll(on: boolean) {
    setQuestions((prev) => prev.map((q) => ({ ...q, selected: on })));
  }
  function toggleOne(id: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, selected: !q.selected } : q))
    );
  }
  function updateText(id: string, text: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, text } : q)));
  }

  // ---- API wrappers
  async function postChat(payload: any) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "API error");
    }
    return String(data.text || "");
  }

  // ---- Step 1: summary
  async function handleGenerateSummary() {
    try {
      const baseMsg = `Topic: ${topic}\nKeywords: ${keywords}\nSummarize the study focus in 1–2 sentences for internal notes.`;
      const txt = await postChat({
        mode: "chat",
        topic,
        keywords,
        message: baseMsg,
      });
      setSummary(txt);
      setShowSummary(true);
    } catch (e: any) {
      alert("Summary error: " + e.message);
    }
  }

  // ---- Step 2: GENERATE questions (explicit button; no auto-overwrite)
  async function handleGenerateQuestions() {
    try {
      const txt = await postChat({
        mode: "generate",
        topic,
        keywords,
        summary,
      });
      const list = parseList(txt);
      if (!list.length) throw new Error("No questions recognized.");
      setQuestions(freshIds(list));
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (e: any) {
      alert("Generate error: " + e.message);
    }
  }

  // ---- Chat A send (does NOT regenerate automatically)
  async function handleChatASend() {
    if (!chatAInput.trim()) return;
    const userMsg = { role: "user" as const, content: chatAInput.trim() };
    setChatAHistory((h) => [...h, userMsg]);
    setChatAInput("");
    setChatALoading(true);
    setChatAErr("");
    try {
      const txt = await postChat({
        mode: "chat",
        topic,
        keywords,
        summary,
        questions: questions.map((q) => q.text),
        selectedQuestions: questions.filter((q) => q.selected).map((q) => q.text),
        message: userMsg.content,
        history: chatAHistory,
      });
      setChatAHistory((h) => [...h, { role: "assistant", content: txt }]);
    } catch (e: any) {
      setChatAErr(e.message);
    } finally {
      setChatALoading(false);
    }
  }

  // ---- Chat A regenerate now (replaces list)
  async function handleRegenerateFromChatA() {
    setChatALoading(true);
    setChatAErr("");
    try {
      const txt = await postChat({
        mode: "regenerate",
        topic,
        keywords,
        summary,
        questions: questions.map((q) => q.text),
        selectedQuestions: questions.filter((q) => q.selected).map((q) => q.text),
        history: chatAHistory,
        message:
          "Regenerate the full list of 8–10 concise survey questions now, reflecting the discussion.",
      });
      const list = parseList(txt);
      if (!list.length) throw new Error("No questions recognized.");
      setQuestions(freshIds(list));
      setChatAHistory((h) => [
        ...h,
        { role: "assistant", content: "✅ Regenerated the question list." },
      ]);
    } catch (e: any) {
      setChatAErr(e.message);
    } finally {
      setChatALoading(false);
    }
  }

  // ---- Chat B (independent)
  async function handleChatBSend() {
    if (!chatBInput.trim()) return;
    const userMsg = { role: "user" as const, content: chatBInput.trim() };
    setChatBHistory((h) => [...h, userMsg]);
    setChatBInput("");
    setChatBLoading(true);
    setChatBErr("");
    try {
      const txt = await postChat({
        mode: "chat",
        message: userMsg.content,
        history: chatBHistory,
      });
      setChatBHistory((h) => [...h, { role: "assistant", content: txt }]);
    } catch (e: any) {
      setChatBErr(e.message);
    } finally {
      setChatBLoading(false);
    }
  }

  // ---- UI
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-10">
      <h1 className="text-2xl font-bold">Smart Research Questionnaire Builder</h1>
      <p className="text-sm text-gray-600">
        A simple, AI-assisted flow for Topics → Keywords → Questionnaire. Two chat areas:
        <b> Chat A</b> (discuss & regenerate) and <b>Chat B</b> (general).
      </p>

      {/* ---- Step 1 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Step 1 — Topic & Keywords</h2>
        <input
          className="w-full rounded-md border p-2"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Sleep"
        />
        <input
          className="w-full rounded-md border p-2"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="e.g., quality, bedtime routines, caffeine, screen time"
        />
        <div className="flex gap-2">
          <button className="rounded-md px-3 py-2 text-sm border" onClick={handleGenerateSummary}>
            Generate Step 1 Summary
          </button>
          <button
            className="rounded-md px-3 py-2 text-sm border"
            onClick={() => setShowSummary((v) => !v)}
          >
            {showSummary ? "Hide Summary" : "Show Summary"}
          </button>
        </div>
        {showSummary && (
          <div className="rounded-md border p-3 text-sm bg-gray-50 whitespace-pre-wrap">
            {summary || <i>(no summary yet)</i>}
          </div>
        )}
      </section>

      {/* ---- Step 2 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Step 2 — Questionnaire (editable & selectable)</h2>
          <div className="flex gap-2">
            <button className="rounded-md px-3 py-2 text-sm border" onClick={handleGenerateQuestions}>
              Generate Questions
            </button>
            <button className="rounded-md px-3 py-2 text-sm border" onClick={() => toggleAll(true)}>
              Select All
            </button>
            <button className="rounded-md px-3 py-2 text-sm border" onClick={() => toggleAll(false)}>
              Deselect All
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Edit any question text. Use the checkbox to include/exclude. Selected:{" "}
          <b>{chosenCount}</b> / {questions.length}
        </p>

        <ol className="space-y-3 list-decimal pl-5">
          {questions.map((q) => (
            <li key={q.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-2"
                  checked={q.selected}
                  onChange={() => toggleOne(q.id)}
                />
                <textarea
                  className="flex-1 rounded-md border p-2"
                  value={q.text}
                  onChange={(e) => updateText(q.id, e.target.value)}
                />
              </div>
              <div className="text-xs text-gray-500">ID: {q.id}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Chat A */}
      <section className="space-y-3 rounded-lg border p-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Chat A — discuss & regenerate</div>
          <button
            className="rounded-md px-3 py-1 text-sm border"
            onClick={handleRegenerateFromChatA}
            disabled={chatALoading}
          >
            {chatALoading ? "Regenerating..." : "Regenerate now"}
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-auto bg-white rounded-md border p-2">
          {chatAHistory.length === 0 && (
            <div className="text-xs text-gray-500">
              Tip: Tell the assistant how to reshape the set (e.g., “merge 1 & 2”, “use more Likert
              wording”, “focus on weekend spending”).
            </div>
          )}
          {chatAHistory.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-sm" : "text-sm bg-gray-100 p-2 rounded"}>
              <b>{m.role === "user" ? "You" : "Assistant"}:</b> {m.content}
            </div>
          ))}
          {chatAErr && <div className="text-xs text-red-600">Error: {chatAErr}</div>}
        </div>

        <input
          className="w-full rounded-md border p-2"
          placeholder='e.g., “1 and 2 overlap; merge into one Likert question about budgeting.”'
          value={chatAInput}
          onChange={(e) => setChatAInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!chatALoading) handleChatASend();
            }
          }}
        />
        <div className="text-xs text-gray-500">
          Press <b>Enter</b> to send — <b>Shift+Enter</b> for a new line.
        </div>
      </section>

      {/* ---- Chat B */}
      <section className="space-y-3 rounded-lg border p-3">
        <div className="text-sm font-semibold">Chat B — general chatbot (independent)</div>
        <div className="space-y-2 max-h-64 overflow-auto bg-white rounded-md border p-2">
          {chatBHistory.length === 0 && (
            <div className="text-xs text-gray-500">
              Ask anything (theme ideas, keyword brainstorming, coding help, etc.).
            </div>
          )}
          {chatBHistory.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-sm" : "text-sm bg-gray-50 p-2 rounded"}>
              <b>{m.role === "user" ? "You" : "Assistant"}:</b> {m.content}
            </div>
          ))}
          {chatBErr && <div className="text-xs text-red-600">Error: {chatBErr}</div>}
        </div>

        <input
          className="w-full rounded-md border p-2"
          placeholder="Ask me anything…"
          value={chatBInput}
          onChange={(e) => setChatBInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!chatBLoading) handleChatBSend();
            }
          }}
        />
        <div className="text-xs text-gray-500">
          Press <b>Enter</b> to send — <b>Shift+Enter</b> for a new line.
        </div>
      </section>

      <footer className="text-center text-xs text-gray-500 mt-10 border-t pt-4">
        Smart Research Questionnaire Builder © 2025  
        Developed by <b>Professor Hitoshi Eguchi</b> — Hokusei Gakuen University, Sapporo, Japan
      </footer>
    </main>
  );
}
