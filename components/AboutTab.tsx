"use client";

import { useRef, useState } from "react";
import { textareaClass } from "@/components/Field";

export default function AboutTab({
  aboutMe,
  setAboutMe,
}: {
  aboutMe: string;
  setAboutMe: (v: string) => void;
}) {
  const [value, setValue] = useState(aboutMe);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(next: string) {
    setValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setAboutMe(next), 600);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-4 text-sm font-semibold text-ink">About you</h2>
      <textarea
        className={textareaClass}
        rows={16}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}
