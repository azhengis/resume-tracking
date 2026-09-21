"use client";

import React, { useState } from "react";
import { TRACKER_STATUSES, type TrackerEntry, type TrackerStatus } from "@/lib/types";
import Markdown from "@/components/Markdown";

export default function TrackerTab({
  entries,
  setEntries,
}: {
  entries: TrackerEntry[];
  setEntries: (fn: (prev: TrackerEntry[]) => TrackerEntry[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"report" | "resume" | "jd">("report");

  function update(id: string, patch: Partial<TrackerEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (openId === id) setOpenId(null);
  }

  return (
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
                        update(entry.id, { status: e.target.value as TrackerStatus })
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
                        remove(entry.id);
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
                      <div className="mb-3 flex gap-1 rounded-md border border-border bg-surface p-1 w-fit">
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

                      <div className="max-h-[28rem] overflow-y-auto rounded-md border border-border bg-surface p-4">
                        {view === "report" &&
                          (entry.report ? (
                            <Markdown text={entry.report} />
                          ) : (
                            <p className="text-sm text-muted">—</p>
                          ))}
                        {view === "resume" && (
                          <pre className="whitespace-pre-wrap font-mono text-xs text-ink">
                            {entry.resumeUsed || "—"}
                          </pre>
                        )}
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
                          value={entry.notes}
                          onChange={(e) => update(entry.id, { notes: e.target.value })}
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
  );
}
