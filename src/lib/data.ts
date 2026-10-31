import { db } from "./db";
import { matchAll, vendorSimilarity, amountMatches, type Expense, type Invoice } from "./match";

export type Status = "filed" | "nofile" | "suggest" | "missing" | "excluded";
export type Row = {
  e: Expense & { source: string; month: string; exclusion: string | null; status: string; note: string | null };
  st: Status;
  inv: InvoiceRow | null;
  how: "auto" | "manual" | null;
  why?: string;
};
export type InvoiceRow = Invoice & {
  month: string | null;
  drive_url: string | null;
  download_url: string | null;
  source_url: string | null;
  source: string;
  doc_number: string | null;
  doc_type: string | null;
  /** Already uploaded to the accountant's Sumit, so it counts as delivered */
  inSumit?: boolean;
};

/** Documents that can cover several charges: a monthly statement, or a supplier invoice paid in installments */
export const isShared = (i: InvoiceRow) => i.doc_type === "statement";
const NOT_MATCHABLE = new Set(["statement", "fee_invoice", "fee_report"]);
export type FeeRow = { key: string; name: string; st: Status; inv: InvoiceRow | null };

export const FEES = [
  { key: "yatzil", name: "יציל פיננסים", re: /יציל|yatzil|yazil/i },
  { key: "max", name: "מקס, עמלות סליקה", re: /\bmax\b|מקס|max\.co\.il/i },
  { key: "buyme", name: "BUYME", re: /buy ?me|ביימי|ביי מי/i },
];

export function addMonth(m: string, n: number) {
  let [y, mm] = m.split("-").map(Number);
  mm += n;
  while (mm > 12) (mm -= 12), y++;
  while (mm < 1) (mm += 12), y--;
  return `${y}-${String(mm).padStart(2, "0")}`;
}
const HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
export const monthName = (m: string) => `${HE[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export async function availableMonths(): Promise<string[]> {
  const { data } = await db().from("expenses").select("month").order("month", { ascending: false });
  const set = new Set((data || []).map((r) => r.month as string));
  const now = new Date().toISOString().slice(0, 7);
  set.add(now);
  return [...set].sort().reverse();
}

const INV_COLS =
  "id, doc_date, vendor_name, email_from, email_subject, file_name, amount, currency, month, drive_url, download_url, source_url, source, doc_number, doc_type";

export async function loadMonth(month: string) {
  const [{ data: exps }, { data: invs }, { data: links }, { data: fees }] = await Promise.all([
    db().from("expenses").select("*").eq("month", month).order("date", { ascending: false }),
    // Invoices can be dated a little before or after the charge
    // Invoices can be dated a little before or after the charge; import invoices are paid in installments months later
    db().from("invoices").select(INV_COLS).eq("is_invoice", true).in("month", [addMonth(month, -3), addMonth(month, -2), addMonth(month, -1), month, addMonth(month, 1)]),
    db().from("matches").select("expense_id, invoice_id, kind"),
    db().from("fee_requirements").select("*").eq("month", month),
  ]);
  const expenses = (exps || []).map((e) => ({ ...e, amount: Number(e.amount), orig_amount: e.orig_amount == null ? null : Number(e.orig_amount) }));
  const norm = (i: Record<string, unknown>) =>
    ({ ...i, amount: i.amount == null ? null : Number(i.amount), inSumit: String(i.drive_url || "").startsWith("https://app.sumit") }) as InvoiceRow;
  const invoices = (invs || []).map(norm);
  const byId = new Map(invoices.map((i) => [i.id, i]));
  // A manual link can point at an invoice outside the window (an old import invoice): fetch those too
  const ids = new Set(expenses.map((e) => e.id));
  const missingIds = [...new Set((links || []).filter((l) => l.kind !== "rejected" && ids.has(l.expense_id) && !byId.has(l.invoice_id)).map((l) => l.invoice_id))];
  if (missingIds.length) {
    const { data: extra } = await db().from("invoices").select(INV_COLS).in("id", missingIds);
    for (const i of extra || []) byId.set(i.id, norm(i));
  }
  const manual = new Map<string, string>();
  const rejected = new Set<string>();
  const usedManual = new Set<string>();
  for (const l of links || []) {
    if (l.kind === "rejected") rejected.add(`${l.expense_id}:${l.invoice_id}`);
    else {
      manual.set(l.expense_id, l.invoice_id);
      usedManual.add(l.invoice_id);
    }
  }
  const required = expenses.filter((e) => (e.status === "required" || (e.status === "auto" && !e.exclusion)) && !manual.has(e.id));
  const free = invoices.filter((i) => !usedManual.has(i.id) && !NOT_MATCHABLE.has(i.doc_type || ""));
  const auto = new Map(matchAll(required, free, { rejected }).map((m) => [m.expense_id, m]));

  const rows: Row[] = expenses.map((e) => {
    if (e.status === "not_required" || (e.status === "auto" && e.exclusion)) return { e, st: "excluded", inv: null, how: null, why: e.exclusion || "סומן ידנית" };
    const mid = manual.get(e.id);
    if (mid) {
      const inv = byId.get(mid) || null;
      return { e, st: inv?.drive_url ? "filed" : "nofile", inv, how: "manual" };
    }
    const m = auto.get(e.id);
    if (!m) return { e, st: "missing", inv: null, how: null };
    const inv = byId.get(m.invoice_id) || null;
    if (m.kind === "suggest") return { e, st: "suggest", inv, how: null };
    return { e, st: inv?.drive_url ? "filed" : "nofile", inv, how: "auto" };
  });

  const usedInv = new Set(rows.map((r) => r.inv?.id).filter(Boolean) as string[]);
  const feeRows: FeeRow[] = FEES.map((f) => {
    const saved = (fees || []).find((x) => x.key === f.key);
    if (saved?.status === "not_required") return { key: f.key, name: f.name, st: "excluded", inv: null };
    const inv =
      (saved?.invoice_id && byId.get(saved.invoice_id)) ||
      invoices.find((i) => !usedInv.has(i.id) && (i.month === month || i.month === addMonth(month, 1)) && f.re.test([i.vendor_name, i.email_from, i.email_subject, i.file_name].join(" "))) ||
      null;
    return { key: f.key, name: f.name, st: inv ? (inv.drive_url ? "filed" : "nofile") : "missing", inv };
  });
  feeRows.forEach((f) => f.inv && usedInv.add(f.inv.id));
  const orphans = invoices.filter((i) => i.month === month && !usedInv.has(i.id));

  const req = rows.filter((r) => r.st !== "excluded");
  const ils = (rs: Row[]) => rs.reduce((s, r) => s + (r.e.currency === "ILS" ? r.e.amount : 0), 0);
  const count = (s: Status) => req.filter((r) => r.st === s).length;
  const kpi = {
    spend: ils(rows),
    required: req.length,
    filed: count("filed"),
    nofile: count("nofile"),
    suggest: count("suggest"),
    missing: count("missing"),
    missingIls: ils(req.filter((r) => r.st === "missing" || r.st === "suggest")),
    inSumit: req.filter((r) => r.st === "filed" && r.inv?.inSumit).length,
    feesOpen: feeRows.filter((f) => f.st === "missing" || f.st === "nofile").length,
  };
  return { rows, feeRows, orphans, kpi, invoices };
}

/**
 * Candidate invoices for one expense, best first: exact amount, then vendor similarity, then date.
 * A statement or a larger invoice from the same vendor stays available after it is used, because one
 * document can cover several charges (monthly Google Ads report, import invoice paid in installments).
 */
export function candidatesFor(e: Expense, invoices: InvoiceRow[], used: Set<string>) {
  return invoices
    .filter((i) => i.doc_type !== "fee_invoice" && i.doc_type !== "fee_report")
    .map((i) => {
      const exact = amountMatches(e, i);
      const sim = vendorSimilarity(e, i);
      const covers = !exact && sim >= 0.5 && i.amount != null && (isShared(i) || i.amount > (e.currency === i.currency ? e.amount : e.orig_amount ?? Infinity));
      const days = i.doc_date ? Math.abs(Date.parse(e.date) - Date.parse(i.doc_date)) / 864e5 : 120;
      return { i, exact, covers, score: (exact ? 2 : 0) + (covers ? 1 : 0) + sim - Math.min(days, 120) / 120 };
    })
    .filter((x) => !used.has(x.i.id) || x.covers)
    .filter((x) => x.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/** Group what is still open by vendor, largest first, so the close-month list reads as a to-do. */
export function openByVendor(rows: Row[]) {
  const groups = new Map<string, { vendor: string; rows: Row[]; ils: number }>();
  for (const r of rows) {
    if (r.st !== "missing" && r.st !== "suggest" && r.st !== "nofile") continue;
    const key = vendorKey(r.e.vendor_text);
    const g = groups.get(key) || { vendor: key, rows: [], ils: 0 };
    g.rows.push(r);
    g.ils += r.e.currency === "ILS" ? r.e.amount : 0;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.ils - a.ils);
}

export function vendorKey(v: string) {
  if (/facebk|metapay|facebook/i.test(v)) return "Meta (פייסבוק ואינסטגרם)";
  if (/google\s*workspace/i.test(v)) return "Google Workspace";
  if (/google|~ADS\d{6,}/i.test(v)) return "Google Ads";
  if (/tiktok/i.test(v)) return "TikTok Ads";
  if (/flashy/i.test(v)) return "Flashy";
  if (/heyy/i.test(v)) return "Heyy";
  if (/make\.com/i.test(v)) return "Make";
  if (/תש\. יבוא/.test(v)) return "תשלומי יבוא (חברת האם)";
  return v.replace(/^(DUBLIN 4?|NEWARK|NEW YORK|WILMINGTON|SURRY HILLS|AMSTERDAM|SINGAPORE|CC GOOGLE\.COM|FB\.ME\/ADS)\s*~?/i, "").replace(/\s+/g, " ").trim();
}

/** Where to get a missing invoice, for the vendors that publish them in a billing portal. */
export function billingLink(vendorText: string): { label: string; url: string } | null {
  const v = vendorText;
  if (/facebk|metapay|facebook/i.test(v)) return { label: "Meta Billing", url: "https://business.facebook.com/billing_hub/payment_activity" };
  if (/google\s*workspace/i.test(v)) return { label: "Google Workspace", url: "https://admin.google.com/ac/billing/accounts" };
  if (/google|~ADS\d{6,}/i.test(v)) return { label: "Google Ads", url: "https://ads.google.com/aw/billing/documents" };
  if (/tiktok/i.test(v)) return { label: "TikTok Ads", url: "https://ads.tiktok.com/i18n/account/payment" };
  if (/microsoft/i.test(v)) return { label: "Microsoft", url: "https://admin.microsoft.com/Adminportal/Home#/billoverview/invoice-list" };
  if (/canva/i.test(v)) return { label: "Canva", url: "https://www.canva.com/settings/purchase-history" };
  if (/make\.com/i.test(v)) return { label: "Make", url: "https://www.make.com/en/login" };
  if (/flashy/i.test(v)) return { label: "Flashy", url: "https://app.flashy.app" };
  return null;
}
