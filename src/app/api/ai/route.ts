export const runtime = "edge";

/**
 * Step 1 — Topic & Keywords → Summary builder
 * -------------------------------------------
 * Request (POST JSON):
 *  { topic?: string, keywords?: string[] | string }
 *
 * Response:
 *  { ok: true, summary: string, keywords: string[] }
 *
 * Notes:
 *  - Topic-aware templates for: Sleep, Social Media/Phone, Exercise/Health
 *  - Falls back to a generic template (e.g., Money) when no match
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawTopic = (body?.topic ?? "").toString().trim();
    const topic = rawTopic || "Your Topic";

    // Normalize keywords: accept array or comma-separated string
    const rawKw = body?.keywords ?? [];
    const kwList: string[] = Array.isArray(rawKw)
      ? rawKw
      : rawKw
          .toString()
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);

    // Deduplicate (case-insensitive) but preserve first seen casing
    const seen = new Set<string>();
    const keywords = kwList.filter((k) => {
      const key = k.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Helpers
    const joined = (arr: string[]) =>
      arr.length === 0 ? "related factors" : arr.join(", ");

    // Topic-aware summary templates
    let summary = "";

    if (/sleep/i.test(topic)) {
      summary =
        `This study explores students’ **sleep patterns** and habits—` +
        `including bedtime routines, average sleep duration, and daytime sleepiness—` +
        `to understand how ${joined(keywords)} relate to overall sleep quality and well-being. ` +
        `The goal is to produce concise, answerable survey items suitable for a short questionnaire.`;
    } else if (/phone|social\s*media|sns|instagram|tiktok|x\b/i.test(topic)) {
      summary =
        `This study investigates **social media use** and its perceived effects—` +
        `such as focus, mood, and daily routines—examining how ${joined(keywords)} ` +
        `relate to students’ well-being and study behaviors. The aim is to generate ` +
        `clear, short survey questions that can be answered quickly.`;
    } else if (/exercise|health|fitness|sports/i.test(topic)) {
      summary =
        `This study examines **exercise and health behaviors** among students, focusing on frequency, ` +
        `motivation, and perceived benefits. It analyzes how ${joined(keywords)} are associated with ` +
        `energy levels, stress management, and self-rated fitness. The objective is to produce brief, ` +
        `practical survey questions for a compact questionnaire.`;
    } else {
      // Generic (works well for Money/Allowance or any unrecognized topic)
      summary =
        `This study investigates how ${joined(keywords)} relate to **${topic}**, ` +
        `with the goal of producing concise, answerable questions for a short survey.`;
    }

    return Response.json({
      ok: true,
      summary,
      keywords,
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        ok: false,
        summary:
          "This study investigates the target topic and related factors, aiming to produce concise, answerable survey questions.",
        keywords: [],
      },
      { status: 500 }
    );
  }
}

// Optional GET for quick health check (useful during dev)
export async function GET() {
  return Response.json({ ok: true, endpoint: "/api/ai" });
}
