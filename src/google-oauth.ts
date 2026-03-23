/**
 * Google OAuth URL builder and token exchange.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getGoogleAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state?: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  if (opts.state) url.searchParams.set("state", opts.state);
  return url.href;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function fetchGoogleToken(opts: {
  clientId: string;
  clientSecret: string;
  code: string | undefined;
  redirectUri: string;
}): Promise<[GoogleTokenResponse, null] | [null, Response]> {
  const { clientId, clientSecret, code, redirectUri } = opts;
  if (!code) {
    return [null, new Response("Missing code", { status: 400 })];
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Google token exchange failed:", text);
    return [null, new Response("Failed to exchange code for token", { status: 500 })];
  }

  const data = (await resp.json()) as GoogleTokenResponse;

  if (!data.access_token) {
    return [null, new Response("Missing access_token in Google response", { status: 500 })];
  }

  return [data, null];
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const resp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) return "unknown";
  const data = (await resp.json()) as { email?: string };
  return data.email || "unknown";
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      refresh_token: opts.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to refresh access token: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as { access_token: string };
  return data.access_token;
}
