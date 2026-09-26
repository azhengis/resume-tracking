import Markdown from "@/components/Markdown";

interface Section {
  heading: string | null;
  body: string;
}

function splitSections(text: string): Section[] {
  const cleaned = text.replace(/^\s*---\s*$/gm, "");
  const chunks = cleaned.split(/\n(?=##? )/g);

  return chunks
    .map((chunk) => {
      const trimmed = chunk.trim();
      const match = trimmed.match(/^##?\s+(.+?)\n([\s\S]*)$/);
      if (match) return { heading: match[1].trim(), body: match[2].trim() };
      return { heading: null, body: trimmed };
    })
    .filter((s) => s.heading || s.body);
}

export default function SectionedReport({ text }: { text: string }) {
  const sections = splitSections(text);

  return (
    <div className="space-y-3">
      {sections.map((s, i) => (
        <div key={i} className={s.heading ? "rounded-md border border-border p-4" : ""}>
          {s.heading && (
            <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {s.heading}
            </h5>
          )}
          <Markdown text={s.body} />
        </div>
      ))}
    </div>
  );
}
