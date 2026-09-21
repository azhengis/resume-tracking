"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Incorrect passphrase.");
      }
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6"
      >
        <h1 className="mb-4 text-sm font-semibold text-ink">resume check</h1>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Passphrase"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        />
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
