import { NextRequest, NextResponse } from "next/server";
import { insertEntry, type EntryInput } from "@/lib/tracker";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as EntryInput;
  if (!body.id || !body.company) {
    return NextResponse.json({ error: "Missing id or company." }, { status: 400 });
  }
  try {
    const entry = await insertEntry(body);
    return NextResponse.json(entry);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Couldn't save the entry." }, { status: 500 });
  }
}
