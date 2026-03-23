import { z } from "zod";

export const accountParam = {
  email: z.string().describe("The email address of the authenticated Gmail account (use whoami to check)"),
};

export function checkAccount(email: string, expected: string): { content: { type: "text"; text: string }[]; isError: true } | null {
  if (email.toLowerCase() !== expected.toLowerCase()) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "account_mismatch",
          expected,
          got: email,
        }),
      }],
      isError: true,
    };
  }
  return null;
}
