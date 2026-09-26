"use client";

import { useRef, useState } from "react";
import { Field, inputClass, textareaClass } from "@/components/Field";
import type { TrackerEntry } from "@/lib/types";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function AddEntryForm({
  onAdd,
  onCancel,
}: {
  onAdd: (entry: TrackerEntry) => void;
  onCancel: () => void;
}) {
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [link, setLink] = useState("");
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read that PDF.");
      setResumeText(data.text);
      setResumeFile(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError("");
    if (!company.trim()) {
      setError("Add a company name.");
      return;
    }
    setSubmitting(true);
    try {
      const resumePdf = resumeFile ? await blobToDataUrl(resumeFile) : undefined;
      const entry: TrackerEntry = {
        id: crypto.randomUUID(),
        company: company.trim(),
        jobTitle: jobTitle.trim(),
        link: link.trim(),
        status: "Applied",
        dateAdded: new Date().toISOString(),
        jobDescription: "",
        resumeUsed: resumeText,
        report: "",
        notes: "",
        resumePdf,
      };
      onAdd(entry);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company">
          <input
            className={inputClass}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </Field>
        <Field label="Job title">
          <input
            className={inputClass}
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Link">
        <input className={inputClass} value={link} onChange={(e) => setLink(e.target.value)} />
      </Field>

      <div>
        <div className="mb-2 flex w-fit gap-1 rounded-md border border-border bg-bg p-1">
          <button
            onClick={() => setMode("pdf")}
            className={`rounded px-2.5 py-1 text-xs ${
              mode === "pdf" ? "bg-accent-soft font-medium text-ink" : "text-muted hover:text-ink"
            }`}
          >
            PDF
          </button>
          <button
            onClick={() => setMode("text")}
            className={`rounded px-2.5 py-1 text-xs ${
              mode === "text" ? "bg-accent-soft font-medium text-ink" : "text-muted hover:text-ink"
            }`}
          >
            Text
          </button>
        </div>
        {mode === "pdf" ? (
          <div
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-bg p-6 text-center transition hover:border-accent"
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <span className="text-sm text-ink">
              {uploading ? "Reading…" : fileName || "Upload the resume you used"}
            </span>
          </div>
        ) : (
          <textarea
            className={textareaClass}
            rows={8}
            value={resumeText}
            onChange={(e) => {
              setResumeText(e.target.value);
              setResumeFile(null);
              setFileName("");
            }}
          />
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add"}
        </button>
        <button onClick={onCancel} className="text-xs text-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
