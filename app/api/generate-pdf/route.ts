import { NextRequest, NextResponse } from "next/server";
import { renderResumePdf, renderReportPdf, type FontStyle } from "@/lib/pdf-resume";

const VALID_STYLES: FontStyle[] = ["serif", "sans-serif", "monospace"];

export async function POST(req: NextRequest) {
  const { text, fontStyle, kind } = (await req.json()) as {
    text?: string;
    fontStyle?: string;
    kind?: string;
  };

  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  const style = VALID_STYLES.includes(fontStyle as FontStyle)
    ? (fontStyle as FontStyle)
    : "sans-serif";
  const isReport = kind === "report";

  try {
    const pdfBytes = isReport
      ? await renderReportPdf(text, style)
      : await renderResumePdf(text, style);
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${isReport ? "analysis" : "resume"}.pdf"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Couldn't generate the PDF." }, { status: 500 });
  }
}
