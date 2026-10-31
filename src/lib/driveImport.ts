import { createHash } from "node:crypto";
import { db } from "./db";
import { driveFor } from "./google";
import { extract } from "./extract";
import { ensureMonthFolder, invoiceFileName } from "./drive";
import { getSetting, setSetting } from "./settings";

/**
 * Import an existing Drive folder of invoices (for example the archive kept before Money Buddy).
 * Listing: every PDF or image under the folders in the setting "drive_import" goes into the queue as "drive:<fileId>".
 * Processing: a file is skipped when the same bytes, or the same document (number and amount, or amount and date), is already saved.
 * New documents are copied into the month folder; the original is never moved or deleted.
 */
const OWNER = () => process.env.INVOICE_MAILBOX!;
type ImportState = { folders: string[]; done: boolean; listed: number };
const FILE_OK = (m: string, n: string) => m === "application/pdf" || /\.pdf$/i.test(n) || /^image\/(png|jpe?g|webp|heic)$/.test(m);

export async function driveListStep() {
  const st = await getSetting<ImportState>("drive_import");
  if (!st || st.done || !st.folders?.length) return 0;
  const drive = await driveFor(OWNER());
  const ids: string[] = [];
  const walk = async (folder: string) => {
    let pageToken: string | undefined;
    do {
      const r = await drive.files.list({
        q: `'${folder}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType)",
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: "allDrives",
      });
      for (const f of r.data.files || []) {
        if (f.mimeType === "application/vnd.google-apps.folder") await walk(f.id!);
        else if (FILE_OK(f.mimeType || "", f.name || "")) ids.push(f.id!);
      }
      pageToken = r.data.nextPageToken || undefined;
    } while (pageToken);
  };
  for (const f of st.folders) await walk(f);
  if (ids.length) {
    await db()
      .from("queue")
      .upsert(ids.map((id) => ({ message_id: `drive:${id}`, seq: 0, priority: 5 })), { onConflict: "message_id", ignoreDuplicates: true });
  }
  await setSetting("drive_import", { ...st, done: true, listed: ids.length });
  return ids.length;
}

const near = (a: string, days: number) => {
  const t = Date.parse(a);
  return [new Date(t - days * 864e5).toISOString().slice(0, 10), new Date(t + days * 864e5).toISOString().slice(0, 10)];
};

export async function processDriveFile(fileId: string): Promise<string> {
  const drive = await driveFor(OWNER());
  const meta = await drive.files.get({ fileId, fields: "id, name, mimeType, createdTime", supportsAllDrives: true });
  const name = meta.data.name || "file";
  const mime = meta.data.mimeType || "application/pdf";
  const res = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  const bytes = Buffer.from(res.data as ArrayBuffer);
  if (bytes.length > 15 * 1024 * 1024) return "skipped:large";
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { data: same } = await db().from("invoices").select("id").eq("sha256", sha256).maybeSingle();
  if (same) return "duplicate";

  const x = await extract({ fileName: name, from: "Drive", subject: "ארכיון חשבוניות ב־Drive" }, { bytes, mime });
  // An archive of invoices: keep anything that reads as a tax document with an amount, even if the model hesitated
  const looksLikeDoc = !!x && (x.is_invoice || (x.doc_type !== "other" && x.amount != null));
  if (!x || !looksLikeDoc) return x ? `not_invoice:${x.doc_type}:${x.amount ?? ""}` : "not_invoice:unread";

  // The same document saved from another source (mail, Sumit) has different bytes: compare what it says
  if (x.amount != null) {
    let q = db().from("invoices").select("id").eq("is_invoice", true).eq("amount", x.amount).eq("currency", x.currency || "ILS");
    if (x.doc_number) {
      const { data } = await q.eq("doc_number", x.doc_number).limit(1);
      if (data?.length) return "duplicate";
      q = db().from("invoices").select("id").eq("is_invoice", true).eq("amount", x.amount).eq("currency", x.currency || "ILS");
    }
    if (x.doc_date) {
      const [a, b] = near(x.doc_date, 3);
      const { data } = await q.gte("doc_date", a).lte("doc_date", b).limit(1);
      if (data?.length) return "duplicate";
    }
  }

  const date = x.doc_date || (meta.data.createdTime || new Date().toISOString()).slice(0, 10);
  const month = date.slice(0, 7);
  const ext = (name.match(/\.([a-z0-9]{2,4})$/i)?.[1] || (mime.includes("pdf") ? "pdf" : "jpg")).toLowerCase();
  const parent = await ensureMonthFolder(month);
  const copy = await drive.files.copy({
    fileId,
    supportsAllDrives: true,
    requestBody: { name: invoiceFileName({ ...x, doc_date: date }, ext), parents: [parent] },
    fields: "id, webViewLink",
  });
  const { error } = await db().from("invoices").upsert(
    {
      source: "drive",
      source_ref: fileId,
      sha256,
      file_name: name,
      mime,
      drive_file_id: copy.data.id,
      drive_url: copy.data.webViewLink || `https://drive.google.com/file/d/${copy.data.id}/view`,
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
      email_from: "Drive",
    },
    { onConflict: "source,source_ref" },
  );
  if (error && !/duplicate key value.*sha256/.test(error.message)) throw error;
  return "invoice";
}
