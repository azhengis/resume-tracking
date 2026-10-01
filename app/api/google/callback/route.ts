import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google";
import { db, ensureSchema } from "@/lib/db";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?google=error", req.nextUrl.origin));
  }

  const redirectUri = `${req.nextUrl.origin}/api/google/callback`;
  const client = getOAuthClient(redirectUri);

  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      // Google only issues a refresh token on first consent for an app;
      // prompt=consent on the auth URL should always force a fresh one.
      return NextResponse.redirect(new URL("/?google=error", req.nextUrl.origin));
    }

    await ensureSchema();
    const sql = db();
    await sql`INSERT INTO profile (key, value) VALUES ('googleRefreshToken', ${tokens.refresh_token})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;

    return NextResponse.redirect(new URL("/?google=connected", req.nextUrl.origin));
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(new URL("/?google=error", req.nextUrl.origin));
  }
}
