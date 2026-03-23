import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deleteMessage } from "../gmail.js";
import { accountParam, checkAccount } from "./account-check.js";

export function registerDeleteTool(server: McpServer, getToken: () => Promise<string>, email: string) {
  server.tool(
    "delete_email",
    "Permanently delete a Gmail message. This cannot be undone.",
    {
      ...accountParam,
      messageId: z.string().describe("The Gmail message ID to permanently delete"),
    },
    async ({ email: inputEmail, messageId }) => {
      const err = checkAccount(inputEmail, email);
      if (err) return err;

      const token = await getToken();
      await deleteMessage(token, messageId);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ status: "deleted", messageId }),
        }],
      };
    }
  );
}
