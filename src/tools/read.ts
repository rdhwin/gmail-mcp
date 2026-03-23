import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMessage } from "../gmail.js";
import { extractBody } from "../mime.js";
import { accountParam, checkAccount } from "./account-check.js";

export function registerReadTool(server: McpServer, getToken: () => Promise<string>, email: string) {
  server.tool(
    "read_email",
    "Read the full content of an email by message ID.",
    {
      ...accountParam,
      messageId: z.string().describe("The Gmail message ID to read"),
    },
    async ({ email: inputEmail, messageId }) => {
      const err = checkAccount(inputEmail, email);
      if (err) return err;

      const token = await getToken();
      const msg = await getMessage(token, messageId, "full");

      const headers = msg.payload?.headers || [];
      const get = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

      const body = extractBody(msg.payload);

      const result = {
        id: msg.id,
        threadId: msg.threadId,
        from: get("From"),
        to: get("To"),
        cc: get("Cc"),
        bcc: get("Bcc"),
        subject: get("Subject"),
        date: get("Date"),
        labels: msg.labelIds || [],
        body,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
