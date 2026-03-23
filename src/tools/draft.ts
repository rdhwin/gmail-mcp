import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createDraft } from "../gmail.js";
import { buildRawMessage } from "../mime.js";
import { accountParam, checkAccount } from "./account-check.js";

export function registerDraftTool(server: McpServer, getToken: () => Promise<string>, email: string) {
  server.tool(
    "draft_email",
    "Create a draft email. Provide at least body or htmlBody.",
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
      const draft = await createDraft(token, raw);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ status: "draft_created", draftId: draft.id, messageId: draft.message.id }),
        }],
      };
    }
  );
}
