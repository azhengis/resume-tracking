"use client";

import { useEffect, useState } from "react";
import type { TrackerEntry } from "@/lib/types";
import AboutTab from "@/components/AboutTab";
import EvaluateTab from "@/components/EvaluateTab";
import TrackerTab from "@/components/TrackerTab";
import ResumeSetup from "@/components/ResumeSetup";

type Tab = "evaluate" | "tracker" | "resume" | "about";

const TABS: { id: Tab; label: string }[] = [
  { id: "evaluate", label: "Evaluate" },
  { id: "tracker", label: "Tracker" },
  { id: "resume", label: "Resume" },
  { id: "about", label: "About you" },
];

interface MigrationCandidate {
  resume: string;
  resumeFont: string;
  aboutMe: string;
  entries: TrackerEntry[];
}

function readLocalString(key: string): string {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return "";
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch {
    return "";
  }
}

function readLocalEntries(): TrackerEntry[] {
  try {
    const raw = window.localStorage.getItem("rs:tracker");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function putJson(url: string, body: unknown) {
  return fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function App() {
  const [tab, setTab] = useState<Tab>("evaluate");
  const [loading, setLoading] = useState(true);
  const [resume, setResumeLocal] = useState("");
  const [resumeFont, setResumeFontLocal] = useState("sans-serif");
  const [aboutMe, setAboutMeLocal] = useState("");
  const [entries, setEntriesLocal] = useState<TrackerEntry[]>([]);
  const [migration, setMigration] = useState<
    (MigrationCandidate & { migrating: boolean }) | null
  >(null);

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((data) => {
        setResumeLocal(data.resume ?? "");
        setResumeFontLocal(data.resumeFont ?? "sans-serif");
        setAboutMeLocal(data.aboutMe ?? "");
        setEntriesLocal(data.entries ?? []);

        if (!data.resume) {
          const localResume = readLocalString("rs:resume");
          if (localResume) {
            setMigration({
              resume: localResume,
              resumeFont: readLocalString("rs:resumeFont") || "sans-serif",
              aboutMe: readLocalString("rs:aboutMe"),
              entries: readLocalEntries(),
              migrating: false,
            });
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function runMigration() {
    if (!migration) return;
    setMigration((m) => (m ? { ...m, migrating: true } : m));
    const res = await fetch("/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: migration.resume,
        resumeFont: migration.resumeFont,
        aboutMe: migration.aboutMe,
        entries: migration.entries,
      }),
    });
    if (!res.ok) {
      setMigration((m) => (m ? { ...m, migrating: false } : m));
      return;
    }
    const state = await fetch("/api/state").then((r) => r.json());
    setResumeLocal(state.resume ?? "");
    setResumeFontLocal(state.resumeFont ?? "sans-serif");
    setAboutMeLocal(state.aboutMe ?? "");
    setEntriesLocal(state.entries ?? []);
    for (const key of ["rs:resume", "rs:resumeFont", "rs:aboutMe", "rs:tracker"]) {
      window.localStorage.removeItem(key);
    }
    setMigration(null);
  }

  async function setResume(value: string) {
    setResumeLocal(value);
    await putJson("/api/profile", { resume: value });
  }

  async function setResumeFont(value: string) {
    setResumeFontLocal(value);
    await putJson("/api/profile", { resumeFont: value });
  }

  async function setAboutMe(value: string) {
    setAboutMeLocal(value);
    await putJson("/api/profile", { aboutMe: value });
  }

  async function addEntry(entry: TrackerEntry) {
    const res = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error("Couldn't save the entry.");
    const saved: TrackerEntry = await res.json();
    setEntriesLocal((prev) => [saved, ...prev]);
  }

  async function updateEntry(id: string, patch: Partial<TrackerEntry>) {
    setEntriesLocal((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const res = await fetch(`/api/tracker/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const saved: TrackerEntry = await res.json();
      setEntriesLocal((prev) => prev.map((e) => (e.id === id ? saved : e)));
    }
  }

  async function deleteEntry(id: string) {
    setEntriesLocal((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/tracker/${id}`, { method: "DELETE" });
  }

  if (loading) {
    return <div className="min-h-screen bg-bg" />;
  }

  if (migration) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-surface p-6 text-center">
          <h1 className="text-sm font-semibold text-ink">Move your local data to the server?</h1>
          <p className="text-xs text-muted">
            Found a resume and {migration.entries.length}{" "}
            {migration.entries.length === 1 ? "tracker entry" : "tracker entries"} saved in this
            browser. Moving them means they persist across devices and browsers, not just this
            one.
          </p>
          <button
            onClick={runMigration}
            disabled={migration.migrating}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
          >
            {migration.migrating ? "Moving…" : "Move to server storage"}
          </button>
          <button onClick={() => setMigration(null)} className="text-xs text-muted hover:text-ink">
            Skip — start fresh here instead
          </button>
        </div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-xl">
          <h1 className="mb-4 text-sm font-semibold tracking-tight text-ink">Resume</h1>
          <ResumeSetup resume={resume} setResume={setResume} setResumeFont={setResumeFont} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-sm font-semibold tracking-tight text-ink">resume check</h1>
          <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  tab === t.id
                    ? "bg-accent-soft text-accent font-medium"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
                {t.id === "tracker" && entries.length > 0 && (
                  <span className="ml-1.5 text-xs text-muted">{entries.length}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {tab === "evaluate" && (
          <EvaluateTab
            resume={resume}
            resumeFont={resumeFont}
            aboutMe={aboutMe}
            onReplaceResume={() => setTab("resume")}
            onSaveEntry={addEntry}
          />
        )}
        {tab === "tracker" && (
          <TrackerTab
            entries={entries}
            onAdd={addEntry}
            onUpdate={updateEntry}
            onDelete={deleteEntry}
          />
        )}
        {tab === "resume" && (
          <ResumeSetup resume={resume} setResume={setResume} setResumeFont={setResumeFont} />
        )}
        {tab === "about" && <AboutTab aboutMe={aboutMe} setAboutMe={setAboutMe} />}
      </main>
    </div>
  );
}
