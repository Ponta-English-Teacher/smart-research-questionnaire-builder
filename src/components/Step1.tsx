"use client";
import { useState } from "react";

type Props = {
  onSummary: (summary: string) => void;  // send text to Notes + advance
};

export default function Step1({ onSummary }: Props) {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleGenerate() {
    const prompt = `
Topic: ${topic || "(none)"}
Keywords: ${keywords || "(none)"}

You are helping a university student design a small questionnaire study.
1) Write a crisp 3–4 sentence Step 1 summary (what to investigate + why).
2) List 5 concrete, interview-friendly keywords/angles (comma-separated).
Keep it in plain text.`;

    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      const text: string = data.text || "No result.";
      setPreview(text);
      onSummary(text);  // push to Notes and advance
    } catch (e: any) {
      const msg = e?.message ?? "Request failed.";
      setPreview(`(Error) ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setTopic("");
    setKeywords("");
    setPreview(null);
  }

  return (
    <div className="p-6 bg-neutral-900/40 rounded-2xl border border-neutral-800">
      <h2 className="text-2xl font-bold mb-3">Step 1 — Topic & Keywords</h2>
      <p className="text-neutral-300 mb-4">
        Enter a broad topic and comma-separated keywords. Example: <em>Money</em> and
        <em> allowance from parents, part-time work, spending habit</em>.
      </p>

      <label className="block text-sm mb-2">Broad Topic</label>
      <input
        className="w-full mb-3 p-3 rounded-md bg-neutral-900 border border-neutral-700 outline-none"
        placeholder="e.g., Money"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />

      <label className="block text-sm mb-2">Keywords (comma-separated)</label>
      <input
        className="w-full mb-4 p-3 rounded-md bg-neutral-900 border border-neutral-700 outline-none"
        placeholder="allowance from parents, part-time work, spending habit"
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
      />

      <div className="flex gap-3">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 rounded-md bg-blue-600 disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate Step 1 Summary"}
        </button>
        <button onClick={handleClear} className="px-4 py-2 rounded-md bg-neutral-700">Clear</button>
      </div>

      {preview && (
        <pre className="mt-5 whitespace-pre-wrap text-sm bg-neutral-900 border border-neutral-800 rounded-lg p-4">
{preview}
        </pre>
      )}
      <p className="text-xs text-neutral-400 mt-2">
        The Step 1 summary is automatically added to Notes.
      </p>
    </div>
  );
}
