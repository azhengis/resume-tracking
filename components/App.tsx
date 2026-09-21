"use client";

import { useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
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

export default function App() {
  const [tab, setTab] = useState<Tab>("evaluate");
  const [entries, setEntries] = useLocalStorage<TrackerEntry[]>("rs:tracker", []);
  const [resume, setResume] = useLocalStorage("rs:resume", "");

  if (!resume) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-xl">
          <h1 className="mb-4 text-sm font-semibold tracking-tight text-ink">Resume</h1>
          <ResumeSetup resume={resume} setResume={setResume} />
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
            onSaved={() => setTab("tracker")}
            onReplaceResume={() => setTab("resume")}
            setEntries={setEntries}
          />
        )}
        {tab === "tracker" && <TrackerTab entries={entries} setEntries={setEntries} />}
        {tab === "resume" && <ResumeSetup resume={resume} setResume={setResume} />}
        {tab === "about" && <AboutTab />}
      </main>
    </div>
  );
}
