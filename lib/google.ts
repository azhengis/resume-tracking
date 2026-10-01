import { google } from "googleapis";
import { parseResumeLines, type ResumeLine } from "@/lib/pdf-resume";

const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
];

export function getOAuthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );
}

export function getAuthUrl(redirectUri: string) {
  return getOAuthClient(redirectUri).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

interface FormatRun {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
}

// Converts the resume's plain-text convention (the same one pdf-resume.ts
// renders from) into a flat string plus bold/italic character ranges, so a
// Google Doc built from it reads like a real resume, not a markup dump.
function buildDocContent(text: string): { plainText: string; runs: FormatRun[] } {
  const lines = parseResumeLines(text);
  let out = "";
  const runs: FormatRun[] = [];

  function append(segment: string, opts?: { bold?: boolean; italic?: boolean }) {
    const start = out.length;
    out += segment;
    if (opts?.bold || opts?.italic) {
      runs.push({ start, end: out.length, bold: opts.bold, italic: opts.italic });
    }
  }

  lines.forEach((line: ResumeLine) => {
    switch (line.kind) {
      case "blank":
        out += "\n";
        return;
      case "name":
        append(line.text, { bold: true });
        out += "\n";
        return;
      case "contact":
        append(line.text);
        out += "\n";
        return;
      case "sectionHeader":
        append(line.text.toUpperCase(), { bold: true });
        out += "\n";
        return;
      case "entryBold":
        append(line.left, { bold: true });
        if (line.right) append(`   ${line.right}`, { bold: true });
        out += "\n";
        return;
      case "entryItalic":
        append(line.left, { italic: true });
        if (line.right) append(`   ${line.right}`, { italic: true });
        out += "\n";
        return;
      case "entryTitle":
        append(line.text, { bold: true });
        out += "\n";
        return;
      case "bullet":
        out += `• ${line.text}\n`;
        return;
      case "skillsPair":
        line.pair.forEach((p) => {
          append(`${p.label}: `, { bold: true });
          out += `${p.items}\n`;
        });
        return;
      case "body":
        out += `${line.text}\n`;
        return;
    }
  });

  return { plainText: out, runs };
}

export function buildCreateDocRequests(text: string) {
  const { plainText, runs } = buildDocContent(text);
  // Docs bodies start at index 1; every offset shifts by that much.
  const requests: object[] = [{ insertText: { location: { index: 1 }, text: plainText } }];
  for (const run of runs) {
    requests.push({
      updateTextStyle: {
        range: { startIndex: run.start + 1, endIndex: run.end + 1 },
        textStyle: { bold: !!run.bold, italic: !!run.italic },
        fields: [run.bold ? "bold" : null, run.italic ? "italic" : null]
          .filter(Boolean)
          .join(","),
      },
    });
  }
  return requests;
}
