import { db } from "./db";
import { getSetting, setSetting } from "./settings";

/**
 * Payments that do not map one to one onto invoices.
 *  - installments: one invoice paid in 2 to 4 transfers (M.I.S.S, paid from the open import account in EUR).
 *    Each transfer is allocated to the invoice it is a clean fraction of, oldest first; what is left is an expected payment.
 *    A rounding difference of up to one cent per installment is accepted (3 x 8,333.33 for 25,000.00), never more.
 *  - combine: one transfer pays several documents (Eilat Gateport: import VAT plus brokerage). Linked when the documents
 *    add up exactly; when only part is found, the link is kept and the rest is shown as a missing invoice.
 */
type Family = { key: string; exp: RegExp; inv: RegExp; mode: "installments" | "combine" };
export const FAMILIES: Family[] = [
  { key: "miss", exp: /תש\. יבוא|יבוא פתוח|m\.?i\.?s\.?s/i, inv: /m\.?i\.?s\.?s/i, mode: "installments" },
  { key: "gateport", exp: /גייטפורט|gateport|אגף המכס/i, inv: /גייטפורט|gateport|עמילות יבוא/i, mode: "combine" },
];

type E = { id: string; date: string; vendor_text: string; amount: number; currency: string; status: string; exclusion: string | null };
type I = { id: string; doc_date: string; vendor_name: string | null; amount: number; currency: string; doc_number: string | null };
const c = (n: number) => Math.round(n * 100);
const days = (a: string, b: string) => (Date.parse(a) - Date.parse(b)) / 864e5;

async function load() {
  const [{ data: ex }, { data: iv }, { data: ms }] = await Promise.all([
    db().from("expenses").select("id, date, vendor_text, amount, currency, status, exclusion"),
    db().from("invoices").select("id, doc_date, vendor_name, amount, currency, doc_number").eq("is_invoice", true).not("amount", "is", null),
    db().from("matches").select("expense_id, invoice_id, kind, amount"),
  ]);
  const exps = (ex || []).map((e) => ({ ...e, amount: Number(e.amount) })) as E[];
  const invs = (iv || []).map((i) => ({ ...i, amount: Number(i.amount) })) as I[];
  return { exps, invs, ms: ms || [] };
}

export async function autoGroup() {
  const { exps, invs, ms } = await load();
  const linked = new Set(ms.filter((m) => m.kind !== "rejected").map((m) => m.expense_id));
  const rejected = new Set(ms.filter((m) => m.kind === "rejected").map((m) => `${m.expense_id}:${m.invoice_id}`));
  const paid = new Map<string, number>();
  const usedWhole = new Set<string>();
  for (const m of ms) {
    if (m.kind === "installment" || m.kind === "group") paid.set(m.invoice_id, (paid.get(m.invoice_id) || 0) + Number(m.amount || 0));
    else if (m.kind !== "rejected") usedWhole.add(m.invoice_id);
  }
  const rows: { expense_id: string; invoice_id: string; kind: string; amount: number; created_by: string }[] = [];
  const add = (e: E, i: I, kind: string, amount: number) => {
    rows.push({ expense_id: e.id, invoice_id: i.id, kind, amount, created_by: "באדי" });
    paid.set(i.id, (paid.get(i.id) || 0) + amount);
    linked.add(e.id);
  };
  const needs = (e: E) => !linked.has(e.id) && (e.status === "required" || (e.status === "auto" && !e.exclusion));

  for (const f of FAMILIES) {
    const fe = exps.filter((e) => f.exp.test(e.vendor_text) && needs(e)).sort((a, b) => a.date.localeCompare(b.date));
    const fi = invs.filter((i) => f.inv.test(i.vendor_name || "") && !usedWhole.has(i.id)).sort((a, b) => a.doc_date.localeCompare(b.doc_date));
    if (f.mode === "installments") {
      for (const e of fe) {
        const ok = fi.filter((i) => {
          const left = i.amount - (paid.get(i.id) || 0);
          return i.currency === e.currency && !rejected.has(`${e.id}:${i.id}`) && days(e.date, i.doc_date) >= -10 && days(e.date, i.doc_date) <= 200 && c(left) >= c(e.amount) - 1;
        });
        // Prefer the invoice this transfer is a clean fraction of (8,333.33 of 25,000), then the oldest one
        const frac = (i: I) => {
          const r = i.amount / e.amount;
          return Math.abs(r - Math.round(r)) * Math.round(r) * e.amount <= 0.05 && Math.round(r) >= 2 && Math.round(r) <= 4;
        };
        const pick = ok.find(frac) || ok[0];
        if (pick) add(e, pick, "installment", Math.min(e.amount, pick.amount - (paid.get(pick.id) || 0)));
      }
    } else {
      for (const e of fe) {
        const pool = fi.filter(
          (i) => i.currency === e.currency && !paid.has(i.id) && !rejected.has(`${e.id}:${i.id}`) && days(e.date, i.doc_date) >= -10 && days(e.date, i.doc_date) <= 60,
        );
        if (pool.some((i) => c(i.amount) === c(e.amount))) continue; // a single exact invoice: the regular matcher handles it
        let found: I[] | null = null;
        for (let a = 0; a < pool.length && !found; a++)
          for (let b = a + 1; b < pool.length && !found; b++) {
            if (c(pool[a].amount + pool[b].amount) === c(e.amount)) found = [pool[a], pool[b]];
            for (let d = b + 1; d < pool.length && !found; d++)
              if (c(pool[a].amount + pool[b].amount + pool[d].amount) === c(e.amount)) found = [pool[a], pool[b], pool[d]];
          }
        if (!found) {
          // Part of the payment is documented: keep that link, the rest shows as a missing invoice
          const part = pool.filter((i) => i.amount < e.amount && i.amount >= e.amount * 0.6).sort((x, y) => Math.abs(days(e.date, x.doc_date)) - Math.abs(days(e.date, y.doc_date)))[0];
          if (part) found = [part];
        }
        for (const i of found || []) add(e, i, "group", i.amount);
      }
    }
  }
  if (rows.length) {
    const { error } = await db().from("matches").upsert(rows, { onConflict: "expense_id,invoice_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  return rows.length;
}

/** Run at most every 20 minutes from the engine. */
export async function autoGroupStep() {
  const last = await getSetting<number>("auto_group_at");
  if (last && Date.now() - last < 20 * 60e3) return 0;
  await setSetting("auto_group_at", Date.now());
  return autoGroup();
}

/** Installment invoices that still have money to pay: what is expected to leave the account. */
export async function expectedPayments() {
  const { exps, invs, ms } = await load();
  const first = exps.reduce((m, e) => (e.date < m ? e.date : m), "9999");
  const out: { vendor: string; doc: string | null; currency: string; left: number; paid: number; total: number }[] = [];
  for (const f of FAMILIES.filter((x) => x.mode === "installments")) {
    for (const i of invs.filter((x) => f.inv.test(x.vendor_name || "") && x.doc_date >= first)) {
      const links = ms.filter((m) => m.invoice_id === i.id && m.kind === "installment");
      if (ms.some((m) => m.invoice_id === i.id && (m.kind === "manual" || m.kind === "auto"))) continue;
      const done = links.reduce((s, m) => s + Number(m.amount || 0), 0);
      const left = i.amount - done;
      if (left > links.length * 0.01 + 0.005) out.push({ vendor: i.vendor_name || f.key, doc: i.doc_number, currency: i.currency, left, paid: links.length, total: i.amount });
    }
  }
  return out;
}
