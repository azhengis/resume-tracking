import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";

export type FontStyle = "serif" | "sans-serif" | "monospace";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 70.87; // ~2.5cm, matching a common LaTeX-resume-template margin
const MARGIN_Y = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const FONT_MAP: Record<
  FontStyle,
  { regular: StandardFonts; bold: StandardFonts; italic: StandardFonts }
> = {
  serif: {
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
  },
  "sans-serif": {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
  },
  monospace: {
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
  },
};

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

// ---------------------------------------------------------------------------
// Generic markdown-ish report renderer (analysis report, not resume-shaped)
// ---------------------------------------------------------------------------

type ReportKind = "blank" | "title" | "header" | "bullet" | "body";
interface ReportLine {
  kind: ReportKind;
  text: string;
}

async function renderReportLines(lines: ReportLine[], fontStyle: FontStyle): Promise<Uint8Array> {
  const fonts = FONT_MAP[fontStyle] ?? FONT_MAP["sans-serif"];
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(fonts.regular);
  const bold = await doc.embedFont(fonts.bold);
  const ink = rgb(0.06, 0.06, 0.06);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_Y;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN_Y;
  };

  const ensureSpace = (lineHeight: number) => {
    if (y - lineHeight < MARGIN_Y) newPage();
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
      page.drawText(drawn, { x: MARGIN_X + indent, y, size, font, color: ink });
      y -= lineHeight;
    });

    y -= spacingAfter;
  }

  return doc.save();
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
  const lines: ReportLine[] = [];

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

  return renderReportLines(lines, fontStyle);
}

// ---------------------------------------------------------------------------
// Templated resume renderer — matches a "Jake's Resume"-style layout:
// centered name/contact, ruled section headers, two-column entry rows
// (org/company + location bold, role/degree + dates italic), bullets,
// and a two-column skills grid.
// ---------------------------------------------------------------------------

type ResumeLine =
  | { kind: "blank" }
  | { kind: "name"; text: string }
  | { kind: "contact"; text: string }
  | { kind: "sectionHeader"; text: string }
  | { kind: "entryBold"; left: string; right: string }
  | { kind: "entryItalic"; left: string; right: string }
  | { kind: "entryTitle"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "skillsPair"; pair: { label: string; items: string }[] }
  | { kind: "body"; text: string };

function isAllCapsHeader(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, "");
  return letters.length >= 2 && letters === letters.toUpperCase() && line.length <= 48;
}

function parseResumeLines(text: string): ResumeLine[] {
  const raw = text.split("\n");
  const out: ResumeLine[] = [];
  let pendingSkills: { label: string; items: string }[] = [];
  let afterBlank = true;

  const flushSkills = () => {
    for (let i = 0; i < pendingSkills.length; i += 2) {
      out.push({ kind: "skillsPair", pair: pendingSkills.slice(i, i + 2) });
    }
    pendingSkills = [];
  };

  raw.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushSkills();
      out.push({ kind: "blank" });
      afterBlank = true;
      return;
    }

    if (index === 0) {
      out.push({ kind: "name", text: line });
      afterBlank = false;
      return;
    }
    if (index === 1) {
      out.push({ kind: "contact", text: line });
      afterBlank = false;
      return;
    }

    if (isAllCapsHeader(line)) {
      flushSkills();
      out.push({ kind: "sectionHeader", text: line });
      afterBlank = false;
      return;
    }

    const bulletMatch = line.match(/^[-•*]\s+(.*)/);
    if (bulletMatch) {
      out.push({ kind: "bullet", text: bulletMatch[1] });
      afterBlank = false;
      return;
    }

    const skillMatch = line.match(/^(.+?)\s*@s\s*(.*)$/);
    if (skillMatch) {
      pendingSkills.push({ label: skillMatch[1].trim(), items: skillMatch[2].trim() });
      afterBlank = false;
      return;
    }
    flushSkills();

    const boldMatch = line.match(/^(.+?)\s*@@\s*(.*)$/);
    if (boldMatch) {
      out.push({ kind: "entryBold", left: boldMatch[1].trim(), right: boldMatch[2].trim() });
      afterBlank = false;
      return;
    }

    const italicMatch = line.match(/^(.+?)\s*@\|\s*(.*)$/);
    if (italicMatch) {
      out.push({ kind: "entryItalic", left: italicMatch[1].trim(), right: italicMatch[2].trim() });
      afterBlank = false;
      return;
    }

    out.push({ kind: afterBlank ? "entryTitle" : "body", text: line });
    afterBlank = false;
  });

  flushSkills();
  return out;
}

export async function renderResumePdf(text: string, fontStyle: FontStyle): Promise<Uint8Array> {
  const fonts = FONT_MAP[fontStyle] ?? FONT_MAP["sans-serif"];
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(fonts.regular);
  const bold = await doc.embedFont(fonts.bold);
  const italic = await doc.embedFont(fonts.italic);
  const ink = rgb(0.06, 0.06, 0.06);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_Y;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN_Y;
  };
  const ensureSpace = (lineHeight: number) => {
    if (y - lineHeight < MARGIN_Y) newPage();
  };

  const drawWrapped = (
    text: string,
    font: PDFFont,
    size: number,
    x: number,
    maxWidth: number,
    lineHeight: number,
    prefix = "",
  ) => {
    const prefixWidth = prefix ? font.widthOfTextAtSize(prefix, size) : 0;
    const wrapped = wrapText(text, font, size, maxWidth - prefixWidth);
    wrapped.forEach((wline, i) => {
      ensureSpace(lineHeight);
      page.drawText(i === 0 ? `${prefix}${wline}` : wline, {
        x: x + (i === 0 ? 0 : prefixWidth),
        y,
        size,
        font,
        color: ink,
      });
      y -= lineHeight;
    });
  };

  const drawRow = (left: string, right: string, font: PDFFont, size: number) => {
    const lineHeight = size * 1.3;
    ensureSpace(lineHeight);
    page.drawText(left, { x: MARGIN_X, y, size, font, color: ink });
    if (right) {
      const rightWidth = font.widthOfTextAtSize(right, size);
      page.drawText(right, { x: PAGE_WIDTH - MARGIN_X - rightWidth, y, size, font, color: ink });
    }
    y -= lineHeight;
  };

  const lines = parseResumeLines(text).map((l) => {
    const clean = (s: string) => sanitizeForPdf(s);
    switch (l.kind) {
      case "name":
      case "contact":
      case "sectionHeader":
      case "entryTitle":
      case "bullet":
      case "body":
        return { ...l, text: clean(l.text) };
      case "entryBold":
      case "entryItalic":
        return { ...l, left: clean(l.left), right: clean(l.right) };
      case "skillsPair":
        return {
          ...l,
          pair: l.pair.map((p) => ({ label: clean(p.label), items: clean(p.items) })),
        };
      default:
        return l;
    }
  });

  for (const line of lines) {
    if (line.kind === "blank") {
      y -= 7;
      continue;
    }

    if (line.kind === "name") {
      const size = 18;
      const lineHeight = size * 1.3;
      ensureSpace(lineHeight);
      const width = bold.widthOfTextAtSize(line.text, size);
      page.drawText(line.text, { x: (PAGE_WIDTH - width) / 2, y, size, font: bold, color: ink });
      y -= lineHeight + 2;
      continue;
    }

    if (line.kind === "contact") {
      const size = 10;
      const lineHeight = size * 1.3;
      ensureSpace(lineHeight);
      const width = regular.widthOfTextAtSize(line.text, size);
      page.drawText(line.text, {
        x: (PAGE_WIDTH - width) / 2,
        y,
        size,
        font: regular,
        color: ink,
      });
      y -= lineHeight + 6;
      continue;
    }

    if (line.kind === "sectionHeader") {
      const size = 11;
      const lineHeight = size * 1.3;
      y -= 4;
      ensureSpace(lineHeight);
      page.drawText(line.text, { x: MARGIN_X, y, size, font: bold, color: ink });
      page.drawLine({
        start: { x: MARGIN_X, y: y - 2 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: y - 2 },
        thickness: 0.75,
        color: ink,
      });
      y -= lineHeight + 2;
      continue;
    }

    if (line.kind === "entryBold") {
      drawRow(line.left, line.right, bold, 10.5);
      continue;
    }

    if (line.kind === "entryItalic") {
      drawRow(line.left, line.right, italic, 10.5);
      y -= 1;
      continue;
    }

    if (line.kind === "entryTitle") {
      drawWrapped(line.text, bold, 10.5, MARGIN_X, CONTENT_WIDTH, 10.5 * 1.3);
      continue;
    }

    if (line.kind === "bullet") {
      const size = 10.5;
      drawWrapped(
        line.text,
        regular,
        size,
        MARGIN_X + 14,
        CONTENT_WIDTH - 14,
        size * 1.3,
        "•  ",
      );
      continue;
    }

    if (line.kind === "skillsPair") {
      const size = 10;
      const lineHeight = size * 1.3;
      const halfWidth = CONTENT_WIDTH / 2 - 8;
      const columnLines = line.pair.map((p) => {
        const combined = p.items ? `${p.label} ${p.items}` : p.label;
        return wrapText(combined, regular, size, halfWidth);
      });
      const rows = Math.max(...columnLines.map((c) => c.length), 1);
      ensureSpace(rows * lineHeight);
      for (let r = 0; r < rows; r++) {
        line.pair.forEach((p, col) => {
          const wline = columnLines[col]?.[r];
          if (wline === undefined) return;
          const x = MARGIN_X + col * (CONTENT_WIDTH / 2 + 8);
          if (r === 0) {
            const labelWithSpace = `${p.label} `;
            const labelWidth = bold.widthOfTextAtSize(labelWithSpace, size);
            page.drawText(labelWithSpace, { x, y, size, font: bold, color: ink });
            const rest = wline.slice(p.label.length).trimStart();
            page.drawText(rest, { x: x + labelWidth, y, size, font: regular, color: ink });
          } else {
            page.drawText(wline, { x, y, size, font: regular, color: ink });
          }
        });
        y -= lineHeight;
      }
      continue;
    }

    if (line.kind === "body") {
      drawWrapped(line.text, regular, 10.5, MARGIN_X, CONTENT_WIDTH, 10.5 * 1.3);
      continue;
    }
  }

  return doc.save();
}
