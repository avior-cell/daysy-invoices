import { Readable } from "node:stream";
import { db } from "./db";
import { driveFor } from "./google";

const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const ROOT = () => process.env.DRIVE_ROOT_FOLDER_ID!;
const OWNER = () => process.env.INVOICE_MAILBOX!;

export function monthFolderTitle(month: string) {
  return `${month} ${HE_MONTHS[Number(month.slice(5, 7)) - 1]}`;
}

export async function ensureMonthFolder(month: string): Promise<string> {
  const { data } = await db().from("drive_folders").select("folder_id").eq("month", month).maybeSingle();
  if (data) return data.folder_id;
  const drive = await driveFor(OWNER());
  const title = monthFolderTitle(month);
  const found = await drive.files.list({
    q: `'${ROOT()}' in parents and name = '${title}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
  });
  let id = found.data.files?.[0]?.id;
  if (!id) {
    const created = await drive.files.create({
      requestBody: { name: title, mimeType: "application/vnd.google-apps.folder", parents: [ROOT()] },
      fields: "id",
    });
    id = created.data.id!;
  }
  await db().from("drive_folders").upsert({ month, folder_id: id });
  return id;
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);

export function invoiceFileName(x: { doc_date?: string | null; vendor_name?: string | null; amount?: number | null; currency?: string | null }, ext: string) {
  const cur = x.currency && x.currency !== "ILS" ? ` ${x.currency}` : "";
  return safe(`${x.doc_date || ""} ${x.vendor_name || "ספק"} ${x.amount ?? ""}${cur}`) + "." + ext;
}

export async function uploadToMonth(month: string, name: string, mime: string, bytes: Buffer) {
  const drive = await driveFor(OWNER());
  const parent = await ensureMonthFolder(month);
  const res = await drive.files.create({
    requestBody: { name, parents: [parent] },
    media: { mimeType: mime, body: Readable.from(bytes) },
    fields: "id, webViewLink",
  });
  return { drive_file_id: res.data.id!, drive_url: res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view` };
}
