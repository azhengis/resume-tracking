import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

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
    return NextResponse.json({ text: text.trim() });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Couldn't read that PDF." }, { status: 400 });
  }
}
