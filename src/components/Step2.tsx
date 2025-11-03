'use client';
import React, { useMemo, useState, useEffect } from 'react';

export type EditableQ = { id: string; text: string; selected: boolean };

type Props = {
  // All props are optional so the component compiles even if parent signature differs.
  questions?: EditableQ[];
  setQuestions?: (next: EditableQ[] | ((prev: EditableQ[]) => EditableQ[])) => void;
  onGenerate?: () => Promise<string[] | EditableQ[]>;
  loading?: boolean;
  setLoading?: (v: boolean) => void;
  title?: string;
};

export default function Step2(props: Props) {
  // Bridge external ↔ internal state so the file compiles in all cases.
  const [localLoading, setLocalLoading] = useState<boolean>(false);
  const loading = props.loading ?? localLoading;
  const setLoading = props.setLoading ?? setLocalLoading;

  const [localQs, setLocalQs] = useState<EditableQ[]>(props.questions ?? []);
  const questions = props.questions ?? localQs;
  const setQuestions =
    props.setQuestions ??
    ((next: EditableQ[] | ((prev: EditableQ[]) => EditableQ[])) =>
      setLocalQs(typeof next === 'function' ? (next as any)(localQs) : next));

  // If parent feeds questions later, sync once.
  useEffect(() => {
    if (props.questions) setLocalQs(props.questions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.questions?.length]);

  const chosenCount = useMemo(
    () => questions.filter((q) => q.selected).length,
    [questions]
  );

  const toggleSelectAll = (on: boolean) =>
    setQuestions((prev) => prev.map((q) => ({ ...q, selected: on })));

  const toggleQuestion = (id: string) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, selected: !q.selected } : q)));

  const updateQuestionText = (id: string, text: string) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, text } : q)));

  async function handleGenerate() {
    try {
      setLoading(true);
      // Prefer parent generator if provided
      if (props.onGenerate) {
        const out = await props.onGenerate();
        const list: EditableQ[] = Array.isArray(out)
          ? (out as any[]).map((v, i) =>
              typeof v === 'string'
                ? { id: `q_${Date.now()}_${i}`, text: v, selected: true }
                : { ...v, id: v.id ?? `q_${Date.now()}_${i}`, selected: v.selected ?? true }
            )
          : [];
        if (list.length) setQuestions((prev) => [...prev, ...list]);
      } else {
        // Fallback: simple demo items (no network)
        const seed = [
          'How often do you feel your emotions affect your spending?',
          'Do you follow a monthly budget?',
          'Have you regretted an impulse buy in the last 3 months?',
        ];
        const list = seed.map((t, i) => ({ id: `q_seed_${i}`, text: t, selected: true }));
        setQuestions((prev) => [...prev, ...list]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">
          {props.title ?? 'Step 2 — Draft Questions (Editable & Selectable)'}
        </h2>
        <p className="text-sm text-gray-600">
          Edit any question text. Use the checkbox to include/exclude. Selected: <b>{chosenCount}</b> / {questions.length}
        </p>

        <div className="flex gap-2 mt-2">
          <button
            className="rounded-md px-3 py-2 text-sm border"
            onClick={() => toggleSelectAll(true)}
            disabled={loading}
          >
            Select All
          </button>
          <button
            className="rounded-md px-3 py-2 text-sm border"
            onClick={() => toggleSelectAll(false)}
            disabled={loading}
          >
            Deselect All
          </button>
          <button
            className="rounded-md px-3 py-2 text-sm border"
            onClick={handleGenerate}
            disabled={loading}
            title="Append new questions (uses parent onGenerate if provided)"
          >
            {loading ? 'Generating…' : 'Generate Questions'}
          </button>
        </div>

        <ol className="space-y-3 list-decimal pl-5 mt-3">
          {questions.map((q) => (
            <li key={q.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={q.selected}
                  onChange={() => toggleQuestion(q.id)}
                  className="mt-2"
                />
                <textarea
                  className="flex-1 rounded-md border p-2"
                  value={q.text}
                  onChange={(e) => updateQuestionText(q.id, e.target.value)}
                />
              </div>
              <div className="text-xs text-gray-500">ID: {q.id}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
