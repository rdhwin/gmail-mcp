import { GmailPayload } from "./types.js";

export function base64urlEncode(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

interface BuildRawMessageOpts {
  to: string;
  subject: string;
  body?: string;
  htmlBody?: string;
  cc?: string;
  bcc?: string;
}

export function buildRawMessage(opts: BuildRawMessageOpts): string {
  const lines: string[] = [];
  lines.push(`To: ${opts.to}`);
  if (opts.cc) lines.push(`Cc: ${opts.cc}`);
  if (opts.bcc) lines.push(`Bcc: ${opts.bcc}`);
  lines.push(`Subject: ${opts.subject}`);

  if (opts.body && opts.htmlBody) {
    const boundary = `boundary_${Date.now()}`;
    lines.push(`MIME-Version: 1.0`);
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/plain; charset="UTF-8"`);
    lines.push("");
    lines.push(opts.body);
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/html; charset="UTF-8"`);
    lines.push("");
    lines.push(opts.htmlBody);
    lines.push(`--${boundary}--`);
  } else if (opts.htmlBody) {
    lines.push(`MIME-Version: 1.0`);
    lines.push(`Content-Type: text/html; charset="UTF-8"`);
    lines.push("");
    lines.push(opts.htmlBody);
  } else {
    lines.push(`MIME-Version: 1.0`);
    lines.push(`Content-Type: text/plain; charset="UTF-8"`);
    lines.push("");
    lines.push(opts.body || "");
  }

  return base64urlEncode(lines.join("\r\n"));
}

export function extractBody(payload?: GmailPayload): string {
  if (!payload) return "";

  // Direct body on this part
  if (payload.body?.data) {
    return base64urlDecode(payload.body.data);
  }

  // Recurse into parts, prefer text/plain over text/html
  if (payload.parts) {
    let htmlResult = "";
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return base64urlDecode(part.body.data);
      }
      if (part.mimeType === "text/html" && part.body?.data) {
        htmlResult = base64urlDecode(part.body.data);
      }
      // Recurse into nested multipart
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
    if (htmlResult) return htmlResult;
  }

  return "";
}
