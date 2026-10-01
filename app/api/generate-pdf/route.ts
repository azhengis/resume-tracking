import { NextRequest, NextResponse } from "next/server";
import { renderResumePdf, renderReportPdf, type FontStyle } from "@/lib/pdf-resume";

const VALID_STYLES: FontStyle[] = ["serif", "sans-serif", "monospace"];

export async function POST(req: NextRequest) {
  const { text, fontStyle, kind, company } = (await req.json()) as {
    text?: string;
    fontStyle?: string;
    kind?: string;
    company?: string;
  };

  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  const style = VALID_STYLES.includes(fontStyle as FontStyle)
    ? (fontStyle as FontStyle)
    : "sans-serif";
  const isReport = kind === "report";

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${isReport ? "analysis" : "resume"}.pdf"`,
    };

    let pdfBytes: Uint8Array;
    if (isReport) {
      pdfBytes = await renderReportPdf(text, style);
    } else {
      const result = await renderResumePdf(text, style, company?.trim() || undefined);
      pdfBytes = result.bytes;
      headers["X-Page-Count"] = String(result.pageCount);
      headers["Access-Control-Expose-Headers"] = "X-Page-Count";
    }

    return new NextResponse(Buffer.from(pdfBytes), { headers });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Couldn't generate the PDF." }, { status: 500 });
  }
}
