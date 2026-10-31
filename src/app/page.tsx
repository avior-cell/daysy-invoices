import Link from "next/link";
import Shell, { pickMonth, requireUser } from "@/components/Shell";
import Upload from "@/components/Upload";
import ActionButton from "@/components/ActionButton";
import { ils, money } from "@/components/fmt";
import { addMonth, billingLink, loadMonth, monthName, openByVendor } from "@/lib/data";
import { setFee } from "./actions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date()));
  return h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב";
}

/** The receipt at the top: what is still missing, a barcode of the month's charges, and the "בתיק" stamp. */
function Receipt({ month, kpi, daysLeft }: { month: string; kpi: { required: number; filed: number; missingIls: number; missing: number; suggest: number; nofile: number }; daysLeft: number }) {
  const pct = kpi.required ? Math.round((kpi.filed / kpi.required) * 100) : 0;
  const open = kpi.required - kpi.filed;
  const n = Math.min(kpi.required, 60) || 1;
  const done = Math.round((kpi.filed / (kpi.required || 1)) * n);
  const heights = [26, 34, 22, 30, 34, 18, 28, 34, 24, 32];
  let zig = "M0 0 ";
  for (let x = 0; x <= 600; x += 12) zig += `L${x + 6} 9 L${x + 12} 0 `;
  return (
    <section className="receipt" aria-label={`סיכום ${monthName(month)}`}>
      <div className="paper">
        <div className="row">
          <span>הקלסר של {monthName(month)}</span>
          <span>{daysLeft > 0 ? `${daysLeft} ימים להגשה` : "מועד ההגשה עבר"}</span>
        </div>
        <div className="amount num">{ils(kpi.missingIls)}</div>
        <div className="what">{open ? `חסרים, ב־${open} חיובים` : "הכל בתיק. אפשר להגיש לרו״ח."}</div>
        <div className="barcode" aria-hidden="true">
          {Array.from({ length: n }, (_, i) => (
            <i key={i} className={i < done ? "on" : undefined} style={{ height: heights[i % heights.length] }} />
          ))}
        </div>
        <div className="row" style={{ marginTop: 6, maxWidth: "64%" }}>
          <span>{kpi.filed} בתיק</span>
          <span>{open} חסרים</span>
        </div>
        <svg className="stamp" viewBox="0 0 104 104" role="img" aria-label={`${pct} אחוז בתיק`}>
          <circle cx="52" cy="52" r="47" fill="none" stroke="#2e3fe0" strokeWidth="3" />
          <circle cx="52" cy="52" r="36" fill="none" stroke="#2e3fe0" strokeWidth="1.5" />
          <text x="52" y="52" textAnchor="middle" fontSize="24" fill="#2e3fe0">{pct}%</text>
          <text x="52" y="70" textAnchor="middle" fontSize="13" fill="#2e3fe0">בתיק</text>
        </svg>
      </div>
      <svg className="zig" viewBox="0 0 600 10" preserveAspectRatio="none" aria-hidden="true">
        <path d={zig + "L600 0 Z"} fill="#fff" />
      </svg>
    </section>
  );
}

export default async function Home({ searchParams }: { searchParams: { m?: string } }) {
  const user = await requireUser();
  const { month, months } = await pickMonth(searchParams.m);
  const { rows, feeRows, kpi } = await loadMonth(month);
  const since = new Date(Date.now() - 48 * 3600e3).toISOString();
  const [{ data: folder }, { data: fresh }, { count: freshTotal }] = await Promise.all([
    db().from("drive_folders").select("folder_id").eq("month", month).maybeSingle(),
    db().from("invoices").select("id, vendor_name, amount, currency").eq("is_invoice", true).gte("created_at", since).order("created_at", { ascending: false }).limit(4),
    db().from("invoices").select("id", { count: "exact", head: true }).eq("is_invoice", true).gte("created_at", since),
  ]);
  const due = new Date(`${addMonth(month, 1)}-10T23:59:00+03:00`);
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / 864e5);
  const groups = openByVendor(rows).slice(0, 3);
  const feesOpen = feeRows.filter((f) => f.st === "missing" || f.st === "nofile");
  const name = user.split("@")[0].replace(/^./, (c) => c.toUpperCase());
  const freshCount = freshTotal || 0;

  return (
    <Shell path="/" month={month} months={months} reviewCount={kpi.suggest} blue>
      <div className="home">
        <div className="hello">
          <img src="/buddy.jpg" alt="באדי" />
          <div>
            <div className="s">
              {greeting()}, {name}
            </div>
            <div className="t">{freshCount ? `ביומיים האחרונים נכנסו ${freshCount} חשבוניות חדשות` : kpi.required - kpi.filed ? "הנה מה שנשאר לסגור" : "הקלסר סגור, כל הכבוד"}</div>
          </div>
        </div>

        <Receipt month={month} kpi={kpi} daysLeft={daysLeft} />

        {freshCount > 0 && (
          <div className="msg soft">
            <span>{freshCount > 4 ? `נכנסו לקלסר ${freshCount} מסמכים. האחרונים:` : "נכנסו לקלסר לבד, בלי שתצטרך לעשות כלום:"}</span>
            <div className="mini">
              {fresh!.map((f) => (
                <div key={f.id}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#2e3fe0" /><path d="M4.5 8 l2.2 2.2 l4.3 -4.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>{f.vendor_name || "מסמך"}</span>
                  <b className="num">{money(f.amount, f.currency)}</b>
                </div>
              ))}
            </div>
          </div>
        )}

        {kpi.suggest > 0 && (
          <div className="msg yellow">
            <span>{kpi.suggest === 1 ? "חשבונית אחת מחכה שתגיד לי אם היא נכונה." : `${kpi.suggest} חשבוניות מחכות שתגיד לי אם הן נכונות. לוקח דקה.`}</span>
            <div className="acts">
              <Link className="btn dark" href={`/review?m=${month}`}>בוא נעבור עליהן</Link>
            </div>
          </div>
        )}

        {groups.map((g, i) => {
          const link = billingLink(g.rows[0].e.vendor_text);
          const one = g.rows.length === 1 ? g.rows[0] : null;
          return (
            <div className="msg paper" key={g.vendor}>
              <span>
                {i === 0 ? "הכי גדול שנשאר: " : "עוד אחד: "}
                <b>{g.vendor}</b>, {g.rows.length > 1 ? `${g.rows.length} חיובים, ` : ""}
                <span className="num">{ils(g.ils)}</span>.
                {link ? ` את החשבונית מורידים מ־${link.label}.` : one?.st === "nofile" ? " מצאתי אותה, רק חסר הקובץ." : " אם יש לך אותה, צלם או העלה."}
              </span>
              <div className="acts">
                {link && (
                  <a className="btn primary" href={link.url} target="_blank" rel="noopener">
                    להורדה מ־{link.label}
                  </a>
                )}
                {one ? <Upload expenseId={one.e.id} label="העלאה" /> : <Link className="btn" href={`/expenses?m=${month}&f=todo`}>לפרטים</Link>}
              </div>
            </div>
          );
        })}

        {feesOpen.length > 0 && (
          <div className="msg paper">
            <span>חסרות חשבוניות עמלה מ{feesOpen.map((f) => f.name.split(",")[0]).join(", ")}. בלי זה רו״ח לא יכול לסגור את הסליקה.</span>
            <div className="acts">
              {feesOpen.slice(0, 2).map((f) => (
                <Upload key={f.key} feeKey={f.key} month={month} label={`העלאה, ${f.name.split(",")[0]}`} />
              ))}
              <ActionButton action={setFee.bind(null, month, feesOpen[0].key, "not_required", undefined)} label="לא היו עמלות" />
            </div>
          </div>
        )}

        {kpi.required > 0 && kpi.required === kpi.filed && feesOpen.length === 0 && (
          <div className="msg yellow">
            <span>הכל בתיק. אפשר לשלוח לרו״ח.</span>
            <div className="acts">
              <a className="btn dark" href={`/api/export?m=${month}`}>ייצוא לאקסל</a>
            </div>
          </div>
        )}

        <div className="quick">
          <Link href={`/expenses?m=${month}&f=missing`}>מה עוד חסר?</Link>
          <a href={`/api/export?m=${month}`}>ייצוא לאקסל</a>
          {folder && (
            <a href={`https://drive.google.com/drive/folders/${folder.folder_id}`} target="_blank" rel="noopener">
              התיקייה ב־Drive
            </a>
          )}
          <Link href={`/documents?m=${month}`}>כל המסמכים</Link>
        </div>
      </div>
    </Shell>
  );
}
