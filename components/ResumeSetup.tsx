"use client";

import { useRef, useState } from "react";
import { textareaClass } from "@/components/Field";
import { useLocalStorage } from "@/lib/useLocalStorage";

export default function ResumeSetup({
  resume,
  setResume,
}: {
  resume: string;
  setResume: (v: string) => void;
}) {
  const [, setResumeFont] = useLocalStorage("rs:resumeFont", "sans-serif");
  const [mode, setMode] = useState<"pdf" | "text">(resume ? "text" : "pdf");
  const [text, setText] = useState(resume);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
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
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setResume(data.text);
      setText(data.text);
      if (data.fontStyle) setResumeFont(data.fontStyle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <div className="mb-4 flex w-fit gap-1 rounded-md border border-border bg-surface p-1">
        <button
          onClick={() => setMode("pdf")}
          className={`rounded px-3 py-1.5 text-xs ${
            mode === "pdf" ? "bg-accent-soft font-medium text-ink" : "text-muted hover:text-ink"
          }`}
        >
          PDF
        </button>
        <button
          onClick={() => setMode("text")}
          className={`rounded px-3 py-1.5 text-xs ${
            mode === "text" ? "bg-accent-soft font-medium text-ink" : "text-muted hover:text-ink"
          }`}
        >
          Text
        </button>
      </div>

      {mode === "pdf" ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface p-12 text-center transition hover:border-accent"
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <span className="text-sm text-ink">
            {uploading ? "Reading…" : fileName || "Upload PDF"}
          </span>
        </div>
      ) : (
        <textarea
          className={textareaClass}
          rows={16}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {mode === "text" && (
        <button
          onClick={() => setResume(text)}
          disabled={!text.trim()}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
        >
          Save
        </button>
      )}
    </div>
  );
}
