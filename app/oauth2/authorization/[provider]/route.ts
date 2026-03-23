import { NextRequest, NextResponse } from 'next/server';

const VALID_PROVIDERS = ['kakao', 'google', 'github'] as const;
const BACKEND_URL = process.env.NEXT_PUBLIC_STATS_SERVER_URL ?? 'http://localhost:8081';

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { provider } = params;

  if (!VALID_PROVIDERS.includes(provider as any)) {
    const errorUrl = new URL('/?login_error=unsupported_provider', req.url);
    return NextResponse.redirect(errorUrl);
  }

  const backendUrl = `${BACKEND_URL}/oauth2/authorization/${provider}`;

  let backendResponse: Response;
  try {
    backendResponse = await fetch(backendUrl, {
      redirect: 'manual',
    });
  } catch {
    const errorUrl = new URL('/?login_error=network', req.url);
    return NextResponse.redirect(errorUrl);
  }

  const location = backendResponse.headers.get('location');
  if (location) {
    return NextResponse.redirect(location);
  }

  const errorUrl = new URL('/?login_error=server', req.url);
  return NextResponse.redirect(errorUrl);
}
