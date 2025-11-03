'use client';
import React, { useState } from 'react';

export default function Step2() {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);

  async function handleGenerate() {
    setLoading(true);
    try {
      const sampleQuestions = [
        'How often do you feel your emotions affect your spending?',
        'Do you follow a monthly budget?',
        'Have you regretted an impulse buy recently?',
      ];
      setQuestions(sampleQuestions);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Step 2 — Generate Questions</h2>

      <button
        className="rounded-md border px-3 py-2 text-sm"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? 'Generating…' : 'Generate Questions'}
      </button>

      <ul className="list-disc pl-5 space-y-2">
        {questions.map((q, i) => (
          <li key={i} className="border p-2 rounded-md bg-white">
            {q}
          </li>
        ))}
      </ul>
    </section>
  );
}
