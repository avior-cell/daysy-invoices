import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { extract } from "@/lib/extract";
import { invoiceFileName, uploadToMonth } from "@/lib/drive";

export const maxDuration = 60;

/** Upload an invoice (PDF or photo) from the phone or desktop, optionally straight onto one expense or fee. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "צריך להתחבר מחדש" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  const expenseId = String(form.get("expenseId") || "");
  const feeKey = String(form.get("feeKey") || "");
  const month = String(form.get("month") || "");
  if (!(file instanceof File)) return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "הקובץ גדול מ־15MB" }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/pdf";
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const { data: exp } = expenseId ? await db().from("expenses").select("*").eq("id", expenseId).maybeSingle() : { data: null };
  const x = await extract({ fileName: file.name, from: session.user.email, subject: "העלאה ידנית" }, { bytes, mime }).catch(() => null);
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
        source: "upload",
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
        email_from: session.user.email,
      },
      { onConflict: "sha256" },
    )
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (expenseId) {
    await db().from("matches").delete().eq("expense_id", expenseId).neq("kind", "rejected");
    await db().from("matches").upsert({ expense_id: expenseId, invoice_id: inv.id, kind: "manual", created_by: session.user.email });
  }
  if (feeKey && month) await db().from("fee_requirements").upsert({ month, key: feeKey, status: "done", invoice_id: inv.id });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, invoiceId: inv.id, driveUrl: drive.drive_url, read: meta });
}
