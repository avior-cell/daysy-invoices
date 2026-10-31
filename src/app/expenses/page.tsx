import Link from "next/link";
import Shell, { pickMonth, requireUser } from "@/components/Shell";
import ActionButton from "@/components/ActionButton";
import Upload from "@/components/Upload";
import { money, day, STATUS_LABEL } from "@/components/fmt";
import { billingLink, candidatesFor, loadMonth, monthName } from "@/lib/data";
import { approveMatch, setRequired } from "../actions";

export const dynamic = "force-dynamic";
const FILTERS = [
  ["todo", "להשלמה"],
  ["missing", "חסרות"],
  ["suggest", "לאישור"],
  ["nofile", "חסר קובץ"],
  ["filed", "בתיקייה"],
  ["excluded", "לא נדרש"],
  ["all", "הכל"],
] as const;

export default async function Expenses({ searchParams }: { searchParams: { m?: string; f?: string } }) {
  await requireUser();
  const { month, months } = await pickMonth(searchParams.m);
  const f = searchParams.f || "todo";
  const { rows, kpi, invoices } = await loadMonth(month);
  const used = new Set(rows.map((r) => r.inv?.id).filter(Boolean) as string[]);
  const shown = rows.filter((r) => (f === "all" ? true : f === "todo" ? ["missing", "suggest", "nofile"].includes(r.st) : r.st === f));
  const n = (k: string) => (k === "all" ? rows.length : k === "todo" ? rows.filter((r) => ["missing", "suggest", "nofile"].includes(r.st)).length : rows.filter((r) => r.st === k).length);

  return (
    <Shell path="/expenses" month={month} months={months} reviewCount={kpi.suggest}>
      <div className="section-head">
        <h1>הוצאות · {monthName(month)}</h1>
        <span className="sub">כל החיובים בבנק ובאשראי</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <a className="btn small" href={`/api/export?m=${month}`}>
          ייצוא לאקסל
        </a>
      </div>
      <nav className="chips" aria-label="סינון">
        {FILTERS.map(([k, l]) => (
          <Link key={k} className="chip" aria-current={f === k ? "true" : undefined} href={`/expenses?m=${month}&f=${k}`}>
            {l} <span className="num">{n(k)}</span>
          </Link>
        ))}
      </nav>
      <div className="list">
        {shown.length === 0 && <div className="empty">אין חיובים בסינון הזה.</div>}
        {shown.map((r) => {
          const link = billingLink(r.e.vendor_text);
          const cands = r.st === "missing" || r.st === "suggest" ? candidatesFor(r.e, invoices, used) : [];
          return (
            <details className="item" key={r.e.id}>
              <summary>
                <div>
                  <div className="title">{r.e.vendor_text}</div>
                  <div className="meta">
                    <span className="num">{day(r.e.date)}</span> · {r.e.source === "card" ? "אשראי" : "בנק"}
                    {r.e.purpose ? ` · ${r.e.purpose}` : ""}
                    {r.st === "excluded" && r.why ? ` · ${r.why}` : ""}
                  </div>
                </div>
                <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
                  <span className="amt">{money(r.e.amount, r.e.currency)}</span>
                  <span className={`pill ${r.st}`}>{r.st === "filed" && r.inv?.inSumit ? "בסאמיט" : STATUS_LABEL[r.st]}</span>
                </div>
              </summary>
              <div className="drawer">
                {r.inv && (
                  <div className="cand">
                    <span>
                      {r.st === "suggest" ? "הצעה: " : "חשבונית: "}
                      {r.inv.vendor_name} · <span className="num">{money(r.inv.amount, r.inv.currency)}</span> · <span className="num">{day(r.inv.doc_date)}</span>
                      {r.how === "auto" ? " · התאמה אוטומטית" : ""}
                    </span>
                    <span style={{ display: "flex", gap: 6 }}>
                      {r.inv.drive_url && (
                        <a className="btn small" href={r.inv.drive_url} target="_blank" rel="noopener">
                          {r.inv.inSumit ? "בסאמיט" : "פתיחה"}
                        </a>
                      )}
                      {r.inv.download_url && !r.inv.drive_url && <a className="btn small" href={r.inv.download_url} target="_blank" rel="noopener">הורדה מהקישור</a>}
                    </span>
                  </div>
                )}
                {cands
                  .filter((c) => c.i.id !== r.inv?.id)
                  .map((c) => (
                    <div className="cand" key={c.i.id}>
                      <span>
                        {c.i.vendor_name || c.i.email_from} · <span className="num">{money(c.i.amount, c.i.currency)}</span> · <span className="num">{day(c.i.doc_date)}</span>
                        {c.covers ? (
                          <span className="sub"> · {c.i.doc_type === "statement" ? "דוח חודשי שמכסה כמה חיובים" : "חשבונית ששולמה בכמה תשלומים"}</span>
                        ) : (
                          !c.exact && <span className="sub"> · סכום שונה</span>
                        )}
                      </span>
                      <ActionButton action={approveMatch.bind(null, r.e.id, c.i.id)} label="שייך" />
                    </div>
                  ))}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {r.st !== "filed" && r.st !== "excluded" && <Upload expenseId={r.e.id} label="העלאת חשבונית" />}
                  {link && r.st !== "filed" && r.st !== "excluded" && (
                    <a className="btn small" href={link.url} target="_blank" rel="noopener">
                      {link.label}
                    </a>
                  )}
                  {r.st === "excluded" ? (
                    <ActionButton action={setRequired.bind(null, r.e.id, true)} label="דורש חשבונית" />
                  ) : (
                    r.st !== "filed" && <ActionButton action={setRequired.bind(null, r.e.id, false)} label="לא נדרשת חשבונית" />
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </Shell>
  );
}
