import { neon } from "@neondatabase/serverless";
import type { TrackerEntry, TrackerStatus } from "@/lib/types";

let sqlClient: ReturnType<typeof neon> | null = null;
let schemaReady: Promise<void> | null = null;

export function db() {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL!);
  return sqlClient;
}

export function ensureSchema() {
  if (!schemaReady) {
    const sql = db();
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS profile (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tracker_entries (
        id TEXT PRIMARY KEY,
        company TEXT NOT NULL DEFAULT '',
        job_title TEXT NOT NULL DEFAULT '',
        link TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Evaluated',
        date_added TIMESTAMPTZ NOT NULL DEFAULT now(),
        job_description TEXT NOT NULL DEFAULT '',
        resume_used TEXT NOT NULL DEFAULT '',
        report TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        resume_pdf_url TEXT,
        report_pdf_url TEXT
      )`;
    })();
  }
  return schemaReady;
}

export interface TrackerRow {
  id: string;
  company: string;
  job_title: string;
  link: string;
  status: string;
  date_added: string | Date;
  job_description: string;
  resume_used: string;
  report: string;
  notes: string;
  resume_pdf_url: string | null;
  report_pdf_url: string | null;
}

export function rowToEntry(row: TrackerRow): TrackerEntry {
  return {
    id: row.id,
    company: row.company,
    jobTitle: row.job_title,
    link: row.link,
    status: row.status as TrackerStatus,
    dateAdded: new Date(row.date_added).toISOString(),
    jobDescription: row.job_description,
    resumeUsed: row.resume_used,
    report: row.report,
    notes: row.notes,
    resumePdf: row.resume_pdf_url ?? undefined,
    reportPdf: row.report_pdf_url ?? undefined,
  };
}
