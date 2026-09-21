import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import type { FontStyle } from "@/lib/pdf-resume";

function categorize(fontFamily: string): FontStyle {
  const f = fontFamily.toLowerCase();
  if (f.includes("monospace")) return "monospace";
  if (f.includes("sans-serif")) return "sans-serif";
  if (f.includes("serif")) return "serif";
  return "sans-serif";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: true });

    const tally: Record<FontStyle, number> = { serif: 0, "sans-serif": 0, monospace: 0 };
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const style = content.styles[item.fontName];
        const category = categorize(style?.fontFamily ?? "sans-serif");
        tally[category] += item.str.length;
      }
    }
    const fontStyle = (Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "sans-serif") as FontStyle;

    return NextResponse.json({ text: text.trim(), fontStyle });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Couldn't read that PDF." }, { status: 400 });
  }
}
