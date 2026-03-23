import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listLabels } from "../gmail.js";
import { accountParam, checkAccount } from "./account-check.js";

export function registerLabelsTool(server: McpServer, getToken: () => Promise<string>, email: string) {
  server.tool(
    "list_labels",
    "List all Gmail labels in the account.",
    accountParam,
    async ({ email: inputEmail }) => {
      const err = checkAccount(inputEmail, email);
      if (err) return err;

      const token = await getToken();
      const res = await listLabels(token);

      const labels = res.labels.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify({ labels }, null, 2) }],
      };
    }
  );
}
