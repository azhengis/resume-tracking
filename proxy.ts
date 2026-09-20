import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, hashToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  // No password configured (e.g. plain local dev) — leave the app open.
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = await hashToken(password);
  if (cookie === expected) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico).*)"],
};
