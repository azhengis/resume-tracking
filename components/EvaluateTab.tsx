"use client";

import { useRef, useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Field, inputClass, textareaClass } from "@/components/Field";
import SectionedReport from "@/components/SectionedReport";
import PdfInlineViewer from "@/components/PdfInlineViewer";
import type { TrackerEntry } from "@/lib/types";
import {
  extractTailoredResume,
  parseSuggestions,
  applySuggestion,
  stripSuggestionsSection,
  type ResumeSuggestion,
  type Stage,
} from "@/lib/ats-prompt";
import { blobToDataUrl } from "@/lib/pdf-client";

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

function joinReport(stages: Stages) {
  return [stages.analysis, stages.resume, stages.review].filter(Boolean).join("\n\n---\n\n");
}

function buildReportForPdf(stages: Stages, draft: Draft) {
  const title = [draft.jobTitle, draft.company].filter(Boolean).join(" — ") || "Evaluation Report";
  return [`# ${title}`, "", joinReport(stages)].join("\n");
}

export default function EvaluateTab({
  resume,
  resumeFont,
  aboutMe,
  onReplaceResume,
  onSaveEntry,
}: {
  resume: string;
  resumeFont: string;
  aboutMe: string;
  onReplaceResume: () => void;
  onSaveEntry: (entry: TrackerEntry) => Promise<void>;
}) {
  const [draft, setDraft] = useLocalStorage<Draft>("rs:draft", EMPTY_DRAFT);
  const [stages, setStages] = useLocalStorage<Stages>("rs:lastStages", EMPTY_STAGES);
  const [finalResume, setFinalResume] = useLocalStorage("rs:finalResume", "");

  const [resumeMode, setResumeMode] = useState<"ai" | "own">("ai");
  const [ownResumePdf, setOwnResumePdf] = useState<string | null>(null);
  const [uploadingOwn, setUploadingOwn] = useState(false);
  const [ownFileName, setOwnFileName] = useState("");
  const ownFileInput = useRef<HTMLInputElement>(null);

  const [suggestions, setSuggestions] = useState<ResumeSuggestion[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  const [baseOverride, setBaseOverride] = useState<{
    text: string;
    label: string;
    reason: string;
  } | null>(null);
  const [findingBest, setFindingBest] = useState(false);
  const effectiveResume = baseOverride?.text || resume;

  const [runningStage, setRunningStage] = useState<Stage | null>(null);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [preparingPdf, setPreparingPdf] = useState(false);
  const [finalResumePdfUrl, setFinalResumePdfUrl] = useState<string | null>(null);
  const [finalResumePageCount, setFinalResumePageCount] = useState<number | null>(null);

  const update = (patch: Partial<Draft>) => {
    setSavedMessage("");
    setDraft({ ...draft, ...patch });
  };

  async function callStage(stage: Stage, extra: Record<string, string>) {
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage,
        resume: effectiveResume,
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

  function invalidateFinalResumePdf() {
    if (finalResumePdfUrl) URL.revokeObjectURL(finalResumePdfUrl);
    setFinalResumePdfUrl(null);
    setFinalResumePageCount(null);
  }

  function resetDownstream() {
    setStages(EMPTY_STAGES);
    setFinalResume("");
    setOwnResumePdf(null);
    invalidateFinalResumePdf();
    setSuggestions([]);
    setAppliedSuggestions(new Set());
  }

  function addSuggestion(s: ResumeSuggestion) {
    setFinalResume((prev) => applySuggestion(prev, s));
    setAppliedSuggestions((prev) => new Set(prev).add(s.id));
    if (ownResumePdf) setOwnResumePdf(null);
    if (finalResumePdfUrl) invalidateFinalResumePdf();
  }

  async function findBestResume() {
    setError("");
    setSavedMessage("");
    setFindingBest(true);
    try {
      const res = await fetch("/api/best-resume", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't find a best resume.");
      setBaseOverride({ text: data.text, label: data.label, reason: data.reason });
      resetDownstream();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't find a best resume.");
    } finally {
      setFindingBest(false);
    }
  }

  function resetToMasterResume() {
    setBaseOverride(null);
    setError("");
    setSavedMessage("");
    resetDownstream();
  }

  async function runAnalysis() {
    setError("");
    setSavedMessage("");
    if (!draft.jobDescription.trim()) {
      setError("Add a job description first.");
      return;
    }
    resetDownstream();
    setRunningStage("analysis");
    try {
      const analysis = await callStage("analysis", {});
      setStages((s) => ({ ...s, analysis }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setRunningStage(null);
    }
  }

  async function generateAiResume() {
    setError("");
    setSavedMessage("");
    setOwnResumePdf(null);
    invalidateFinalResumePdf();
    setRunningStage("resume");
    try {
      const resumeOut = await callStage("resume", { priorAnalysis: stages.analysis });
      setStages((s) => ({ ...s, resume: resumeOut }));
      setFinalResume(extractTailoredResume(resumeOut));
      setSuggestions(parseSuggestions(resumeOut));
      setAppliedSuggestions(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resume generation failed.");
    } finally {
      setRunningStage(null);
    }
  }

  async function uploadOwnResume(file: File) {
    setError("");
    setSavedMessage("");
    setUploadingOwn(true);
    setOwnFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read that PDF.");
      const pdfDataUrl = await blobToDataUrl(file);
      setStages((s) => ({ ...s, resume: "" }));
      setFinalResume(data.text);
      setOwnResumePdf(pdfDataUrl);
      invalidateFinalResumePdf();
      setSuggestions([]);
      setAppliedSuggestions(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingOwn(false);
    }
  }

  async function runReview() {
    setError("");
    setSavedMessage("");
    setRunningStage("review");
    try {
      const priorResume = finalResume.trim() || effectiveResume;
      const review = await callStage("review", { priorAnalysis: stages.analysis, priorResume });
      setStages((s) => ({ ...s, review }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setRunningStage(null);
    }
  }

  async function fetchPdfResponse(text: string, kind: "resume" | "report") {
    const res = await fetch("/api/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, fontStyle: resumeFont, kind }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Couldn't generate the PDF.");
    }
    return res;
  }

  async function fetchPdfBlob(text: string, kind: "resume" | "report") {
    return (await fetchPdfResponse(text, kind)).blob();
  }

  async function prepareFinalResumePdf() {
    setError("");
    setPreparingPdf(true);
    try {
      const res = await fetchPdfResponse(finalResume, "resume");
      const pages = Number(res.headers.get("X-Page-Count"));
      setFinalResumePageCount(Number.isFinite(pages) && pages > 0 ? pages : null);
      const blob = await res.blob();
      setFinalResumePdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the PDF.");
    } finally {
      setPreparingPdf(false);
    }
  }

  async function saveToTracker() {
    setError("");
    setSaving(true);
    try {
      const resumeText = finalResume.trim() || effectiveResume;
      const [resumePdf, reportBlob] = await Promise.all([
        ownResumePdf ? Promise.resolve(ownResumePdf) : fetchPdfBlob(resumeText, "resume").then(blobToDataUrl),
        fetchPdfBlob(buildReportForPdf(stages, draft), "report"),
      ]);
      const reportPdf = await blobToDataUrl(reportBlob);

      const company = draft.company.trim() || "Unnamed company";
      const entry: TrackerEntry = {
        id: crypto.randomUUID(),
        company,
        jobTitle: draft.jobTitle.trim(),
        link: draft.link.trim(),
        status: "Evaluated",
        dateAdded: new Date().toISOString(),
        jobDescription: draft.jobDescription,
        resumeUsed: resumeText,
        report: joinReport(stages),
        notes: "",
        resumePdf,
        reportPdf,
      };
      await onSaveEntry(entry);

      // Reset the form so it's ready for the next job posting.
      setDraft(EMPTY_DRAFT);
      setStages(EMPTY_STAGES);
      setFinalResume("");
      setOwnResumePdf(null);
      setOwnFileName("");
      invalidateFinalResumePdf();
      setSavedMessage(`Saved "${company}" to the tracker.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save to the tracker.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(stages.analysis);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {baseOverride && <span className="text-ink">{baseOverride.label} — </span>}
            {effectiveResume.slice(0, 60)}
            {effectiveResume.length > 60 ? "…" : ""}
          </span>
          <div className="flex items-center gap-3">
            {baseOverride && (
              <button
                onClick={resetToMasterResume}
                className="text-ink underline underline-offset-2"
              >
                Use master resume
              </button>
            )}
            <button
              onClick={findBestResume}
              disabled={findingBest}
              className="text-ink underline underline-offset-2 disabled:opacity-50"
            >
              {findingBest ? "Finding…" : "Use best from history"}
            </button>
            <button onClick={onReplaceResume} className="text-ink underline underline-offset-2">
              Edit master
            </button>
          </div>
        </div>
        {baseOverride?.reason && <p className="text-xs text-muted">{baseOverride.reason}</p>}
      </div>

      {savedMessage && (
        <div className="flex items-center justify-between rounded-md border border-accent/40 bg-accent-soft/40 px-3 py-2 text-xs text-ink">
          <span>{savedMessage}</span>
          <button onClick={() => setSavedMessage("")} className="text-muted hover:text-ink">
            ✕
          </button>
        </div>
      )}

      <div className="space-y-4">
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
            rows={14}
            value={draft.jobDescription}
            onChange={(e) => update({ jobDescription: e.target.value })}
          />
        </Field>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Step 1 — Analysis */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">1 · Analysis</h3>
          <button
            onClick={runAnalysis}
            disabled={runningStage !== null}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
          >
            {runningStage === "analysis"
              ? "Analyzing…"
              : stages.analysis
                ? "Re-run analysis"
                : "Run analysis"}
          </button>
        </div>
        {stages.analysis && (
          <div className="rounded-lg border border-border bg-surface p-6">
            <SectionedReport text={stages.analysis} />
          </div>
        )}
      </div>

      {/* Step 2 — Resume */}
      {stages.analysis && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">2 · Resume</h3>
            <div className="flex w-fit gap-1 rounded-md border border-border bg-surface p-1">
              <button
                onClick={() => setResumeMode("ai")}
                className={`rounded px-2.5 py-1 text-xs ${
                  resumeMode === "ai"
                    ? "bg-accent-soft font-medium text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                AI tailored
              </button>
              <button
                onClick={() => setResumeMode("own")}
                className={`rounded px-2.5 py-1 text-xs ${
                  resumeMode === "own"
                    ? "bg-accent-soft font-medium text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                My own
              </button>
            </div>
          </div>

          {resumeMode === "ai" ? (
            <button
              onClick={generateAiResume}
              disabled={runningStage !== null}
              className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft disabled:opacity-40"
            >
              {runningStage === "resume"
                ? "Generating…"
                : stages.resume
                  ? "Regenerate tailored resume"
                  : "Generate tailored resume"}
            </button>
          ) : (
            <div
              onClick={() => ownFileInput.current?.click()}
              className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-surface p-6 text-center transition hover:border-accent"
            >
              <input
                ref={ownFileInput}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadOwnResume(e.target.files[0])}
              />
              <span className="text-sm text-ink">
                {uploadingOwn ? "Reading…" : ownFileName || "Upload the resume you wrote"}
              </span>
            </div>
          )}

          {stages.resume && (
            <div className="rounded-lg border border-border bg-surface p-6">
              <SectionedReport text={stripSuggestionsSection(stages.resume)} />
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Suggested additions
              </h4>
              {suggestions.map((s) => {
                const applied = appliedSuggestions.has(s.id);
                return (
                  <div
                    key={s.id}
                    className="rounded-lg border border-border bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-ink">{s.title}</p>
                        <p className="mt-1 text-xs text-muted">{s.why}</p>
                      </div>
                      <button
                        onClick={() => addSuggestion(s)}
                        disabled={applied}
                        className="shrink-0 rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft disabled:border-border disabled:text-muted"
                      >
                        {applied ? "Added ✓" : "Add to resume"}
                      </button>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap rounded-md bg-bg p-3 font-mono text-xs text-muted">
                      {s.add}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}

          {finalResume && (
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Final resume
                </h4>
                {ownResumePdf ? (
                  <PdfInlineViewer
                    url={ownResumePdf}
                    filename={`${draft.company.trim() || "resume"}.pdf`}
                    label="PDF"
                  />
                ) : finalResumePdfUrl ? (
                  <div className="flex items-center gap-3">
                    {finalResumePageCount && (
                      <span
                        className={
                          finalResumePageCount > 1 ? "text-xs text-danger" : "text-xs text-muted"
                        }
                      >
                        {finalResumePageCount > 1
                          ? `${finalResumePageCount} pages — trim to fit one`
                          : "Fits one page"}
                      </span>
                    )}
                    <PdfInlineViewer
                      url={finalResumePdfUrl}
                      filename={`${draft.company.trim() || "resume"}.pdf`}
                      label="PDF"
                    />
                    <button
                      onClick={invalidateFinalResumePdf}
                      className="text-xs text-muted hover:text-ink"
                    >
                      Regenerate
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={prepareFinalResumePdf}
                    disabled={preparingPdf || !finalResume.trim()}
                    className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft disabled:opacity-40"
                  >
                    {preparingPdf ? "Generating…" : "Generate PDF"}
                  </button>
                )}
              </div>
              <textarea
                className={textareaClass}
                rows={16}
                value={finalResume}
                onChange={(e) => {
                  setFinalResume(e.target.value);
                  if (ownResumePdf) setOwnResumePdf(null);
                  if (finalResumePdfUrl) invalidateFinalResumePdf();
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Final review */}
      {stages.analysis && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">3 · Final review</h3>
            <button
              onClick={runReview}
              disabled={runningStage !== null}
              className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft disabled:opacity-40"
            >
              {runningStage === "review"
                ? "Reviewing…"
                : stages.review
                  ? "Re-run final review"
                  : "Run final review"}
            </button>
          </div>
          {stages.review && (
            <div className="rounded-lg border border-border bg-surface p-6">
              <SectionedReport text={stages.review} />
            </div>
          )}
        </div>
      )}

      {canSave && (
        <div className="flex justify-end">
          <button
            onClick={saveToTracker}
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save to tracker"}
          </button>
        </div>
      )}
    </div>
  );
}
