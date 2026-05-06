import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = new Set(["/login"]);
const ALWAYS_ALLOWED_PATHS = new Set(["/api/sync-from-bridge"]);
const ALWAYS_ALLOWED_PREFIXES = ["/api/auth", "/_next/static", "/_next/image"];

function isAlwaysAllowed(pathname: string): boolean {
  if (ALWAYS_ALLOWED_PATHS.has(pathname)) {
    return true;
  }

  if (pathname === "/favicon.ico") {
    return true;
  }

  return ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isAlwaysAllowed(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = Boolean(token);
  const isPublic = isPublicPath(pathname);

  if (!isAuthenticated && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    const callbackUrl = `${pathname}${search}`;
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
