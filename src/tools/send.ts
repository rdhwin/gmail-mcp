import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendMessage } from "../gmail.js";
import { buildRawMessage } from "../mime.js";
import { accountParam, checkAccount } from "./account-check.js";

export function registerSendTool(server: McpServer, getToken: () => Promise<string>, email: string) {
  server.tool(
    "send_email",
    "Send an email. Provide at least body or htmlBody.",
    {
      ...accountParam,
      to: z.string().describe("Recipient email address(es), comma-separated"),
      subject: z.string().describe("Email subject"),
      body: z.string().optional().describe("Plain text email body"),
      htmlBody: z.string().optional().describe("HTML email body"),
      cc: z.string().optional().describe("CC recipients, comma-separated"),
      bcc: z.string().optional().describe("BCC recipients, comma-separated"),
    },
    async ({ email: inputEmail, to, subject, body, htmlBody, cc, bcc }) => {
      const err = checkAccount(inputEmail, email);
      if (err) return err;

      const raw = buildRawMessage({ to, subject, body, htmlBody, cc, bcc });
      const token = await getToken();
      const msg = await sendMessage(token, raw);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ status: "sent", messageId: msg.id, threadId: msg.threadId }),
        }],
      };
    }
  );
}
