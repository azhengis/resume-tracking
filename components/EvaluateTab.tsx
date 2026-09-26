"use client";

import { useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Field, inputClass, textareaClass } from "@/components/Field";
import Markdown from "@/components/Markdown";
import type { TrackerEntry } from "@/lib/types";
import { STAGE_LABELS, extractTailoredResume, type Stage } from "@/lib/ats-prompt";

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

function buildReportForPdf(stages: Stages, draft: Draft) {
  const title = [draft.jobTitle, draft.company].filter(Boolean).join(" — ") || "Evaluation Report";
  return [`# ${title}`, "", joinReport(stages)].join("\n");
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function EvaluateTab({
  resume,
  onSaved,
  onReplaceResume,
  setEntries,
}: {
  resume: string;
  onSaved: () => void;
  onReplaceResume: () => void;
  setEntries: (fn: (prev: TrackerEntry[]) => TrackerEntry[]) => void;
}) {
  const [aboutMe] = useLocalStorage("rs:aboutMe", "");
  const [resumeFont] = useLocalStorage("rs:resumeFont", "sans-serif");
  const [draft, setDraft] = useLocalStorage<Draft>("rs:draft", EMPTY_DRAFT);
  const [stages, setStages] = useLocalStorage<Stages>("rs:lastStages", EMPTY_STAGES);
  const [finalResume, setFinalResume] = useLocalStorage("rs:finalResume", "");

  const [runningStage, setRunningStage] = useState<Stage | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

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
    if (!draft.jobDescription.trim()) {
      setError("Add a job description first.");
      return;
    }
    setStages(EMPTY_STAGES);
    setFinalResume("");
    try {
      setRunningStage("analysis");
      const analysis = await callStage("analysis", {});
      setStages((s) => ({ ...s, analysis }));

      setRunningStage("resume");
      const resumeOut = await callStage("resume", { priorAnalysis: analysis });
      setStages((s) => ({ ...s, resume: resumeOut }));
      setFinalResume(extractTailoredResume(resumeOut));

      setRunningStage("review");
      const review = await callStage("review", { priorAnalysis: analysis, priorResume: resumeOut });
      setStages((s) => ({ ...s, review }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed.");
    } finally {
      setRunningStage(null);
    }
  }

  async function fetchPdfBlob(text: string, kind: "resume" | "report") {
    const res = await fetch("/api/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, fontStyle: resumeFont, kind }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Couldn't generate the PDF.");
    }
    return res.blob();
  }

  async function saveToTracker() {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const [resumeBlob, reportBlob] = await Promise.all([
        fetchPdfBlob(finalResume, "resume"),
        fetchPdfBlob(buildReportForPdf(stages, draft), "report"),
      ]);
      const [resumePdf, reportPdf] = await Promise.all([
        blobToDataUrl(resumeBlob),
        blobToDataUrl(reportBlob),
      ]);

      const entry: TrackerEntry = {
        id: crypto.randomUUID(),
        company: draft.company.trim() || "Unnamed company",
        jobTitle: draft.jobTitle.trim(),
        link: draft.link.trim(),
        status: "Evaluated",
        dateAdded: new Date().toISOString(),
        jobDescription: draft.jobDescription,
        resumeUsed: finalResume.trim() || resume,
        report: joinReport(stages),
        notes: "",
        resumePdf,
        reportPdf,
      };
      setEntries((prev) => [entry, ...prev]);
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save to the tracker.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    setError("");
    setDownloading(true);
    try {
      const blob = await fetchPdfBlob(finalResume, "resume");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${draft.company.trim() || "resume"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the PDF.");
    } finally {
      setDownloading(false);
    }
  }

  const hasAnyOutput = Boolean(stages.analysis || stages.resume || stages.review);
  const pipelineDone = Boolean(stages.review) && !runningStage;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{resume.slice(0, 60)}{resume.length > 60 ? "…" : ""}</span>
        <button onClick={onReplaceResume} className="text-ink underline underline-offset-2">
          Replace
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Company">
          <input
            className={inputClass}
            value={draft.company}
            onChange={(e) => update({ company: e.target.value })}
          />
        </Field>
        <Field label="Job title">
          <input
            className={inputClass}
            value={draft.jobTitle}
            onChange={(e) => update({ jobTitle: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Link">
        <input
          className={inputClass}
          value={draft.link}
          onChange={(e) => update({ link: e.target.value })}
        />
      </Field>
      <Field label="Job description">
        <textarea
          className={textareaClass}
          rows={16}
          value={draft.jobDescription}
          onChange={(e) => update({ jobDescription: e.target.value })}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runEvaluation}
          disabled={runningStage !== null}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Report</h3>
            <button
              onClick={saveToTracker}
              disabled={!pipelineDone || saving}
              className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save to tracker"}
            </button>
          </div>

          {stages.analysis && <ReportCard title="1 · Analysis" text={stages.analysis} />}
          {stages.resume && <ReportCard title="2 · Tailored resume" text={stages.resume} />}

          {stages.resume && (
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Final resume
                </h4>
                <button
                  onClick={downloadPdf}
                  disabled={downloading || !finalResume.trim()}
                  className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  {downloading ? "Generating…" : "Download PDF"}
                </button>
              </div>
              <textarea
                className={textareaClass}
                rows={16}
                value={finalResume}
                onChange={(e) => setFinalResume(e.target.value)}
              />
            </div>
          )}

          {stages.review && <ReportCard title="3 · Final review" text={stages.review} />}
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
