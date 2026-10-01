import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";

export async function GET(req: NextRequest) {
  const redirectUri = `${req.nextUrl.origin}/api/google/callback`;
  return NextResponse.redirect(getAuthUrl(redirectUri));
}
