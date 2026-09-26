"use client";

import React, { useRef, useState } from "react";
import { TRACKER_STATUSES, type TrackerEntry, type TrackerStatus } from "@/lib/types";
import SectionedReport from "@/components/SectionedReport";
import PdfInlineViewer from "@/components/PdfInlineViewer";
import AddEntryForm from "@/components/AddEntryForm";
import { blobToDataUrl } from "@/lib/pdf-client";

export default function TrackerTab({
  entries,
  onAdd,
  onUpdate,
  onDelete,
}: {
  entries: TrackerEntry[];
  onAdd: (entry: TrackerEntry) => Promise<void>;
  onUpdate: (id: string, patch: Partial<TrackerEntry>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"report" | "resume" | "jd">("report");
  const [adding, setAdding] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const notesTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function handleNotesChange(id: string, value: string) {
    setNotesDraft((d) => ({ ...d, [id]: value }));
    if (notesTimers.current[id]) clearTimeout(notesTimers.current[id]);
    notesTimers.current[id] = setTimeout(() => {
      onUpdate(id, { notes: value });
    }, 600);
  }

  async function uploadOwnResume(id: string, file: File) {
    setUploadingFor(id);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: form });
      const data = await res.json();
      const resumePdf = await blobToDataUrl(file);
      await onUpdate(id, { resumeUsed: res.ok ? data.text : "", resumePdf });
    } finally {
      setUploadingFor(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setAdding((a) => !a)}
          className="text-xs text-accent underline underline-offset-2"
        >
          {adding ? "Cancel" : "+ Add manually"}
        </button>
      </div>

      {adding && (
        <AddEntryForm
          onAdd={async (entry) => {
            await onAdd(entry);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Added</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Link</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr className="border-b border-border text-muted/60 italic">
                <td className="px-4 py-3">Acme Inc.</td>
                <td className="px-4 py-3">Software Engineer</td>
                <td className="px-4 py-3">{new Date().toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className="rounded border border-border/60 px-2 py-1 text-xs not-italic">
                    Evaluated
                  </span>
                </td>
                <td className="px-4 py-3">posting</td>
                <td className="px-4 py-3 text-right text-xs not-italic">delete</td>
              </tr>
            )}
            {entries.map((entry) => {
              const isOpen = openId === entry.id;
              return (
                <React.Fragment key={entry.id}>
                  <tr
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-accent-soft/40"
                    onClick={() => {
                      setOpenId(isOpen ? null : entry.id);
                      setView("report");
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-ink">{entry.company}</td>
                    <td className="px-4 py-3 text-muted">{entry.jobTitle || "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(entry.dateAdded).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={entry.status}
                        onChange={(e) =>
                          onUpdate(entry.id, { status: e.target.value as TrackerStatus })
                        }
                        className="rounded border border-border bg-surface px-2 py-1 text-xs text-ink"
                      >
                        {TRACKER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {entry.link ? (
                        <a
                          href={entry.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent underline underline-offset-2"
                        >
                          posting
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openId === entry.id) setOpenId(null);
                          onDelete(entry.id);
                        }}
                        className="text-xs text-muted hover:text-danger"
                      >
                        delete
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border bg-bg/60">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex w-fit gap-1 rounded-md border border-border bg-surface p-1">
                            {(["report", "resume", "jd"] as const).map((v) => (
                              <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`rounded px-2.5 py-1 text-xs ${
                                  view === v
                                    ? "bg-accent-soft font-medium text-accent"
                                    : "text-muted hover:text-ink"
                                }`}
                              >
                                {v === "report"
                                  ? "Report"
                                  : v === "resume"
                                    ? "Resume used"
                                    : "Job description"}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {entry.resumePdf && (
                              <a
                                href={entry.resumePdf}
                                download={`${entry.company}-resume.pdf`}
                                className="text-xs text-accent underline underline-offset-2"
                              >
                                Download resume PDF
                              </a>
                            )}
                            {entry.reportPdf && (
                              <PdfInlineViewer
                                url={entry.reportPdf}
                                filename={`${entry.company}-analysis.pdf`}
                                label="analysis PDF"
                              />
                            )}
                            <input
                              ref={(el) => {
                                fileInputs.current[entry.id] = el;
                              }}
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) =>
                                e.target.files?.[0] && uploadOwnResume(entry.id, e.target.files[0])
                              }
                            />
                            <button
                              onClick={() => fileInputs.current[entry.id]?.click()}
                              disabled={uploadingFor === entry.id}
                              className="text-xs text-ink underline underline-offset-2"
                            >
                              {uploadingFor === entry.id ? "Uploading…" : "Use my own resume"}
                            </button>
                          </div>
                        </div>

                        <div className="max-h-[28rem] overflow-y-auto rounded-md border border-border bg-surface p-4">
                          {view === "report" &&
                            (entry.report ? (
                              <SectionedReport text={entry.report} />
                            ) : (
                              <p className="text-sm text-muted">—</p>
                            ))}
                          {view === "resume" &&
                            (entry.resumePdf ? (
                              <iframe
                                src={entry.resumePdf}
                                title="Resume PDF"
                                className="h-[26rem] w-full rounded"
                              />
                            ) : (
                              <pre className="whitespace-pre-wrap font-mono text-xs text-ink">
                                {entry.resumeUsed || "—"}
                              </pre>
                            ))}
                          {view === "jd" && (
                            <pre className="whitespace-pre-wrap font-mono text-xs text-ink">
                              {entry.jobDescription || "—"}
                            </pre>
                          )}
                        </div>

                        <div className="mt-3">
                          <textarea
                            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                            rows={2}
                            placeholder="Notes"
                            value={notesDraft[entry.id] ?? entry.notes}
                            onChange={(e) => handleNotesChange(entry.id, e.target.value)}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
