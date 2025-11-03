  async function handleGenerate() {
    setLoading(true);
    setQuestions("");

    try {
      // --- Pull topic & keywords from the Step 1 summary text ---
      // Example Step 1 format:
      // "This study investigates how ... relate to Money, ..."
      // "Keywords: Allowance from parents, part-time job, spending money, spending habit"
      const topicMatch =
        step1Text.match(/relate to\s+(.+?)[,.\n]/i) ||
        step1Text.match(/to\s+([A-Za-z ]+)\s*$/i);
      const topic = (topicMatch?.[1] || "General").trim();

      const keysMatch = step1Text.match(/Keywords:\s*(.+)/i);
      const keywords = keysMatch
        ? keysMatch[1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      // --- Call your backend (/api/chat) instead of /api/ai ---
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "draft",
          topic,
          keywords,
          count: 8, // ask backend for ~8 questions
        }),
      });

      const data = await res.json();
      if (!data?.ok) throw new Error("Backend returned not ok");

      // --- Flatten backend JSON into a numbered list for display ---
      const msg = data.message || {};
      const allQs: string[] = [
        ...(msg.profile ?? []),
        ...(msg.likert ?? []),
        ...(msg.open ?? []),
      ].filter(Boolean);

      const list = allQs.map((q, i) => `${i + 1}. ${q}`).join("\n");

      setQuestions(list);
      if (list) onQuestions(`Step 2 — Draft Questions:\n${list}`);
    } catch (e: any) {
      setQuestions(`(Error) ${e?.message ?? "Request failed."}`);
    } finally {
      setLoading(false);
    }
  }
