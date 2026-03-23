import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchTool } from "./search.js";
import { registerReadTool } from "./read.js";
import { registerSendTool } from "./send.js";
import { registerDraftTool } from "./draft.js";
import { registerLabelsTool } from "./labels.js";
import { registerModifyTool } from "./modify.js";
import { registerDeleteTool } from "./delete.js";

export function createTools(server: McpServer, getToken: () => Promise<string>, email: string) {
  registerSearchTool(server, getToken, email);
  registerReadTool(server, getToken, email);
  registerSendTool(server, getToken, email);
  registerDraftTool(server, getToken, email);
  registerLabelsTool(server, getToken, email);
  registerModifyTool(server, getToken, email);
  registerDeleteTool(server, getToken, email);
}
