import { db, ensureSchema, rowToEntry, type TrackerRow } from "@/lib/db";
import { uploadDataUrlToBlob } from "@/lib/blob";
import type { TrackerEntry } from "@/lib/types";

export type EntryInput = Omit<TrackerEntry, "resumePdf" | "reportPdf"> & {
  resumePdf?: string | null;
  reportPdf?: string | null;
};

async function resolvePdfField(
  value: string | null | undefined,
  pathname: string,
): Promise<string | undefined> {
  if (!value) return undefined;
  if (value.startsWith("data:")) return uploadDataUrlToBlob(value, pathname);
  return value; // already a real URL (e.g. re-migrating an already-hosted entry)
}

/** Inserts a tracker entry, or overwrites one with the same id (used by migration). */
export async function insertEntry(input: EntryInput): Promise<TrackerEntry> {
  await ensureSchema();
  const sql = db();

  const [resumePdf, reportPdf] = await Promise.all([
    resolvePdfField(input.resumePdf, `resumes/${input.id}.pdf`),
    resolvePdfField(input.reportPdf, `reports/${input.id}.pdf`),
  ]);

  const rows = await sql`
    INSERT INTO tracker_entries
      (id, company, job_title, link, status, date_added, job_description, resume_used, report, notes, resume_pdf_url, report_pdf_url)
    VALUES
      (${input.id}, ${input.company}, ${input.jobTitle}, ${input.link}, ${input.status}, ${input.dateAdded},
       ${input.jobDescription}, ${input.resumeUsed}, ${input.report}, ${input.notes}, ${resumePdf ?? null}, ${reportPdf ?? null})
    ON CONFLICT (id) DO UPDATE SET
      company = EXCLUDED.company,
      job_title = EXCLUDED.job_title,
      link = EXCLUDED.link,
      status = EXCLUDED.status,
      date_added = EXCLUDED.date_added,
      job_description = EXCLUDED.job_description,
      resume_used = EXCLUDED.resume_used,
      report = EXCLUDED.report,
      notes = EXCLUDED.notes,
      resume_pdf_url = COALESCE(EXCLUDED.resume_pdf_url, tracker_entries.resume_pdf_url),
      report_pdf_url = COALESCE(EXCLUDED.report_pdf_url, tracker_entries.report_pdf_url)
    RETURNING *
  `;

  return rowToEntry((rows as TrackerRow[])[0]);
}
