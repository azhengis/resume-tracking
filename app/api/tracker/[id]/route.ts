import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema, rowToEntry, type TrackerRow } from "@/lib/db";
import { uploadDataUrlToBlob, deleteBlob } from "@/lib/blob";

interface Patch {
  status?: string;
  notes?: string;
  resumeUsed?: string;
  resumePdf?: string;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patch = (await req.json()) as Patch;
  await ensureSchema();
  const sql = db();

  const resumePdfUrl = patch.resumePdf?.startsWith("data:")
    ? await uploadDataUrlToBlob(patch.resumePdf, `resumes/${id}.pdf`)
    : undefined;

  const rows = await sql`
    UPDATE tracker_entries SET
      status = COALESCE(${patch.status ?? null}, status),
      notes = COALESCE(${patch.notes ?? null}, notes),
      resume_used = COALESCE(${patch.resumeUsed ?? null}, resume_used),
      resume_pdf_url = COALESCE(${resumePdfUrl ?? null}, resume_pdf_url)
    WHERE id = ${id}
    RETURNING *
  `;

  const row = (rows as TrackerRow[])[0];
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(rowToEntry(row));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const sql = db();

  const rows = await sql`
    DELETE FROM tracker_entries WHERE id = ${id}
    RETURNING resume_pdf_url, report_pdf_url
  `;
  const row = (rows as { resume_pdf_url: string | null; report_pdf_url: string | null }[])[0];
  if (row) {
    await Promise.all([deleteBlob(row.resume_pdf_url), deleteBlob(row.report_pdf_url)]);
  }
  return NextResponse.json({ ok: true });
}
