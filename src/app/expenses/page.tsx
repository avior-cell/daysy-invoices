import Link from "next/link";
import Shell, { pickMonth, requireMe } from "@/components/Shell";
import Hero from "@/components/Hero";
import { v } from "@/lib/voice";
import ActionButton from "@/components/ActionButton";
import Upload from "@/components/Upload";
import { money, day, STATUS_LABEL } from "@/components/fmt";
import { billingLink, candidatesFor, loadMonth, monthName } from "@/lib/data";
import { approveMatch, setRequired } from "../actions";

export const dynamic = "force-dynamic";
const FILTERS = [
  ["todo", "מה נשאר"],
  ["missing", "חסרות"],
  ["suggest", "לאישור"],
  ["nofile", "חסר קובץ"],
  ["filed", "בתיק"],
  ["excluded", "לא צריך"],
  ["all", "הכל"],
] as const;

export default async function Expenses({ searchParams }: { searchParams: { m?: string; f?: string } }) {
  const me = await requireMe();
  const { month, months } = await pickMonth(searchParams.m);
  const f = searchParams.f || "todo";
  const { rows, kpi, invoices } = await loadMonth(month);
  const used = new Set(rows.map((r) => r.inv?.id).filter(Boolean) as string[]);
  const shown = rows.filter((r) => (f === "all" ? true : f === "todo" ? ["missing", "suggest", "nofile"].includes(r.st) : r.st === f));
  const n = (k: string) => (k === "all" ? rows.length : k === "todo" ? rows.filter((r) => ["missing", "suggest", "nofile"].includes(r.st)).length : rows.filter((r) => r.st === k).length);

  return (
    <Shell path="/expenses" month={month} months={months} reviewCount={kpi.suggest}>
      <Hero small title={`ההוצאות של ${monthName(month).split(" ")[0]}.`} pill={`${kpi.required} חיובים, ${kpi.filed} בתיק`} />
      <div className="home wide">
      <nav className="chips" aria-label="סינון">
        {FILTERS.map(([k, l]) => (
          <Link key={k} className="chip" aria-current={f === k ? "true" : undefined} href={`/expenses?m=${month}&f=${k}`}>
            {l} <span className="num">{n(k)}</span>
          </Link>
        ))}
      </nav>
      <div className="list">
        {shown.length === 0 && <div className="empty">{f === "todo" ? "לא נשאר כלום. אפשר לנוח." : "אין כאן חיובים."}</div>}
        {shown.map((r) => {
          const link = billingLink(r.e.vendor_text);
          const cands = r.st === "missing" || r.st === "suggest" ? candidatesFor(r.e, invoices, used) : [];
          return (
            <details className="item" key={r.e.id}>
              <summary>
                <div>
                  <div className="title">{r.e.vendor_text}</div>
                  <div className="meta">
                    {r.e.source === "card" ? "כרטיס" : "העברה"}, <span className="num">{day(r.e.date)}</span>
                    {r.e.purpose ? `, ${r.e.purpose}` : ""}
                    {r.why ? `, ${r.why}` : ""}
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
                      {r.inv.vendor_name}, <span className="num">{money(r.inv.amount, r.inv.currency)}</span>, <span className="num">{day(r.inv.doc_date)}</span>
                      {r.how === "auto" ? ". באדי שייך לבד." : ""}
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
                        {c.i.vendor_name || c.i.email_from}, <span className="num">{money(c.i.amount, c.i.currency)}</span>, <span className="num">{day(c.i.doc_date)}</span>
                        {c.covers ? (
                          <span className="sub">. {c.i.doc_type === "statement" ? "דוח חודשי שמכסה כמה חיובים" : "חשבונית ששולמה בכמה תשלומים"}</span>
                        ) : (
                          !c.exact && <span className="sub">. סכום שונה</span>
                        )}
                      </span>
                      <ActionButton action={approveMatch.bind(null, r.e.id, c.i.id)} label="לשייך" />
                    </div>
                  ))}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {r.st !== "filed" && r.st !== "excluded" && <Upload expenseId={r.e.id} label={v(me.g, "צלם או העלה", "צלמי או העלי")} />}
                  {link && r.st !== "filed" && r.st !== "excluded" && (
                    <a className="btn small" href={link.url} target="_blank" rel="noopener">
                      {link.label}
                    </a>
                  )}
                  {r.st === "excluded" ? (
                    <ActionButton action={setRequired.bind(null, r.e.id, true)} label="צריך חשבונית" />
                  ) : (
                    r.st !== "filed" && <ActionButton action={setRequired.bind(null, r.e.id, false)} label="לא צריך חשבונית" />
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
      <a className="btn text" href={`/api/export?m=${month}`}>להוריד את החודש לאקסל</a>
      </div>
    </Shell>
  );
}
