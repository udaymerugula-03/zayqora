import {NextRequest, NextResponse} from "next/server";
export function proxy(request: NextRequest) {
  const origin = process.env.API_ORIGIN || "http://127.0.0.1:8086";
  return NextResponse.rewrite(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, origin));
}
export const config = {matcher: ["/api/v1/:path*", "/media/:path*"]};
