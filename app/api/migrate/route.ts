import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { insertEntry, type EntryInput } from "@/lib/tracker";

interface MigratePayload {
  resume?: string;
  resumeFont?: string;
  aboutMe?: string;
  entries?: EntryInput[];
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as MigratePayload;
  await ensureSchema();
  const sql = db();

  const profileUpdates: [string, string | undefined][] = [
    ["resume", body.resume],
    ["resumeFont", body.resumeFont],
    ["aboutMe", body.aboutMe],
  ];
  for (const [key, value] of profileUpdates) {
    if (typeof value !== "string") continue;
    await sql`INSERT INTO profile (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }

  const entries = Array.isArray(body.entries) ? body.entries : [];
  for (const entry of entries) {
    await insertEntry(entry);
  }

  return NextResponse.json({ ok: true, migratedEntries: entries.length });
}
