import Link from "next/link";
import Shell, { pickMonth, requireUser } from "@/components/Shell";
import Upload from "@/components/Upload";
import ActionButton from "@/components/ActionButton";
import { ils, money, day } from "@/components/fmt";
import { addMonth, billingLink, loadMonth, monthName, openByVendor } from "@/lib/data";
import { setFee } from "./actions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function Ring({ pct }: { pct: number }) {
  const r = 54, c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 132 132" role="img" aria-label={`${pct}% מוכן להגשה`}>
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--sunk)" strokeWidth="12" />
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 66 66)" />
      <text x="66" y="72" textAnchor="middle" fontSize="26" fontWeight="600" fill="var(--ink)">{pct}%</text>
    </svg>
  );
}

export default async function Home({ searchParams }: { searchParams: { m?: string } }) {
  await requireUser();
  const { month, months } = await pickMonth(searchParams.m);
  const { rows, feeRows, kpi } = await loadMonth(month);
  const { data: folder } = await db().from("drive_folders").select("folder_id").eq("month", month).maybeSingle();
  const pct = kpi.required ? Math.round((kpi.filed / kpi.required) * 100) : 0;
  const due = new Date(`${addMonth(month, 1)}-10T23:59:00`);
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / 864e5);
  const groups = openByVendor(rows);

  return (
    <Shell path="/" month={month} months={months} reviewCount={kpi.suggest}>
      <section className="card">
        <div className="hero">
          <Ring pct={pct} />
          <div className="hero-facts">
            <h1>סגירת {monthName(month)}</h1>
            <div className="big">
              <span className="num">{kpi.filed}</span> מתוך <span className="num">{kpi.required}</span> הוצאות עם חשבונית
              {kpi.inSumit ? (
                <span className="sub">
                  {" "}
                  · <span className="num">{kpi.inSumit}</span> מהן כבר בסאמיט
                </span>
              ) : null}
            </div>
            <div className="sub">
              הוצאות בפועל <span className="num">{ils(kpi.spend)}</span> · עוד חסר כיסוי ל־<span className="num">{ils(kpi.missingIls)}</span> ·{" "}
              {daysLeft > 0 ? (
                <>
                  <span className="num">{daysLeft}</span> ימים עד הגשה ב־10/{addMonth(month, 1).slice(5)}
                </>
              ) : (
                "מועד ההגשה עבר"
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {folder && (
                <a className="btn" href={`https://drive.google.com/drive/folders/${folder.folder_id}`} target="_blank" rel="noopener">
                  תיקיית החודש ב־Drive
                </a>
              )}
              <Upload month={month} label="העלאת חשבונית" primary />
              <a className="btn" href={`/api/export?m=${month}`}>
                ייצוא לאקסל
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="tiles" aria-label="מצב החודש">
        <Link className="tile warn" href={`/review?m=${month}`}>
          <span className="sub">לאישור שלך</span>
          <span className="v">{kpi.suggest}</span>
        </Link>
        <Link className="tile bad" href={`/expenses?m=${month}&f=missing`}>
          <span className="sub">חסרות לגמרי</span>
          <span className="v">{kpi.missing}</span>
        </Link>
        <Link className="tile warn" href={`/expenses?m=${month}&f=nofile`}>
          <span className="sub">נמצאו, חסר קובץ</span>
          <span className="v">{kpi.nofile}</span>
        </Link>
        <a className={`tile ${kpi.feesOpen ? "bad" : "ok"}`} href="#fees">
          <span className="sub">עמלות סליקה</span>
          <span className="v">{3 - kpi.feesOpen}/3</span>
        </a>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>מה נשאר להשלים</h2>
          <span className="sub">לפי ספק, הגדול קודם</span>
        </div>
        {groups.length === 0 ? (
          <div className="empty">{kpi.required ? "הכל מכוסה. אפשר להגיש לרו״ח." : "אין עדיין הוצאות לחודש הזה."}</div>
        ) : (
          <div className="list">
            {groups.map((g) => {
              const link = billingLink(g.rows[0].e.vendor_text);
              return (
                <details className="item" key={g.vendor}>
                  <summary>
                    <div>
                      <div className="title">{g.vendor}</div>
                      <div className="meta">
                        <span className="num">{g.rows.length}</span> חיובים ·{" "}
                        {g.rows.filter((r) => r.st === "suggest").length ? `${g.rows.filter((r) => r.st === "suggest").length} לאישור · ` : ""}
                        {g.rows.filter((r) => r.st === "nofile").length ? `${g.rows.filter((r) => r.st === "nofile").length} חסר קובץ · ` : ""}
                        {g.rows.filter((r) => r.st === "missing").length} חסרות
                      </div>
                    </div>
                    <div className="amt">{ils(g.ils)}</div>
                  </summary>
                  <div className="drawer">
                    {link && (
                      <div>
                        <a className="btn small" href={link.url} target="_blank" rel="noopener">
                          להורדה מ־{link.label}
                        </a>
                      </div>
                    )}
                    {g.rows.map((r) => (
                      <div className="cand" key={r.e.id}>
                        <span>
                          <span className="num">{day(r.e.date)}</span> · <span className="num">{money(r.e.amount, r.e.currency)}</span>
                          {r.e.purpose ? ` · ${r.e.purpose}` : ""}
                          {r.st === "suggest" && r.inv ? <span className="sub"> · הצעה: {r.inv.vendor_name}</span> : null}
                        </span>
                        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {r.st === "nofile" && r.inv?.download_url && (
                            <a className="btn small" href={r.inv.download_url} target="_blank" rel="noopener">
                              הורדה מהקישור
                            </a>
                          )}
                          <Upload expenseId={r.e.id} label="העלאה" />
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section className="card" id="fees">
        <div className="section-head">
          <h2>עמלות סליקה</h2>
          <span className="sub">נכנסות לבנק נטו, לכן צריך חשבונית חודשית מכל אחד</span>
        </div>
        <div className="list">
          {feeRows.map((f) => (
            <div className="item" key={f.key}>
              <div>
                <div className="title">{f.name}</div>
                <div className="meta">{f.inv ? `${f.inv.vendor_name || ""} · ${money(f.inv.amount, f.inv.currency)}` : "לא נמצאה חשבונית לחודש הזה"}</div>
              </div>
              <span className={`pill ${f.st}`}>{f.st === "filed" ? (f.inv?.inSumit ? "בסאמיט" : "בתיקייה") : f.st === "excluded" ? "לא נדרש" : f.st === "nofile" ? "חסר קובץ" : "חסרה"}</span>
              {f.st !== "filed" && f.st !== "excluded" && (
                <div className="actions">
                  <Upload feeKey={f.key} month={month} label="העלאה" />
                  <ActionButton action={setFee.bind(null, month, f.key, "not_required", undefined)} label="לא היו עמלות החודש" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
