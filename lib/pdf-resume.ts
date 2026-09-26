import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";

export type FontStyle = "serif" | "sans-serif" | "monospace";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const FONT_MAP: Record<FontStyle, { regular: StandardFonts; bold: StandardFonts }> = {
  serif: { regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold },
  "sans-serif": { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold },
  monospace: { regular: StandardFonts.Courier, bold: StandardFonts.CourierBold },
};

type Kind = "blank" | "title" | "header" | "bullet" | "body";
interface Line {
  kind: Kind;
  text: string;
}

const UNICODE_REPLACEMENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  " ": " ",
  "→": "->",
  "←": "<-",
  "✓": "OK",
  "✔": "OK",
  "✗": "x",
  "✘": "x",
  "≥": ">=",
  "≤": "<=",
  "×": "x",
  "÷": "/",
};

/** pdf-lib's standard fonts only encode WinAnsi (roughly Latin-1) — strip anything else. */
function sanitizeForPdf(text: string): string {
  const replaced = text.replace(
    /[‘’“”–—… →←✓✔✗✘≥≤×÷]/g,
    (ch) => UNICODE_REPLACEMENTS[ch] ?? ch,
  );
  return replaced.replace(/[^\x00-\xff]/g, "");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function renderLines(lines: Line[], fontStyle: FontStyle): Promise<Uint8Array> {
  const fonts = FONT_MAP[fontStyle] ?? FONT_MAP["sans-serif"];
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(fonts.regular);
  const bold = await doc.embedFont(fonts.bold);
  const ink = rgb(0.06, 0.06, 0.06);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  const ensureSpace = (lineHeight: number) => {
    if (y - lineHeight < MARGIN) newPage();
  };

  for (const rawLine of lines) {
    const line = { ...rawLine, text: sanitizeForPdf(rawLine.text) };

    if (line.kind === "blank") {
      y -= 8;
      continue;
    }

    const isBullet = line.kind === "bullet";
    let font = regular;
    let size = 10.5;
    let indent = 0;
    let spacingBefore = 0;
    let spacingAfter = 2;

    if (line.kind === "title") {
      font = bold;
      size = 16;
      spacingAfter = 4;
    } else if (line.kind === "header") {
      font = bold;
      size = 11;
      spacingBefore = 8;
      spacingAfter = 4;
    } else if (isBullet) {
      indent = 14;
    }

    const lineHeight = size * 1.35;
    y -= spacingBefore;

    const bulletPrefix = "•  ";
    const prefixWidth = isBullet ? font.widthOfTextAtSize(bulletPrefix, size) : 0;
    const wrapped = wrapText(line.text, font, size, CONTENT_WIDTH - indent - prefixWidth);

    wrapped.forEach((wline, i) => {
      ensureSpace(lineHeight);
      const drawn = isBullet && i === 0 ? `${bulletPrefix}${wline}` : wline;
      page.drawText(drawn, { x: MARGIN + indent, y, size, font, color: ink });
      y -= lineHeight;
    });

    y -= spacingAfter;
  }

  return doc.save();
}

function isAllCapsHeader(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, "");
  return letters.length >= 2 && letters === letters.toUpperCase() && line.length <= 48;
}

/** Resume text: line 1 is the name, ALL-CAPS lines are section headers, "- " lines are bullets. */
export async function renderResumePdf(text: string, fontStyle: FontStyle): Promise<Uint8Array> {
  const rawLines = text.split("\n");
  const lines: Line[] = rawLines.map((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return { kind: "blank", text: "" };
    if (index === 0) return { kind: "title", text: line };
    if (/^[-•*]\s+/.test(line)) return { kind: "bullet", text: line.replace(/^[-•*]\s+/, "") };
    if (isAllCapsHeader(line)) return { kind: "header", text: line };
    return { kind: "body", text: line };
  });
  return renderLines(lines, fontStyle);
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

/** Markdown-ish report text: #/## headers, "- " bullets, tables flattened, emphasis stripped. */
export async function renderReportPdf(text: string, fontStyle: FontStyle): Promise<Uint8Array> {
  const rawLines = text.split("\n");
  const lines: Line[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();

    if (!line) {
      lines.push({ kind: "blank", text: "" });
      continue;
    }
    if (/^[-*_]{3,}$/.test(line)) {
      lines.push({ kind: "blank", text: "" });
      continue;
    }
    if (/^\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes("-")) {
      continue; // markdown table separator row
    }

    const heading = line.match(/^#{1,6}\s+(.*)/);
    if (heading) {
      lines.push({ kind: "header", text: stripInlineMarkdown(heading[1]) });
      continue;
    }

    const bullet = line.match(/^[-•*]\s+(.*)/);
    if (bullet) {
      lines.push({ kind: "bullet", text: stripInlineMarkdown(bullet[1]) });
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => stripInlineMarkdown(c.trim()))
        .filter(Boolean);
      lines.push({ kind: "body", text: cells.join("   ·   ") });
      continue;
    }

    lines.push({ kind: "body", text: stripInlineMarkdown(line) });
  }

  return renderLines(lines, fontStyle);
}
