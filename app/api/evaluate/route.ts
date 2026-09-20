import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { STAGE_PROMPTS, type Stage } from "@/lib/ats-prompt";

const STAGES: Stage[] = ["analysis", "resume", "review"];
const MAX_OUTPUT_TOKENS: Record<Stage, number> = {
  analysis: 6000,
  resume: 6000,
  review: 4000,
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    stage,
    aboutMe,
    resume,
    jobDescription,
    companyName,
    jobTitle,
    priorAnalysis,
    priorResume,
  } = body as {
    stage?: Stage;
    aboutMe?: string;
    resume?: string;
    jobDescription?: string;
    companyName?: string;
    jobTitle?: string;
    priorAnalysis?: string;
    priorResume?: string;
  };

  if (!stage || !STAGES.includes(stage)) {
    return NextResponse.json(
      { error: `Invalid stage. Expected one of: ${STAGES.join(", ")}.` },
      { status: 400 },
    );
  }
  if (!resume?.trim() || !jobDescription?.trim()) {
    return NextResponse.json(
      { error: "Resume and job description are both required." },
      { status: 400 },
    );
  }

  const parts = [
    `COMPANY: ${companyName?.trim() || "Not specified"}`,
    `JOB TITLE: ${jobTitle?.trim() || "Not specified"}`,
    "",
    "=== MY RESUME ===",
    resume.trim(),
    "",
    "=== JOB DESCRIPTION ===",
    jobDescription.trim(),
    "",
    "=== ADDITIONAL CONTEXT ABOUT ME ===",
    aboutMe?.trim() || "No additional context provided.",
  ];

  if (priorAnalysis?.trim()) {
    parts.push(
      "",
      "=== PRIOR ANALYSIS (stage 1 — already generated and already shown to me; reference it, don't repeat it) ===",
      priorAnalysis.trim(),
    );
  }
  if (priorResume?.trim()) {
    parts.push(
      "",
      "=== TAILORED RESUME (stage 2 — already generated and already shown to me; reference it, don't repeat it) ===",
      priorResume.trim(),
    );
  }

  try {
    const { text } = await generateText({
      model: "anthropic/claude-sonnet-5",
      instructions: STAGE_PROMPTS[stage],
      prompt: parts.join("\n"),
      maxOutputTokens: MAX_OUTPUT_TOKENS[stage],
    });

    return NextResponse.json({ section: text });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Evaluation failed. Check server logs / AI Gateway key." },
      { status: 500 },
    );
  }
}
