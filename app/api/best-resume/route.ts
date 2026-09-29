import { generateText } from "ai";
import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

// Higher = a stronger real-world signal that this resume version worked.
const STATUS_SCORE: Record<string, number> = {
  Offer: 4,
  Interviewing: 3,
  Applied: 2,
  Evaluated: 1,
  Withdrawn: 1,
  Rejected: 0,
};

interface Candidate {
  text: string;
  label: string;
  score: number;
}

export async function POST() {
  await ensureSchema();
  const sql = db();

  const [profileRows, entryRows] = await Promise.all([
    sql`SELECT value FROM profile WHERE key = 'resume'`,
    sql`SELECT company, status, resume_used FROM tracker_entries`,
  ]);

  const masterResume = ((profileRows as { value: string }[])[0]?.value ?? "").trim();
  const candidates = new Map<string, Candidate>();

  if (masterResume) {
    candidates.set(masterResume, { text: masterResume, label: "Master resume", score: 1 });
  }

  for (const row of entryRows as { company: string; status: string; resume_used: string }[]) {
    const text = row.resume_used?.trim();
    if (!text) continue;
    const score = STATUS_SCORE[row.status] ?? 0;
    const existing = candidates.get(text);
    const label = `Used for ${row.company} (${row.status})`;
    if (!existing || score > existing.score) {
      candidates.set(text, { text, label, score });
    }
  }

  const list = Array.from(candidates.values());

  if (list.length === 0) {
    return NextResponse.json({ error: "No resumes to compare yet." }, { status: 400 });
  }
  if (list.length === 1) {
    return NextResponse.json({
      text: list[0].text,
      label: list[0].label,
      reason: "Only resume on file so far.",
    });
  }

  const maxScore = Math.max(...list.map((c) => c.score));
  const topByOutcome = list.filter((c) => c.score === maxScore);

  // A single, unambiguous winner that actually reached "Applied" or further.
  if (topByOutcome.length === 1 && maxScore >= 2) {
    return NextResponse.json({
      text: topByOutcome[0].text,
      label: topByOutcome[0].label,
      reason: `Strongest real-world outcome so far: ${topByOutcome[0].label}.`,
    });
  }

  // Tie, or nothing has a real outcome yet — judge quality instead.
  const pool = topByOutcome.length > 1 ? topByOutcome : list;
  const prompt = pool
    .map((c, i) => `RESUME ${i + 1} (${c.label}):\n${c.text}`)
    .join("\n\n---\n\n");

  try {
    const { text } = await generateText({
      model: "openai/gpt-4.1",
      instructions:
        "You are an expert resume reviewer. Compare the following resume versions purely on writing quality — completeness, clarity, quantified achievements, structure, and general ATS-friendliness — independent of any specific job. Respond in exactly this format and nothing else:\nBEST: <resume number>\nREASON: <one sentence>",
      prompt,
      maxOutputTokens: 200,
    });

    const match = text.match(/BEST:\s*(\d+)[\s\S]*?REASON:\s*(.+)/i);
    const index = match ? parseInt(match[1], 10) - 1 : 0;
    const chosen = pool[index] ?? pool[0];
    const reason = match ? match[2].trim() : "Selected by quality comparison.";

    return NextResponse.json({ text: chosen.text, label: chosen.label, reason });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      text: pool[0].text,
      label: pool[0].label,
      reason: "Couldn't run the quality comparison — picked the first candidate.",
    });
  }
}
