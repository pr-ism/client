import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/setup', '/projects'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = request.cookies.get('prism_access_token')?.value;
  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/?requires_login=true', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/setup/:path*', '/projects/:path*'],
};
