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

function isHeaderLine(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, "");
  return letters.length >= 2 && letters === letters.toUpperCase() && line.length <= 48;
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

export async function renderResumePdf(text: string, fontStyle: FontStyle): Promise<Uint8Array> {
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

  const lines = text.split("\n");

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      y -= 8;
      return;
    }

    const isName = index === 0;
    const isBullet = /^[-•*]\s+/.test(line);
    const header = !isName && !isBullet && isHeaderLine(line);

    let font = regular;
    let size = 10.5;
    let indent = 0;
    let spacingBefore = 0;
    let spacingAfter = 2;

    if (isName) {
      font = bold;
      size = 16;
      spacingAfter = 4;
    } else if (header) {
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
    const content = isBullet ? line.replace(/^[-•*]\s+/, "") : line;
    const prefixWidth = isBullet ? font.widthOfTextAtSize(bulletPrefix, size) : 0;
    const wrapped = wrapText(content, font, size, CONTENT_WIDTH - indent - prefixWidth);

    wrapped.forEach((wline, i) => {
      ensureSpace(lineHeight);
      const drawn = isBullet && i === 0 ? `${bulletPrefix}${wline}` : wline;
      page.drawText(drawn, { x: MARGIN + indent, y, size, font, color: ink });
      y -= lineHeight;
    });

    y -= spacingAfter;
  });

  return doc.save();
}
