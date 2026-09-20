"use client";

import { useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Field, inputClass, textareaClass } from "@/components/Field";
import Markdown from "@/components/Markdown";
import type { TrackerEntry } from "@/lib/types";
import { STAGE_LABELS, type Stage } from "@/lib/ats-prompt";

interface Draft {
  company: string;
  jobTitle: string;
  link: string;
  jobDescription: string;
}

interface Stages {
  analysis: string;
  resume: string;
  review: string;
}

const EMPTY_DRAFT: Draft = { company: "", jobTitle: "", link: "", jobDescription: "" };
const EMPTY_STAGES: Stages = { analysis: "", resume: "", review: "" };
const STAGE_ORDER: Stage[] = ["analysis", "resume", "review"];

function joinReport(stages: Stages) {
  return [stages.analysis, stages.resume, stages.review].filter(Boolean).join("\n\n---\n\n");
}

export default function EvaluateTab({
  onSaved,
  setEntries,
}: {
  onSaved: () => void;
  setEntries: (fn: (prev: TrackerEntry[]) => TrackerEntry[]) => void;
}) {
  const [resume, setResume] = useLocalStorage("rs:resume", "");
  const [aboutMe] = useLocalStorage("rs:aboutMe", "");
  const [draft, setDraft] = useLocalStorage<Draft>("rs:draft", EMPTY_DRAFT);
  const [stages, setStages] = useLocalStorage<Stages>("rs:lastStages", EMPTY_STAGES);

  const [runningStage, setRunningStage] = useState<Stage | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  async function callStage(stage: Stage, extra: Record<string, string>) {
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage,
        resume,
        aboutMe,
        jobDescription: draft.jobDescription,
        companyName: draft.company,
        jobTitle: draft.jobTitle,
        ...extra,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Stage "${stage}" failed.`);
    return data.section as string;
  }

  async function runEvaluation() {
    setError("");
    setSaved(false);
    if (!resume.trim() || !draft.jobDescription.trim()) {
      setError("Add both a resume and a job description first.");
      return;
    }
    setStages(EMPTY_STAGES);
    try {
      setRunningStage("analysis");
      const analysis = await callStage("analysis", {});
      setStages((s) => ({ ...s, analysis }));

      setRunningStage("resume");
      const resumeOut = await callStage("resume", { priorAnalysis: analysis });
      setStages((s) => ({ ...s, resume: resumeOut }));

      setRunningStage("review");
      const review = await callStage("review", { priorAnalysis: analysis, priorResume: resumeOut });
      setStages((s) => ({ ...s, review }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed.");
    } finally {
      setRunningStage(null);
    }
  }

  function saveToTracker() {
    const entry: TrackerEntry = {
      id: crypto.randomUUID(),
      company: draft.company.trim() || "Unnamed company",
      jobTitle: draft.jobTitle.trim(),
      link: draft.link.trim(),
      status: "Evaluated",
      dateAdded: new Date().toISOString(),
      jobDescription: draft.jobDescription,
      resumeUsed: resume,
      report: joinReport(stages),
      notes: "",
    };
    setEntries((prev) => [entry, ...prev]);
    setSaved(true);
    onSaved();
  }

  const hasAnyOutput = Boolean(stages.analysis || stages.resume || stages.review);
  const pipelineDone = Boolean(stages.review) && !runningStage;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="Your resume" hint="plain text · saved locally">
          <textarea
            className={textareaClass}
            rows={18}
            placeholder="Paste the resume you're evaluating (the version you'd apply with)..."
            value={resume}
            onChange={(e) => setResume(e.target.value)}
          />
        </Field>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company">
            <input
              className={inputClass}
              value={draft.company}
              onChange={(e) => update({ company: e.target.value })}
              placeholder="Acme Inc."
            />
          </Field>
          <Field label="Job title">
            <input
              className={inputClass}
              value={draft.jobTitle}
              onChange={(e) => update({ jobTitle: e.target.value })}
              placeholder="Software Engineer"
            />
          </Field>
        </div>
        <Field label="Job posting link" hint="optional">
          <input
            className={inputClass}
            value={draft.link}
            onChange={(e) => update({ link: e.target.value })}
            placeholder="https://..."
          />
        </Field>
        <Field label="Job description">
          <textarea
            className={textareaClass}
            rows={12}
            placeholder="Paste the full job description..."
            value={draft.jobDescription}
            onChange={(e) => update({ jobDescription: e.target.value })}
          />
        </Field>
      </div>

      <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
        <button
          onClick={runEvaluation}
          disabled={runningStage !== null}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {runningStage ? "Running…" : "Run evaluation"}
        </button>

        <div className="flex items-center gap-2">
          {STAGE_ORDER.map((s, i) => {
            const done = Boolean(stages[s]);
            const active = runningStage === s;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted">→</span>}
                <span
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                    done
                      ? "bg-accent-soft text-accent"
                      : active
                        ? "bg-accent-soft/60 text-accent animate-pulse"
                        : "text-muted"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      done ? "bg-accent" : active ? "bg-accent" : "bg-border"
                    }`}
                  />
                  {STAGE_LABELS[s]}
                </span>
              </div>
            );
          })}
        </div>

        {error && <span className="text-sm text-danger">{error}</span>}
      </div>

      {hasAnyOutput && (
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Evaluation report</h3>
            <button
              onClick={saveToTracker}
              disabled={!pipelineDone}
              className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {saved ? "Saved ✓ — save again" : "Save to tracker"}
            </button>
          </div>

          {stages.analysis && (
            <ReportCard title="1 · Analysis" text={stages.analysis} />
          )}
          {stages.resume && (
            <ReportCard title="2 · Tailored resume" text={stages.resume} />
          )}
          {stages.review && (
            <ReportCard title="3 · Final review" text={stages.review} />
          )}
        </div>
      )}
    </div>
  );
}

function ReportCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      <Markdown text={text} />
    </div>
  );
}
