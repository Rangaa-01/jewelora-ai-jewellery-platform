import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap gate for the admin area: without a session cookie there is no point rendering
 * the dashboard shell, so send the visitor to sign in. Authorisation (roles) is checked
 * by the backend on every admin API call and by the shell after `GET /auth/me`.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  const hasSession =
    request.cookies.has("access_token") || request.cookies.has("refresh_token");
  if (hasSession) return NextResponse.next();
  const login = new URL("/account/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  login.searchParams.set("reason", "staff");
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/admin"],
};
