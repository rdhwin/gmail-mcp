import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { modifyMessage } from "../gmail.js";
import { accountParam, checkAccount } from "./account-check.js";

export function registerModifyTool(server: McpServer, getToken: () => Promise<string>, email: string) {
  server.tool(
    "modify_email",
    "Add or remove labels on a Gmail message.",
    {
      ...accountParam,
      messageId: z.string().describe("The Gmail message ID to modify"),
      addLabelIds: z.array(z.string()).default([]).describe("Label IDs to add"),
      removeLabelIds: z.array(z.string()).default([]).describe("Label IDs to remove"),
    },
    async ({ email: inputEmail, messageId, addLabelIds, removeLabelIds }) => {
      const err = checkAccount(inputEmail, email);
      if (err) return err;

      const token = await getToken();
      const msg = await modifyMessage(token, messageId, addLabelIds, removeLabelIds);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ messageId: msg.id, labels: msg.labelIds || [] }),
        }],
      };
    }
  );
}
