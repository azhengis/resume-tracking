import ReactMarkdown from "react-markdown";

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-neutral dark:prose-invert prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h2:mt-6 prose-h3:text-sm prose-table:text-xs prose-td:align-top prose-th:align-bottom">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
