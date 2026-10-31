import { db } from "./db";
import { gmailFor } from "./google";
import { processMessage } from "./gmail";
import { getSetting, setSetting } from "./settings";
import { driveListStep, processDriveFile } from "./driveImport";

/**
 * Background engine. One tick (every minute, from Supabase pg_cron) does three things within a time budget:
 *  1. Lists the next pages of matching mail into the queue (ids only, cheap), until the whole mailbox is listed.
 *  2. Picks up mail that arrived since the last tick (Gmail history) at top priority.
 *  3. Processes queued messages in parallel until the budget runs out.
 * Nothing depends on a browser being open, and a crash only delays a message to the next tick.
 */

const MAILBOX = () => process.env.INVOICE_MAILBOX!;
// Search first: only mail that can hold an invoice. Covers every label and the archive; spam and trash excluded.
export const INVOICE_QUERY =
  '(has:attachment OR filename:pdf OR חשבונית OR קבלה OR "חשבון עסקה" OR "אישור תשלום" OR invoice OR receipt OR billing OR "payment received" OR "order confirmation") -in:chats';

type ListState = { pageToken: string | null; done: boolean; seq: number; listed: number; historyId: string | null };

async function listStep(budgetEnd: number) {
  const gmail = await gmailFor(MAILBOX());
  const st: ListState = (await getSetting<ListState>("gmail_list")) || { pageToken: null, done: false, seq: 0, listed: 0, historyId: null };
  if (!st.historyId) st.historyId = (await gmail.users.getProfile({ userId: "me" })).data.historyId || null;
  while (!st.done && Date.now() < budgetEnd - 20_000) {
    const res = await gmail.users.messages.list({ userId: "me", q: INVOICE_QUERY, maxResults: 500, pageToken: st.pageToken || undefined });
    const ids = (res.data.messages || []).map((m) => m.id!);
    if (ids.length) {
      // Gmail lists newest first, so seq keeps recent months at the front of the queue
      const rows = ids.map((id, i) => ({ message_id: id, seq: st.seq + i }));
      await db().from("queue").upsert(rows, { onConflict: "message_id", ignoreDuplicates: true });
      st.seq += ids.length;
      st.listed += ids.length;
    }
    st.pageToken = res.data.nextPageToken || null;
    st.done = !st.pageToken;
    await setSetting("gmail_list", st);
  }
  return st;
}

async function historyStep() {
  const gmail = await gmailFor(MAILBOX());
  const st = await getSetting<ListState>("gmail_list");
  if (!st?.historyId) return 0;
  const ids = new Set<string>();
  let latest = st.historyId;
  try {
    let pageToken: string | undefined;
    do {
      const r = await gmail.users.history.list({ userId: "me", startHistoryId: st.historyId, historyTypes: ["messageAdded"], pageToken });
      for (const h of r.data.history || []) for (const a of h.messagesAdded || []) if (a.message?.id && !(a.message.labelIds || []).includes("SENT")) ids.add(a.message.id);
      latest = r.data.historyId || latest;
      pageToken = r.data.nextPageToken || undefined;
    } while (pageToken);
  } catch {
    // History expires after about a week: recover with a search of the last 14 days
    const r = await gmail.users.messages.list({ userId: "me", q: `${INVOICE_QUERY} newer_than:14d`, maxResults: 500 });
    for (const m of r.data.messages || []) ids.add(m.id!);
    latest = (await gmail.users.getProfile({ userId: "me" })).data.historyId || latest;
  }
  if (ids.size) {
    await db()
      .from("queue")
      .upsert([...ids].map((id) => ({ message_id: id, seq: 0, priority: 10 })), { onConflict: "message_id", ignoreDuplicates: true });
  }
  await setSetting("gmail_list", { ...st, historyId: latest });
  return ids.size;
}

// Gmail allows ~15,000 quota units per user per minute; a message with attachments costs 10 to 30.
// Quota and rate-limit errors are not the message's fault: put it back without spending an attempt,
// and stop this tick so the next one starts with a fresh minute.
const isRateLimit = (status: number | string, msg: string) =>
  status == 429 || /quota exceeded|rate limit|ratelimitexceeded|userratelimit|overloaded/i.test(msg);

async function processStep(budgetEnd: number, concurrency = 3) {
  const gmail = await gmailFor(MAILBOX());
  const stats: Record<string, number> = {};
  let throttled = false;
  const worker = async () => {
    while (!throttled && Date.now() < budgetEnd - 15_000) {
      const { data, error } = await db().rpc("claim_queue", { n: 1 });
      if (error) throw error;
      const id = (data as string[] | null)?.[0];
      if (!id) return;
      const { data: prev } = await db().from("scanned_messages").select("result").eq("message_id", id).maybeSingle();
      if (prev && !String(prev.result).startsWith("error")) {
        await db().from("queue").update({ status: "done", result: prev.result, updated_at: new Date().toISOString() }).eq("message_id", id);
        continue;
      }
      try {
        const result = id.startsWith("drive:") ? await processDriveFile(id.slice(6)) : await processMessage(gmail, id);
        stats[result] = (stats[result] || 0) + 1;
        await db().from("scanned_messages").upsert({ message_id: id, result });
        await db().from("queue").update({ status: "done", result, error: null, updated_at: new Date().toISOString() }).eq("message_id", id);
      } catch (e) {
        const err = e as Error & { status?: number; response?: { status?: number } };
        const status = err.status || err.response?.status || "";
        const msg = `${status} ${err.message || String(e)}`.trim().slice(0, 500);
        const { data: row } = await db().from("queue").select("attempts").eq("message_id", id).maybeSingle();
        if (isRateLimit(status, msg)) {
          throttled = true;
          stats.throttled = (stats.throttled || 0) + 1;
          await db()
            .from("queue")
            .update({ status: "pending", attempts: Math.max(0, (row?.attempts || 1) - 1), error: msg, updated_at: new Date().toISOString() })
            .eq("message_id", id);
          continue;
        }
        stats.error = (stats.error || 0) + 1;
        const final = (row?.attempts || 0) >= 3;
        await db()
          .from("queue")
          .update({ status: final ? "error" : "pending", error: msg, updated_at: new Date().toISOString() })
          .eq("message_id", id);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return stats;
}

export async function tick(budgetMs = 50_000) {
  const end = Date.now() + budgetMs;
  const list = await listStep(end);
  const fresh = await historyStep().catch(() => 0);
  await driveListStep().catch(() => 0);
  const processed = await processStep(end);
  const { data: progress } = await db().rpc("queue_progress");
  return { listed: list.listed, listingDone: list.done, fresh, processed, progress };
}

export async function progress() {
  const st = await getSetting<ListState>("gmail_list");
  const { data } = await db().rpc("queue_progress");
  return { listingDone: !!st?.done, listed: st?.listed || 0, queue: (data || {}) as Record<string, number> };
}
