import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { extract } from "./extract";
import { invoiceFileName, uploadToMonth } from "./drive";

export type Intake = { invoiceId: string; driveUrl: string | null; vendor: string | null; amount: number | null; currency: string; date: string; month: string; docType: string | null };

/** File one uploaded or shared document: read it, put it in the month folder in Drive, save it, optionally link it. */
export async function intakeFile(
  file: File,
  user: string,
  opts: { expenseId?: string; feeKey?: string; month?: string; via?: string } = {},
): Promise<Intake> {
  if (file.size > 15 * 1024 * 1024) throw new Error("הקובץ גדול מ־15MB");
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/pdf";
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { expenseId, feeKey, month } = opts;

  const { data: exp } = expenseId ? await db().from("expenses").select("*").eq("id", expenseId).maybeSingle() : { data: null };
  const x = await extract({ fileName: file.name, from: user, subject: opts.via || "העלאה ידנית" }, { bytes, mime }).catch(() => null);
  const date = x?.doc_date || exp?.date || (month ? `${month}-28` : new Date().toISOString().slice(0, 10));
  const fileMonth = exp?.month || month || date.slice(0, 7);
  const meta = {
    vendor_name: x?.vendor_name || exp?.vendor_text || null,
    amount: x?.amount ?? (exp ? Number(exp.amount) : null),
    currency: x?.currency || exp?.currency || "ILS",
  };
  const ext = (file.name.match(/\.([a-z0-9]{2,4})$/i)?.[1] || (mime.includes("pdf") ? "pdf" : "jpg")).toLowerCase();
  const drive = await uploadToMonth(fileMonth, invoiceFileName({ ...meta, doc_date: date }, ext), mime, bytes);
  const { data: inv, error } = await db()
    .from("invoices")
    .upsert(
      {
        sha256,
        source: opts.via === "שיתוף" ? "whatsapp" : "upload",
        source_ref: sha256,
        file_name: file.name,
        mime,
        ...drive,
        is_invoice: true,
        doc_type: x?.doc_type || null,
        vendor_tax_id: x?.vendor_tax_id || null,
        doc_number: x?.doc_number || null,
        ...meta,
        doc_date: date,
        month: fileMonth,
        extracted: x,
        email_from: user,
      },
      { onConflict: "sha256" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (expenseId) {
    await db().from("matches").delete().eq("expense_id", expenseId).neq("kind", "rejected");
    await db().from("matches").upsert({ expense_id: expenseId, invoice_id: inv.id, kind: "manual", created_by: user });
  }
  if (feeKey && month) await db().from("fee_requirements").upsert({ month, key: feeKey, status: "done", invoice_id: inv.id });
  revalidatePath("/", "layout");
  return { invoiceId: inv.id, driveUrl: drive.drive_url, vendor: meta.vendor_name, amount: meta.amount, currency: meta.currency, date, month: fileMonth, docType: x?.doc_type || null };
}
