import { Readable } from "node:stream";
import { db } from "./db";
import { driveFor } from "./google";
import { getSetting, setSetting } from "./settings";

const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const OWNER = () => process.env.INVOICE_MAILBOX!;
const ROOT_NAME = "Money Buddy · חשבוניות";
const INBOX_NAME = "00 קליטה · וואטסאפ, צילומים וקבצים";
const FOLDER = "application/vnd.google-apps.folder";

export function monthFolderTitle(month: string) {
  return `${month} ${HE_MONTHS[Number(month.slice(5, 7)) - 1]}`;
}

type Folders = { root: string; inbox: string };
let cached: Folders | null = null;

async function findOrCreate(name: string, parent: string) {
  const drive = await driveFor(OWNER());
  const q = `'${parent}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER}' and trashed = false`;
  const found = await drive.files.list({ q, fields: "files(id)", pageSize: 1 });
  const id = found.data.files?.[0]?.id;
  if (id) return id;
  const created = await drive.files.create({ requestBody: { name, mimeType: FOLDER, parents: [parent] }, fields: "id" });
  return created.data.id!;
}

async function usable(id: string) {
  try {
    const drive = await driveFor(OWNER());
    const r = await drive.files.get({ fileId: id, fields: "id, trashed, capabilities(canAddChildren)" });
    return !r.data.trashed && r.data.capabilities?.canAddChildren !== false;
  } catch {
    return false;
  }
}

/**
 * The root and intake folders always live in the connected mailbox's own Drive.
 * Created on first use and remembered; recreated if someone deletes them.
 */
export async function getFolders(): Promise<Folders> {
  if (cached) return cached;
  const saved = await getSetting<Folders>("drive_folders");
  if (saved && (await usable(saved.root))) return (cached = saved);
  const root = await findOrCreate(ROOT_NAME, "root");
  const inbox = await findOrCreate(INBOX_NAME, root);
  cached = { root, inbox };
  await setSetting("drive_folders", cached);
  await db().from("drive_folders").delete().neq("month", ""); // month folders belonged to the old root
  return cached;
}

const monthLocks = new Map<string, Promise<string>>();

export async function ensureMonthFolder(month: string): Promise<string> {
  const { data } = await db().from("drive_folders").select("folder_id").eq("month", month).maybeSingle();
  if (data) return data.folder_id;
  // Several workers may file into the same new month at once: create the folder only once
  if (!monthLocks.has(month)) {
    monthLocks.set(
      month,
      (async () => {
        const { root } = await getFolders();
        const id = await findOrCreate(monthFolderTitle(month), root);
        await db().from("drive_folders").upsert({ month, folder_id: id });
        return id;
      })().finally(() => setTimeout(() => monthLocks.delete(month), 60_000)),
    );
  }
  return monthLocks.get(month)!;
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
