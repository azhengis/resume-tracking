"use client";

import { useState } from "react";

export default function PdfInlineViewer({
  url,
  filename,
  label,
}: {
  url: string;
  filename: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex gap-3 text-xs">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-accent underline underline-offset-2"
        >
          {open ? "Hide" : "View"} {label}
        </button>
        <a href={url} download={filename} className="text-accent underline underline-offset-2">
          Download {label}
        </a>
      </div>
      {open && (
        <iframe
          src={url}
          title={label}
          className="mt-2 h-[32rem] w-full rounded-md border border-border"
        />
      )}
    </div>
  );
}
