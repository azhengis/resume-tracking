"use client";

import { useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import type { TrackerEntry } from "@/lib/types";
import AboutTab from "@/components/AboutTab";
import EvaluateTab from "@/components/EvaluateTab";
import TrackerTab from "@/components/TrackerTab";

type Tab = "evaluate" | "tracker" | "about";

const TABS: { id: Tab; label: string }[] = [
  { id: "evaluate", label: "Evaluate" },
  { id: "tracker", label: "Tracker" },
  { id: "about", label: "About you" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("evaluate");
  const [entries, setEntries] = useLocalStorage<TrackerEntry[]>("rs:tracker", []);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-ink">resume check</h1>
            <p className="text-xs text-muted">resume ↔ job fit, tracked</p>
          </div>
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
          <EvaluateTab onSaved={() => setTab("tracker")} setEntries={setEntries} />
        )}
        {tab === "tracker" && <TrackerTab entries={entries} setEntries={setEntries} />}
        {tab === "about" && <AboutTab />}
      </main>
    </div>
  );
}
