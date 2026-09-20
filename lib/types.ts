export type TrackerStatus =
  | "Evaluated"
  | "Applied"
  | "Interviewing"
  | "Offer"
  | "Rejected"
  | "Withdrawn";

export const TRACKER_STATUSES: TrackerStatus[] = [
  "Evaluated",
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
  "Withdrawn",
];

export interface TrackerEntry {
  id: string;
  company: string;
  jobTitle: string;
  link: string;
  status: TrackerStatus;
  dateAdded: string; // ISO date
  jobDescription: string;
  resumeUsed: string;
  report: string;
  notes: string;
}
