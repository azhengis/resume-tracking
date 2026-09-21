"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { textareaClass } from "@/components/Field";

export default function AboutTab() {
  const [aboutMe, setAboutMe] = useLocalStorage("rs:aboutMe", "");

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-4 text-sm font-semibold text-ink">About you</h2>
      <textarea
        className={textareaClass}
        rows={16}
        value={aboutMe}
        onChange={(e) => setAboutMe(e.target.value)}
      />
    </div>
  );
}
