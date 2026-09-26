import { NextResponse } from "next/server";
import { db, ensureSchema, rowToEntry, type TrackerRow } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  const sql = db();

  const [profileRows, entryRows] = await Promise.all([
    sql`SELECT key, value FROM profile`,
    sql`SELECT * FROM tracker_entries ORDER BY date_added DESC`,
  ]);

  const profile: Record<string, string> = {};
  for (const row of profileRows as { key: string; value: string }[]) {
    profile[row.key] = row.value;
  }

  return NextResponse.json({
    resume: profile.resume ?? "",
    resumeFont: profile.resumeFont ?? "sans-serif",
    aboutMe: profile.aboutMe ?? "",
    entries: (entryRows as TrackerRow[]).map(rowToEntry),
  });
}
