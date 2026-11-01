import { db } from "./db";
import type { Extracted } from "./extract";

/**
 * The same document often arrives more than once with different bytes (a resent email, a Sumit copy, a Drive scan).
 * It is the same document when the number and the amount agree, or when the amount agrees, the dates are within
 * 3 days and the issuer is the same (tax id, or the first word of its name).
 */
export async function findDuplicate(x: Pick<Extracted, "doc_number" | "amount" | "currency" | "doc_date" | "vendor_tax_id" | "vendor_name">): Promise<string | null> {
  if (x.amount == null) return null;
  const base = () => db().from("invoices").select("id, vendor_name, vendor_tax_id").eq("is_invoice", true).eq("amount", x.amount).eq("currency", x.currency || "ILS");
  if (x.doc_number) {
    const { data } = await base().eq("doc_number", x.doc_number).limit(1);
    if (data?.length) return data[0].id;
  }
  if (x.doc_date) {
    const t = Date.parse(x.doc_date);
    const d = (n: number) => new Date(t + n * 864e5).toISOString().slice(0, 10);
    const { data } = await base().gte("doc_date", d(-3)).lte("doc_date", d(3)).limit(20);
    const word = (s: string | null) => (s || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/)[0] || "";
    const hit = (data || []).find((r) => (x.vendor_tax_id && r.vendor_tax_id === x.vendor_tax_id) || (word(x.vendor_name) && word(r.vendor_name) === word(x.vendor_name)));
    if (hit) return hit.id;
  }
  return null;
}
