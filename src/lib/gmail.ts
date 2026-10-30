import { createHash } from "node:crypto";
import type { gmail_v1 } from "googleapis";
import { db, getSyncState, setSyncState } from "./db";
import { gmailFor } from "./google";
import { extract, looksLikeInvoice, type Extracted } from "./extract";
import { fetchInvoice, invoiceLinks } from "./links";
import { invoiceFileName, uploadToMonth } from "./drive";

type Gmail = gmail_v1.Gmail;
type Part = gmail_v1.Schema$MessagePart;

const header = (m: gmail_v1.Schema$Message, name: string) =>
  m.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

function walk(part: Part | undefined, out: Part[] = []): Part[] {
  if (!part) return out;
  out.push(part);
  for (const p of part.parts || []) walk(p, out);
  return out;
}

function decode(data?: string | null) {
  return data ? Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64") : Buffer.alloc(0);
}

function bodyText(parts: Part[]): string {
  const plain = parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
  if (plain) return decode(plain.body!.data).toString("utf8");
  const html = parts.find((p) => p.mimeType === "text/html" && p.body?.data);
  if (!html) return "";
  // Keep hrefs so invoice links survive the tag strip
  return decode(html.body!.data)
    .toString("utf8")
    .replace(/<a [^>]*href=["']([^"']+)["'][^>]*>/gi, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

const isDoc = (p: Part) =>
  !!p.filename &&
  (p.mimeType === "application/pdf" ||
    /\.pdf$/i.test(p.filename) ||
    (/^image\/(png|jpe?g|webp)$/.test(p.mimeType || "") && (p.body?.size || 0) > 25_000));

const monthOf = (d: string | null | undefined) => (d && /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : null);

async function saveInvoice(row: Record<string, unknown>) {
  const { error } = await db().from("invoices").upsert(row, { onConflict: "source,source_ref", ignoreDuplicates: false });
  if (error && !/duplicate key value.*sha256/.test(error.message)) throw error;
}

async function fileInvoice(
  x: Extracted,
  bytes: Buffer,
  mime: string,
  fileName: string,
  base: Record<string, unknown>,
  fallbackDate: string,
) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { data: dup } = await db().from("invoices").select("id").eq("sha256", sha256).maybeSingle();
  if (dup) return "duplicate";
  const date = x.doc_date || fallbackDate;
  const month = monthOf(date)!;
  const ext = (fileName.match(/\.([a-z0-9]{2,4})$/i)?.[1] || (mime === "application/pdf" ? "pdf" : "jpg")).toLowerCase();
  const drive = await uploadToMonth(month, invoiceFileName({ ...x, doc_date: date }, ext), mime, bytes);
  await saveInvoice({
    ...base,
    sha256,
    file_name: fileName,
    mime,
    ...drive,
    is_invoice: true,
    doc_type: x.doc_type,
    vendor_name: x.vendor_name,
    vendor_tax_id: x.vendor_tax_id,
    amount: x.amount,
    currency: x.currency,
    doc_date: date,
    month,
    doc_number: x.doc_number,
    confidence: x.confidence,
    extracted: x,
  });
  return "invoice";
}

/** Process one message end to end. Returns the result recorded in scanned_messages. */
export async function processMessage(gmail: Gmail, id: string): Promise<string> {
  const { data: m } = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const parts = walk(m.payload);
  const subject = header(m, "Subject");
  const from = header(m, "From");
  const date = new Date(Number(m.internalDate || 0)).toISOString().slice(0, 10);
  const body = bodyText(parts);
  const docs = parts.filter(isDoc);
  const links = invoiceLinks(body);
  const sourceUrl = `https://mail.google.com/mail/u/${process.env.INVOICE_MAILBOX}/#all/${m.threadId}`;
  const base = { email_from: from, email_subject: subject, email_date: date, source_url: sourceUrl };

  if (!looksLikeInvoice(subject, from, body, docs.length > 0) && !links.length) return "not_invoice";

  let result = "not_invoice";
  // 1. Attached PDFs and images
  for (const [n, p] of docs.slice(0, 4).entries()) {
    const att = p.body?.attachmentId
      ? (await gmail.users.messages.attachments.get({ userId: "me", messageId: id, id: p.body.attachmentId })).data.data
      : p.body?.data;
    const bytes = decode(att);
    if (!bytes.length) continue;
    const mime = p.mimeType === "application/octet-stream" ? "application/pdf" : p.mimeType || "application/pdf";
    const x = await extract({ from, subject, date, fileName: p.filename || "", body }, { bytes, mime });
    if (!x?.is_invoice) continue;
    result = await fileInvoice(x, bytes, mime, p.filename || "invoice.pdf", { ...base, source: "gmail", source_ref: `${id}:${n}` }, date);
  }
  if (result !== "not_invoice") return result;

  // 2. Invoice behind a download link
  for (const url of links) {
    const got = await fetchInvoice(url).catch(() => null);
    if (!got) continue;
    const x = await extract({ from, subject, date, fileName: got.name, body }, { bytes: got.bytes, mime: got.mime });
    if (!x?.is_invoice) continue;
    return fileInvoice(x, got.bytes, got.mime, got.name, { ...base, source: "gmail_link", source_ref: `${id}:link`, download_url: url }, date);
  }

  // 3. Invoice only described in the body, or a link that needs a login: keep it so someone can download it
  const x = await extract({ from, subject, date, body });
  if (x?.is_invoice) {
    const d = x.doc_date || date;
    await saveInvoice({
      ...base,
      source: links.length ? "gmail_link" : "gmail",
      source_ref: `${id}:body`,
      download_url: links[0] || null,
      is_invoice: true,
      doc_type: x.doc_type,
      vendor_name: x.vendor_name,
      vendor_tax_id: x.vendor_tax_id,
      amount: x.amount,
      currency: x.currency,
      doc_date: d,
      month: monthOf(d),
      doc_number: x.doc_number,
      confidence: x.confidence,
      extracted: x,
    });
    return "link";
  }
  return "not_invoice";
}

async function alreadyScanned(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const { data } = await db().from("scanned_messages").select("message_id").in("message_id", ids);
  return new Set((data || []).map((r) => r.message_id as string));
}

async function processBatch(gmail: Gmail, ids: string[], stats: Record<string, number>) {
  const seen = await alreadyScanned(ids);
  const todo = ids.filter((id) => !seen.has(id));
  // Small concurrency keeps us well inside Gmail's per-user quota
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(
      todo.slice(i, i + 4).map(async (id) => {
        let result = "error";
        try {
          result = await processMessage(gmail, id);
        } catch (e) {
          console.error("gmail message failed", id, (e as Error).message);
        }
        stats[result] = (stats[result] || 0) + 1;
        if (result !== "error") await db().from("scanned_messages").upsert({ message_id: id, result });
      }),
    );
  }
  stats.seen = (stats.seen || 0) + ids.length;
}

/**
 * Full mailbox scan: every message in every label, archive included (spam and trash excluded),
 * paged with pageToken until the end. Runs in time-boxed slices and resumes from the saved page,
 * so it works within serverless time limits and never stops at 50 or 500 messages.
 */
export async function fullScan(mailbox: string, budgetMs = 240_000) {
  const key = `gmail:${mailbox}`;
  const gmail = await gmailFor(mailbox);
  const state = await getSyncState(key);
  if (state?.full_scan_done) return { done: true, stats: state.stats };
  const stats: Record<string, number> = { ...(state?.stats || {}) };
  let pageToken = state?.full_scan_page || undefined;
  if (!state?.cursor) {
    const profile = await gmail.users.getProfile({ userId: "me" });
    // Remember where "now" is, so incremental sync picks up anything that arrives during the full scan
    await setSyncState(key, { cursor: profile.data.historyId, stats });
  }
  const started = Date.now();
  do {
    const res = await gmail.users.messages.list({ userId: "me", maxResults: 100, pageToken, includeSpamTrash: false });
    await processBatch(gmail, (res.data.messages || []).map((x) => x.id!), stats);
    pageToken = res.data.nextPageToken || undefined;
    await setSyncState(key, { full_scan_page: pageToken || null, full_scan_done: !pageToken, stats });
  } while (pageToken && Date.now() - started < budgetMs);
  return { done: !pageToken, stats };
}

/** Incremental sync from the last historyId: only messages added since the previous run. */
export async function incrementalSync(mailbox: string) {
  const key = `gmail:${mailbox}`;
  const gmail = await gmailFor(mailbox);
  const state = await getSyncState(key);
  if (!state?.cursor) return fullScan(mailbox);
  const stats: Record<string, number> = {};
  let pageToken: string | undefined;
  let latest = state.cursor;
  const ids = new Set<string>();
  try {
    do {
      const res = await gmail.users.history.list({ userId: "me", startHistoryId: state.cursor, historyTypes: ["messageAdded"], pageToken });
      for (const h of res.data.history || []) for (const a of h.messagesAdded || []) if (a.message?.id) ids.add(a.message.id);
      latest = res.data.historyId || latest;
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  } catch (e) {
    // historyId expired (older than about a week): fall back to a scan of the last 14 days
    const res = await gmail.users.messages.list({ userId: "me", q: "newer_than:14d", maxResults: 500 });
    for (const m of res.data.messages || []) ids.add(m.id!);
    latest = (await gmail.users.getProfile({ userId: "me" })).data.historyId!;
  }
  const list = [...ids];
  for (let i = 0; i < list.length; i += 100) await processBatch(gmail, list.slice(i, i + 100), stats);
  await setSyncState(key, { cursor: latest });
  return { done: true, stats };
}
