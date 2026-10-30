export type Expense = {
  id: string;
  date: string;
  vendor_text: string;
  purpose?: string | null;
  amount: number;
  currency: string;
  orig_amount?: number | null;
  orig_currency?: string | null;
};
export type Invoice = {
  id: string;
  doc_date: string | null;
  vendor_name: string | null;
  email_from?: string | null;
  email_subject?: string | null;
  file_name?: string | null;
  amount: number | null;
  currency: string | null;
};
export type Match = { expense_id: string; invoice_id: string; kind: "auto" | "suggest"; score: number };

const ALIASES: [RegExp, string][] = [
  [/facebk|metapay|facebook|\bmeta\b|מטא/i, "meta"],
  [/google|גוגל|~ADS\d{6,}/i, "google"],
  [/microsoft|מיקרוסופט/i, "microsoft"],
  [/תפוז/i, "tapuz"],
  [/סלקום|cellcom/i, "cellcom"],
  [/higgsfield/i, "higgsfield"],
  [/windsor/i, "windsor"],
  [/make\.com|\bmake\b/i, "make"],
  [/heyy/i, "heyy"],
  [/fedex|פדקס/i, "fedex"],
  [/paycall|פייקול/i, "paycall"],
  [/אלוהה|aloha/i, "aloha"],
  [/anthropic|claude/i, "anthropic"],
  [/zendesk/i, "zendesk"],
  [/canva/i, "canva"],
  [/flashy|פלאשי/i, "flashy"],
  [/גייטפורט|gateport/i, "gateport"],
  [/יוניקו|unico/i, "unico"],
  [/אייר דיגיטל|air digital/i, "air"],
];
const alias = (s: string) => ALIASES.find(([re]) => re.test(s))?.[1] ?? null;
const STOP = /^(בעמ|ltd|inc|the|com|www|חשבונית|invoice|receipt|קבלה|מספר|noreply|no-reply)$/;
const tokens = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.test(w));

export function vendorSimilarity(e: Expense, inv: Invoice): number {
  const a = `${e.vendor_text} ${e.purpose || ""}`;
  const b = [inv.vendor_name, inv.email_from, inv.email_subject, inv.file_name].filter(Boolean).join(" ");
  const ka = alias(a),
    kb = alias(b);
  if (ka && kb) return ka === kb ? 1 : 0;
  const ta = tokens(a),
    bl = b.toLowerCase();
  if (!ta.length) return 0;
  const hit = ta.filter((w) => bl.includes(w)).length;
  return hit ? Math.min(1, 0.55 + 0.25 * hit) : 0;
}

const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
const same = (x: number | null | undefined, y: number | null | undefined) => x != null && y != null && Math.abs(x - y) < 0.005;

export function amountMatches(e: Expense, inv: Invoice) {
  const c = inv.currency || "ILS";
  return (c === e.currency && same(inv.amount, e.amount)) || (!!e.orig_currency && c === e.orig_currency && same(inv.amount, e.orig_amount));
}

/**
 * One-to-one matching: exact amount within the window is auto (best vendor similarity, then closest date);
 * same vendor without an exact amount is a suggestion. `rejected` holds expense:invoice pairs a person unlinked.
 */
export function matchAll(expenses: Expense[], invoices: Invoice[], opts: { windowDays?: number; rejected?: Set<string> } = {}): Match[] {
  const win = opts.windowDays ?? 45;
  const rej = opts.rejected ?? new Set<string>();
  const pairs: { e: Expense; i: Invoice; s: number; d: number }[] = [];
  for (const e of expenses)
    for (const i of invoices) {
      if (!i.doc_date || rej.has(`${e.id}:${i.id}`) || !amountMatches(e, i)) continue;
      const d = days(e.date, i.doc_date);
      if (d <= win) pairs.push({ e, i, s: vendorSimilarity(e, i), d });
    }
  pairs.sort((x, y) => y.s - x.s || x.d - y.d);
  const usedE = new Set<string>(),
    usedI = new Set<string>(),
    out: Match[] = [];
  for (const p of pairs) {
    if (usedE.has(p.e.id) || usedI.has(p.i.id)) continue;
    usedE.add(p.e.id);
    usedI.add(p.i.id);
    out.push({ expense_id: p.e.id, invoice_id: p.i.id, kind: "auto", score: 1 + p.s });
  }
  for (const e of expenses) {
    if (usedE.has(e.id)) continue;
    let best: { i: Invoice; s: number } | null = null;
    for (const i of invoices) {
      if (usedI.has(i.id) || rej.has(`${e.id}:${i.id}`) || !i.doc_date || days(e.date, i.doc_date) > win) continue;
      const s = vendorSimilarity(e, i);
      if (s >= 0.75 && (!best || s > best.s)) best = { i, s };
    }
    if (best) out.push({ expense_id: e.id, invoice_id: best.i.id, kind: "suggest", score: best.s });
  }
  return out;
}
