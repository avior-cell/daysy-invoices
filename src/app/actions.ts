"use server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function who() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.email) throw new Error("unauthorized");
  return s.user.email;
}

export async function approveMatch(expenseId: string, invoiceId: string) {
  const by = await who();
  await db().from("matches").delete().eq("expense_id", expenseId).neq("kind", "rejected");
  await db().from("matches").upsert({ expense_id: expenseId, invoice_id: invoiceId, kind: "manual", created_by: by });
  revalidatePath("/", "layout");
}

export async function rejectMatch(expenseId: string, invoiceId: string) {
  const by = await who();
  await db().from("matches").upsert({ expense_id: expenseId, invoice_id: invoiceId, kind: "rejected", created_by: by });
  revalidatePath("/", "layout");
}

export async function setRequired(expenseId: string, required: boolean) {
  await who();
  await db().from("expenses").update({ status: required ? "required" : "not_required" }).eq("id", expenseId);
  revalidatePath("/", "layout");
}

export async function setNote(expenseId: string, note: string) {
  await who();
  await db().from("expenses").update({ note: note.slice(0, 300) || null }).eq("id", expenseId);
  revalidatePath("/", "layout");
}

export async function markNotInvoice(invoiceId: string) {
  await who();
  await db().from("invoices").update({ is_invoice: false }).eq("id", invoiceId);
  revalidatePath("/", "layout");
}

export async function setFee(month: string, key: string, status: "open" | "not_required", invoiceId?: string) {
  await who();
  await db().from("fee_requirements").upsert({ month, key, status, invoice_id: invoiceId || null });
  revalidatePath("/", "layout");
}
