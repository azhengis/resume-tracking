"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { Field, textareaClass } from "@/components/Field";

const PLACEHOLDER = `Who you are and what you're looking for — the agent uses this as context on every evaluation, alongside your resume.

Examples of useful things to include:
- Current role / years of experience, focus areas (e.g. ML engineering, backend, data)
- Skills or projects that aren't on your resume but are real and relevant
- Career goals / the kind of roles you're targeting
- Anything you don't want the agent to overstate (e.g. "the recsys project was solo, 6 weeks, academic")`;

export default function AboutTab() {
  const [aboutMe, setAboutMe] = useLocalStorage("rs:aboutMe", "");

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-base font-semibold text-ink">About you</h2>
      <p className="mt-1 text-sm text-muted">
        Stored locally in this browser only. Sent to the model as extra context on every
        evaluation — it never leaves this run except to generate a report.
      </p>
      <div className="mt-5">
        <Field label="Context for the agent">
          <textarea
            className={textareaClass}
            rows={16}
            placeholder={PLACEHOLDER}
            value={aboutMe}
            onChange={(e) => setAboutMe(e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
