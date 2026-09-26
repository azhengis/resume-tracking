import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

const ALLOWED_KEYS = new Set(["resume", "resumeFont", "aboutMe"]);

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  await ensureSchema();
  const sql = db();

  const updates = Object.entries(body).filter(
    ([key, value]) => ALLOWED_KEYS.has(key) && typeof value === "string",
  ) as [string, string][];

  for (const [key, value] of updates) {
    await sql`INSERT INTO profile (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }

  return NextResponse.json({ ok: true });
}
