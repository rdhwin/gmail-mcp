import { env } from "cloudflare:workers";
import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { getGoogleAuthorizeUrl, fetchGoogleToken, fetchUserEmail } from "./google-oauth";
import type { Props } from "./types";
import {
  addApprovedClient,
  bindStateToSession,
  createOAuthState,
  generateCSRFProtection,
  isClientApproved,
  OAuthError,
  renderApprovalDialog,
  validateCSRFToken,
  validateOAuthState,
} from "./workers-oauth-utils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

// GET /authorize — show approval dialog or redirect straight to Google if already approved
app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const { clientId } = oauthReqInfo;
  if (!clientId) return c.text("Invalid request", 400);

  if (await isClientApproved(c.req.raw, clientId, env.COOKIE_ENCRYPTION_KEY)) {
    const { stateToken } = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV);
    const { setCookie: sessionCookie } = await bindStateToSession(stateToken);
    return redirectToGoogle(c.req.raw, stateToken, { "Set-Cookie": sessionCookie });
  }

  const { token: csrfToken, setCookie } = generateCSRFProtection();

  return renderApprovalDialog(c.req.raw, {
    client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
    csrfToken,
    server: {
      name: "Gmail MCP Server",
      description: "Connect your AI assistant to your Gmail account.",
    },
    setCookie,
    state: { oauthReqInfo },
  });
});

// POST /authorize — user clicked Approve, redirect to Google OAuth
app.post("/authorize", async (c) => {
  try {
    const formData = await c.req.raw.formData();
    validateCSRFToken(formData, c.req.raw);

    const encodedState = formData.get("state");
    if (!encodedState || typeof encodedState !== "string") return c.text("Missing state", 400);

    let state: { oauthReqInfo?: AuthRequest };
    try {
      state = JSON.parse(atob(encodedState));
    } catch {
      return c.text("Invalid state data", 400);
    }

    if (!state.oauthReqInfo?.clientId) return c.text("Invalid request", 400);

    const approvedCookie = await addApprovedClient(
      c.req.raw,
      state.oauthReqInfo.clientId,
      c.env.COOKIE_ENCRYPTION_KEY,
    );

    const { stateToken } = await createOAuthState(state.oauthReqInfo, c.env.OAUTH_KV);
    const { setCookie: sessionCookie } = await bindStateToSession(stateToken);

    const headers = new Headers();
    headers.append("Set-Cookie", approvedCookie);
    headers.append("Set-Cookie", sessionCookie);

    return redirectToGoogle(c.req.raw, stateToken, Object.fromEntries(headers));
  } catch (error: any) {
    if (error instanceof OAuthError) return error.toResponse();
    return c.text(`Internal server error: ${error.message}`, 500);
  }
});

// GET /callback — Google redirects here after user authorizes
app.get("/callback", async (c) => {
  let oauthReqInfo: AuthRequest;
  let clearSessionCookie: string;

  try {
    const result = await validateOAuthState(c.req.raw, c.env.OAUTH_KV);
    oauthReqInfo = result.oauthReqInfo;
    clearSessionCookie = result.clearCookie;
  } catch (error: any) {
    if (error instanceof OAuthError) return error.toResponse();
    return c.text("Internal server error", 500);
  }

  if (!oauthReqInfo.clientId) return c.text("Invalid OAuth request data", 400);

  // Exchange auth code for Google access + refresh tokens
  const [tokenData, errResponse] = await fetchGoogleToken({
    clientId: c.env.GOOGLE_CLIENT_ID,
    clientSecret: c.env.GOOGLE_CLIENT_SECRET,
    code: c.req.query("code"),
    redirectUri: new URL("/callback", c.req.url).href,
  });
  if (errResponse) return errResponse;

  // Get user's email for identification
  const email = await fetchUserEmail(tokenData.access_token);

  // Complete the MCP OAuth flow — issue our own token to the MCP client
  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: email,
    metadata: {
      label: email,
    },
    scope: oauthReqInfo.scope,
    props: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || "",
      email,
    } satisfies Props,
  });

  const headers = new Headers({ Location: redirectTo });
  if (clearSessionCookie) headers.set("Set-Cookie", clearSessionCookie);

  return new Response(null, { status: 302, headers });
});

function redirectToGoogle(
  request: Request,
  stateToken: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(null, {
    status: 302,
    headers: {
      ...extraHeaders,
      Location: getGoogleAuthorizeUrl({
        clientId: env.GOOGLE_CLIENT_ID,
        redirectUri: new URL("/callback", request.url).href,
        state: stateToken,
      }),
    },
  });
}

export { app as GmailHandler };
