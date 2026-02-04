const STATS_SERVER = process.env.NEXT_PUBLIC_STATS_SERVER_URL ?? 'http://localhost:8081';

function getAccessToken(): string {
  const match = document.cookie
    .split(';')
    .map((e) => e.trim())
    .find((e) => e.startsWith('prism_access_token='));

  if (!match) return '';
  const [, ...parts] = match.split('=');
  const raw = parts.join('=');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function setAccessToken(token: string) {
  document.cookie = `prism_access_token=${encodeURIComponent(token)}; path=/; SameSite=Lax; Secure`;
}

function clearAccessToken() {
  document.cookie = 'prism_access_token=; path=/; max-age=0';
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      console.log('[fetchWithAuth] Attempting to refresh token...');
      const res = await fetch(`${STATS_SERVER}/refresh-token`, {
        method: 'POST',
        credentials: 'include',
      });

      console.log('[fetchWithAuth] Refresh response status:', res.status);

      if (!res.ok) {
        console.error('[fetchWithAuth] Refresh failed with status:', res.status);
        const errorText = await res.text().catch(() => 'Unable to read error');
        console.error('[fetchWithAuth] Refresh error body:', errorText);
        return false;
      }

      const body: { authorization?: string } = await res.json();
      if (body.authorization) {
        console.log('[fetchWithAuth] Refresh successful, new token received');
        setAccessToken(body.authorization);
        return true;
      }
      console.warn('[fetchWithAuth] Refresh response missing authorization field');
      return false;
    } catch (error) {
      console.error('[fetchWithAuth] Refresh exception:', error);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${STATS_SERVER}${path}`;

  const doFetch = () => {
    const token = getAccessToken();
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', token);
    headers.set('Content-Type', 'application/json');

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  let res = await doFetch();

  if (res.status === 401) {
    console.log('[fetchWithAuth] Received 401, attempting token refresh...');
    const refreshed = await tryRefresh();
    if (refreshed) {
      console.log('[fetchWithAuth] Token refreshed successfully, retrying request...');
      res = await doFetch();
    } else {
      console.error('[fetchWithAuth] Token refresh failed, redirecting to login...');
      clearAccessToken();
      window.location.href = '/?session_expired=true';
    }
  }

  return res;
}
