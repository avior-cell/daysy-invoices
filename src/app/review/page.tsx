import Shell, { pickMonth, requireUser } from "@/components/Shell";
import ActionButton from "@/components/ActionButton";
import { money, day } from "@/components/fmt";
import { loadMonth, monthName } from "@/lib/data";
import { approveMatch, markNotInvoice, rejectMatch } from "../actions";

export const dynamic = "force-dynamic";

export default async function Review({ searchParams }: { searchParams: { m?: string } }) {
  await requireUser();
  const { month, months } = await pickMonth(searchParams.m);
  const { rows, orphans, kpi } = await loadMonth(month);
  const pending = rows.filter((r) => r.st === "suggest" && r.inv);

  return (
    <Shell path="/review" month={month} months={months} reviewCount={kpi.suggest}>
      <div className="section-head">
        <h1>לאישור · {monthName(month)}</h1>
        <span className="sub">חשבונית מאותו ספק, בלי סכום זהה. אשרו אם זו החשבונית של החיוב.</span>
      </div>
      {pending.length === 0 ? (
        <div className="card empty">אין הצעות שמחכות לאישור.</div>
      ) : (
        pending.map((r) => {
          const inv = r.inv!;
          const diff = inv.amount != null && r.e.currency === (inv.currency || "ILS") ? inv.amount - r.e.amount : null;
          return (
            <article className="card" key={r.e.id}>
              <div className="pair">
                <div className="side">
                  <span className="k">חיוב ב{r.e.source === "card" ? "אשראי" : "בנק"}</span>
                  <strong>{r.e.vendor_text}</strong>
                  <span>
                    <span className="num">{money(r.e.amount, r.e.currency)}</span> · <span className="num">{day(r.e.date)}</span>
                  </span>
                  {r.e.purpose && <span className="sub">{r.e.purpose}</span>}
                </div>
                <span className="vs">מול</span>
                <div className="side">
                  <span className="k">חשבונית שנמצאה</span>
                  <strong>{inv.vendor_name || inv.email_from}</strong>
                  <span>
                    <span className="num">{money(inv.amount, inv.currency)}</span> · <span className="num">{day(inv.doc_date)}</span>
                    {inv.doc_number ? ` · מס׳ ${inv.doc_number}` : ""}
                  </span>
                  {diff != null && Math.abs(diff) >= 0.01 && (
                    <span className="diff">
                      הפרש <span className="num">{money(diff, inv.currency)}</span>
                    </span>
                  )}
                  <span style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
                    {inv.drive_url && <a href={inv.drive_url} target="_blank" rel="noopener">פתיחת הקובץ</a>}
                    {inv.source_url && <a href={inv.source_url} target="_blank" rel="noopener">המייל</a>}
                    {inv.download_url && !inv.drive_url && <a href={inv.download_url} target="_blank" rel="noopener">קישור החשבונית</a>}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ActionButton action={approveMatch.bind(null, r.e.id, inv.id)} label="כן, זו החשבונית" primary small={false} />
                <ActionButton action={rejectMatch.bind(null, r.e.id, inv.id)} label="לא מתאים" small={false} />
              </div>
            </article>
          );
        })
      )}

      {orphans.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h2>חשבוניות בלי חיוב תואם</h2>
            <span className="sub">לרוב תשלום בכרטיס אחר, במטבע זר, או מסמך שאינו חשבונית</span>
          </div>
          <div className="list">
            {orphans.map((i) => (
              <div className="item" key={i.id}>
                <div>
                  <div className="title">{i.vendor_name || i.email_from}</div>
                  <div className="meta">
                    <span className="num">{day(i.doc_date)}</span> · {i.email_subject || i.file_name}
                  </div>
                </div>
                <div className="amt">{money(i.amount, i.currency)}</div>
                <div className="actions">
                  {i.drive_url && <a className="btn small" href={i.drive_url} target="_blank" rel="noopener">פתיחה</a>}
                  <ActionButton action={markNotInvoice.bind(null, i.id)} label="זו לא חשבונית" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}
