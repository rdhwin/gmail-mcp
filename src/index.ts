import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { GmailHandler } from "./gmail-handler";
import { refreshAccessToken } from "./google-oauth";
import type { Props } from "./types";
import { createTools } from "./tools/index";

export class GmailMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer({
    name: "gmail-mcp",
    version: "1.0.0",
  });

  async init() {
    const props = this.props!;
    const env = this.env;

    const getToken = async () => {
      // Always refresh to get a valid access token
      if (props.refreshToken) {
        return refreshAccessToken({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          refreshToken: props.refreshToken,
        });
      }
      return props.accessToken;
    };

    this.server.tool(
      "whoami",
      "Returns the email address of the authenticated Gmail account.",
      {},
      async () => ({
        content: [{ type: "text", text: props.email }],
      }),
    );

    createTools(this.server, getToken, props.email);
  }
}

const oauthProvider = new OAuthProvider({
  apiHandler: GmailMCP.serve("/mcp"),
  apiRoute: "/mcp",
  defaultHandler: GmailHandler as any,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // RFC 9728 Protected Resource Metadata
    if (url.pathname === "/.well-known/oauth-protected-resource") {
      const origin = url.origin;
      return new Response(
        JSON.stringify({
          resource: `${origin}/mcp`,
          authorization_servers: [origin],
          scopes_supported: [],
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    return (oauthProvider as any).fetch(request, env, ctx);
  },
};
