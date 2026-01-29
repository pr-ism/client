import { NextRequest, NextResponse } from 'next/server';

const VALID_PROVIDERS = ['kakao', 'google'] as const;
const BACKEND_INFO = process.env.NEXT_PUBLIC_STATS_SERVER_URL ?? 'http://localhost:8081';
const SETUP_PATH = process.env.NEXT_PUBLIC_SETUP_PATH ?? '/setup';

function buildBackendUrl(provider: string, search: string) {
  const backendUrl = new URL(`${BACKEND_INFO}/login/oauth2/code/${provider}`);
  backendUrl.search = search;
  return backendUrl;
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  req.headers.forEach((value, key) => {
    const normalized = key.toLowerCase();

    if (normalized === 'host') {
      headers.set('x-forwarded-host', value);
      return;
    }

    if (normalized === 'x-forwarded-for' || normalized === 'x-forwarded-proto') {
      return;
    }

    headers.set(key, value);
  });

  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  headers.set('x-forwarded-proto', proto);

  return headers;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { provider } = params;

  if (!VALID_PROVIDERS.includes(provider as any)) {
    return NextResponse.json({ message: '지원하지 않는 인증 제공자입니다.' }, { status: 400 });
  }

  const backendUrl = buildBackendUrl(provider, req.nextUrl.search);

  const backendResponse = await fetch(backendUrl.toString(), {
    method: 'GET',
    headers: forwardHeaders(req),
    redirect: 'manual'
  });

  if (!backendResponse.ok) {
    const contentType = backendResponse.headers.get('content-type') ?? 'text/plain';
    const body = await backendResponse.text();
    return new NextResponse(body, {
      status: backendResponse.status,
      headers: { 'Content-Type': contentType }
    });
  }

  const bodyText = await backendResponse.text();
  let body: { authorization?: string; accessToken?: string } | null = null;

  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = null;
    }
  }

  const redirectUrl = new URL(SETUP_PATH, req.url);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set('prism_show_setup', '1', {
    path: '/',
    maxAge: 60,
    sameSite: 'lax'
  });

  backendResponse.headers.forEach((value, name) => {
    if (name.toLowerCase() === 'set-cookie') {
      response.headers.append('Set-Cookie', value);
    }
  });

  const bearer = body?.authorization ?? body?.accessToken;
  if (bearer) {
    response.cookies.set('prism_access_token', bearer, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: true
    });
  }

  return response;
}
