import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefixes = ["/customer", "/shop-owner", "/select-role"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("firebase-session")?.value);

  const needsAuth = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (needsAuth && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/customer/:path*", "/shop-owner/:path*", "/select-role"],
};
