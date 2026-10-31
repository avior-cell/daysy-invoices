import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { intakeFile } from "@/lib/intake";

export const maxDuration = 60;

/** Upload an invoice (PDF or photo) from the phone or desktop, optionally straight onto one expense or fee. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "צריך להתחבר מחדש" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
  try {
    const r = await intakeFile(file, session.user.email, {
      expenseId: String(form.get("expenseId") || "") || undefined,
      feeKey: String(form.get("feeKey") || "") || undefined,
      month: String(form.get("month") || "") || undefined,
    });
    return NextResponse.json({ ok: true, invoiceId: r.invoiceId, driveUrl: r.driveUrl, read: { vendor_name: r.vendor, amount: r.amount, currency: r.currency }, month: r.month });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
