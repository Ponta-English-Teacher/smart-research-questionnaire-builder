"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  incomingText?: string;         // new text to append (from Step 1 / Step 2)
};

const STORAGE_KEY = "srqb:notes";

export default function NotesPanel({ incomingText }: Props) {
  const [notes, setNotes] = useState("");
  const appendedRef = useRef(false);

  // Load saved notes on mount
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setNotes(saved);
  }, []);

  // Save whenever notes change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, notes);
  }, [notes]);

  // Append incoming text once per change
  useEffect(() => {
    if (!incomingText) return;
    if (appendedRef.current) return;
    setNotes((prev) => (prev ? `${prev}\n\n${incomingText}` : incomingText));
    appendedRef.current = true;
    const t = setTimeout(() => (appendedRef.current = false), 0);
    return () => clearTimeout(t);
  }, [incomingText]);

  return (
    <div className="p-4 bg-neutral-900/40 rounded-xl border border-neutral-800 h-[340px]">
      <h3 className="text-xl font-semibold mb-2">Notes</h3>
      <textarea
        className="w-full h-[260px] rounded-md p-3 bg-neutral-900 border border-neutral-700 outline-none"
        placeholder="Write notes..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </div>
  );
}
