/**
 * One-time OAuth flow to get a Google refresh token.
 *
 * Usage:
 *   1. Create OAuth credentials in Google Cloud Console (Desktop app type)
 *   2. Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .dev.vars
 *   3. Run: npm run auth
 *   4. Follow the browser prompt, then copy the refresh token
 *   5. Run: wrangler secret put GOOGLE_REFRESH_TOKEN
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";

function loadDevVars(): Record<string, string> {
  const varsPath = path.resolve(process.cwd(), ".dev.vars");
  if (!fs.existsSync(varsPath)) return {};
  const content = fs.readFileSync(varsPath, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    vars[key] = val;
  }
  return vars;
}

const devVars = loadDevVars();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || devVars.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || devVars.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = "http://localhost:3000/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.labels",
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not found.\n" +
      "Set them in .dev.vars or as environment variables."
  );
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES.join(" "));
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:3000`);

  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("Missing authorization code");
      return;
    }

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const data = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        error?: string;
        error_description?: string;
      };

      if (data.error) {
        res.writeHead(400);
        res.end(`Error: ${data.error} - ${data.error_description}`);
        server.close();
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>Success!</h1><p>You can close this tab. Check your terminal for the refresh token.</p>");

      console.log("\n=== OAuth Tokens ===");
      console.log(`Access Token:  ${data.access_token}`);
      console.log(`Refresh Token: ${data.refresh_token}`);
      console.log("\n=== Next Steps ===");
      console.log("Store your secrets with wrangler:");
      console.log(`  wrangler secret put GOOGLE_CLIENT_ID`);
      console.log(`  wrangler secret put GOOGLE_CLIENT_SECRET`);
      console.log(`  wrangler secret put GOOGLE_REFRESH_TOKEN`);
      console.log("\nFor local dev, copy .dev.vars.example to .dev.vars and fill in the values.");

      server.close();
    } catch (err) {
      res.writeHead(500);
      res.end(`Token exchange failed: ${err}`);
      server.close();
    }
  } else {
    res.writeHead(302, { Location: authUrl.toString() });
    res.end();
  }
});

server.listen(3000, () => {
  console.log("Open this URL in your browser to authorize:");
  console.log(`  http://localhost:3000`);
  console.log("\n(Or directly: " + authUrl.toString() + ")");
});
