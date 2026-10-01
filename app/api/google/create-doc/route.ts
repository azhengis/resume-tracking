import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, buildCreateDocRequests } from "@/lib/google";
import { db, ensureSchema } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { text, company } = (await req.json()) as { text?: string; company?: string };
  if (!text?.trim()) {
    return NextResponse.json({ error: "No resume text provided." }, { status: 400 });
  }

  await ensureSchema();
  const sql = db();
  const rows = (await sql`SELECT value FROM profile WHERE key = 'googleRefreshToken'`) as {
    value: string;
  }[];
  const refreshToken = rows[0]?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "Google isn't connected yet." }, { status: 401 });
  }

  const redirectUri = `${req.nextUrl.origin}/api/google/callback`;
  const client = getOAuthClient(redirectUri);
  client.setCredentials({ refresh_token: refreshToken });

  const docs = google.docs({ version: "v1", auth: client });

  try {
    const name = text.split("\n")[0]?.trim() || "Resume";
    const title = company?.trim() ? `${name} Resume - ${company.trim()}` : `${name} Resume`;

    const created = await docs.documents.create({ requestBody: { title } });
    const documentId = created.data.documentId;
    if (!documentId) throw new Error("Google didn't return a document id.");

    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests: buildCreateDocRequests(text) },
    });

    return NextResponse.json({
      url: `https://docs.google.com/document/d/${documentId}/edit`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Couldn't create the Google Doc." }, { status: 500 });
  }
}
