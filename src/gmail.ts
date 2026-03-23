import { GmailListResponse, GmailMessage, GmailLabelsResponse } from "./types.js";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch(
  token: string,
  path: string,
  opts?: RequestInit
): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail API error ${res.status}: ${text}`);
  }

  return res;
}

export async function listMessages(
  token: string,
  query: string,
  maxResults: number = 10
): Promise<GmailListResponse> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });
  const res = await gmailFetch(token, `/messages?${params}`);
  return res.json() as Promise<GmailListResponse>;
}

export async function getMessage(
  token: string,
  id: string,
  format: "full" | "metadata" | "minimal" = "full"
): Promise<GmailMessage> {
  const params = new URLSearchParams({ format });
  const res = await gmailFetch(token, `/messages/${id}?${params}`);
  return res.json() as Promise<GmailMessage>;
}

export async function sendMessage(
  token: string,
  raw: string
): Promise<GmailMessage> {
  const res = await gmailFetch(token, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw }),
  });
  return res.json() as Promise<GmailMessage>;
}

export async function createDraft(
  token: string,
  raw: string
): Promise<{ id: string; message: GmailMessage }> {
  const res = await gmailFetch(token, "/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw } }),
  });
  return res.json() as Promise<{ id: string; message: GmailMessage }>;
}

export async function modifyMessage(
  token: string,
  id: string,
  addLabelIds: string[],
  removeLabelIds: string[]
): Promise<GmailMessage> {
  const res = await gmailFetch(token, `/messages/${id}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
  return res.json() as Promise<GmailMessage>;
}

export async function deleteMessage(
  token: string,
  id: string
): Promise<void> {
  await gmailFetch(token, `/messages/${id}`, {
    method: "DELETE",
  });
}

export async function listLabels(
  token: string
): Promise<GmailLabelsResponse> {
  const res = await gmailFetch(token, "/labels");
  return res.json() as Promise<GmailLabelsResponse>;
}
