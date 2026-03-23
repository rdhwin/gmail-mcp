import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listMessages, getMessage } from "../gmail.js";
import { accountParam, checkAccount } from "./account-check.js";

export function registerSearchTool(server: McpServer, getToken: () => Promise<string>, email: string) {
  server.tool(
    "search_emails",
    "Search emails using Gmail query syntax. Returns message summaries.",
    {
      ...accountParam,
      query: z.string().describe("Gmail search query (same syntax as Gmail search box)"),
      maxResults: z.number().min(1).max(50).default(10).describe("Maximum number of results to return"),
    },
    async ({ email: inputEmail, query, maxResults }) => {
      const err = checkAccount(inputEmail, email);
      if (err) return err;

      const token = await getToken();
      const list = await listMessages(token, query, maxResults);

      if (!list.messages || list.messages.length === 0) {
        return { content: [{ type: "text", text: JSON.stringify({ results: [] }) }] };
      }

      const messages = await Promise.all(
        list.messages.map((m) => getMessage(token, m.id, "metadata"))
      );

      const results = messages.map((msg) => {
        const headers = msg.payload?.headers || [];
        const get = (name: string) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        return {
          id: msg.id,
          threadId: msg.threadId,
          from: get("From"),
          to: get("To"),
          subject: get("Subject"),
          date: get("Date"),
          snippet: msg.snippet || "",
          labels: msg.labelIds || [],
        };
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ results }, null, 2) }],
      };
    }
  );
}
