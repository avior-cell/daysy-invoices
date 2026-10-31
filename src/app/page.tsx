import Link from "next/link";
import Shell, { pickMonth, requireMe } from "@/components/Shell";
import Binder from "@/components/Binder";
import { v } from "@/lib/voice";
import Upload from "@/components/Upload";
import ActionButton from "@/components/ActionButton";
import { ils, money } from "@/components/fmt";
import { addMonth, billingLink, loadMonth, monthName, openByVendor } from "@/lib/data";
import { setFee } from "./actions";
import { db } from "@/lib/db";
import { expectedPayments } from "@/lib/groups";

export const dynamic = "force-dynamic";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date()));
  return h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב";
}

/** The receipt under the wave: a barcode of the month's charges and the binder filling up. */
function Receipt({ month, kpi }: { month: string; kpi: { required: number; filed: number } }) {
  const pct = kpi.required ? Math.round((kpi.filed / kpi.required) * 100) : 0;
  const open = kpi.required - kpi.filed;
  const n = Math.min(kpi.required, 60) || 1;
  const done = Math.round((kpi.filed / (kpi.required || 1)) * n);
  const heights = [26, 34, 22, 30, 34, 18, 28, 34, 24, 32];
  let zig = "M0 0 ";
  for (let x = 0; x <= 600; x += 12) zig += `L${x + 6} 9 L${x + 12} 0 `;
  return (
    <section className="receipt" aria-label={`הקלסר של ${monthName(month)}`}>
      <div className="paper">
        <div className="row">
          <span>הקלסר של {monthName(month).split(" ")[0]}</span>
        </div>
        <div className="barcode" aria-hidden="true">
          {Array.from({ length: n }, (_, i) => (
            <i key={i} className={i < done ? "on" : undefined} style={{ height: heights[i % heights.length] }} />
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <span>{kpi.filed} בתיק</span>
          <span>{open} חסרים</span>
        </div>
        <Binder className="binder" pct={pct} w={60} h={84} />
      </div>
      <svg className="zig" viewBox="0 0 600 10" preserveAspectRatio="none" aria-hidden="true">
        <path d={zig + "L600 0 Z"} fill="#fff" />
      </svg>
    </section>
  );
}

/** One headline for the month, in Daysy's voice: short, confident, the state in a few words. */
function headline(pct: number, open: number) {
  if (!open) return "החודש סגור.";
  if (pct >= 85) return "כמעט הכל בתיק.";
  if (pct >= 50) return "יותר מחצי כבר בתיק.";
  return "יש לנו עבודה החודש.";
}

export default async function Home({ searchParams }: { searchParams: { m?: string } }) {
  const me = await requireMe();
  const { month, months } = await pickMonth(searchParams.m);
  const [{ rows, feeRows, kpi }, expected] = await Promise.all([loadMonth(month), expectedPayments().catch(() => [])]);
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
  const name = me.name;
  const freshCount = freshTotal || 0;

  const open = kpi.required - kpi.filed;
  const pct = kpi.required ? Math.round((kpi.filed / kpi.required) * 100) : 0;
  return (
    <Shell path="/" month={month} months={months} reviewCount={kpi.suggest}>
      <section className="wave-hero">
        <img className="buddy" src="/buddy.jpg" alt="באדי, חשבונית מחייכת עם חותמת" />
        <div className="hi">
          {greeting()}, {name}. {daysLeft > 0 ? `עוד ${daysLeft} ימים להגשה.` : "מועד ההגשה עבר."}
        </div>
        <h1>{headline(pct, open)}</h1>
        {open > 0 ? <div className="offer num">{ils(kpi.missingIls)} עוד בלי חשבונית</div> : <div className="offer">אפשר לשלוח לרו״ח</div>}
      </section>

      <div className="home">
        <Receipt month={month} kpi={kpi} />

        {freshCount > 0 && (
          <div className="msg">
            <span>{freshCount === 1 ? "נכנסה חשבונית חדשה, ושייכתי אותה." : `נכנסו ${freshCount} חשבוניות חדשות, ושייכתי אותן.`}</span>
            <div className="mini">
              {fresh!.map((f) => (
                <div key={f.id}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#2e3fe0" /><path d="M4.5 8 l2.2 2.2 l4.3 -4.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>{f.vendor_name || "מסמך"}</span>
                  <b className="num">{money(f.amount, f.currency)}</b>
                </div>
              ))}
            </div>
            <span className="close">אין צורך לעשות כלום.</span>
          </div>
        )}

        {kpi.suggest > 0 && (
          <div className="msg yellow">
            <span>{kpi.suggest === 1 ? "התאמה אחת מחכה לך." : `${kpi.suggest} התאמות מחכות לך.`}</span>
            <div className="acts" style={{ justifyContent: "space-between" }}>
              <span className="close">דקה אחת, וזה בתיק.</span>
              <Link className="btn dark" href={`/review?m=${month}`}>לאשר</Link>
            </div>
          </div>
        )}

        {groups.map((g) => {
          const link = billingLink(g.rows[0].e.vendor_text);
          const one = g.rows.length === 1 ? g.rows[0] : null;
          const many = g.rows.length > 1;
          return (
            <div className="msg" key={g.vendor}>
              <span>
                <b>{g.vendor}</b>
                {many ? `, ${g.rows.length} חיובים` : ""}, <span className="num">{ils(g.ils)}</span>.
                <br />
                {link ? (many ? "דוח חודשי אחד מכסה את כולם." : `החשבונית מחכה ב־${link.label}.`) : one?.st === "nofile" ? "מצאתי אותה, חסר רק הקובץ." : v(me.g, "אם החשבונית אצלך, צלם אותה.", "אם החשבונית אצלך, צלמי אותה.")}
              </span>
              <div className="acts" style={{ justifyContent: "space-between" }}>
                <span className="close">{link ? (many ? "הורדה אחת, וכולם בתיק." : "הורדה אחת, וזה בתיק.") : "צילום אחד, וזה בתיק."}</span>
                {link ? (
                  <a className="btn primary" href={link.url} target="_blank" rel="noopener">להורדה</a>
                ) : one ? (
                  <Upload expenseId={one.e.id} label="לצלם" primary />
                ) : (
                  <Link className="btn primary" href={`/expenses?m=${month}&f=todo`}>לפרטים</Link>
                )}
              </div>
            </div>
          );
        })}

        {expected.length > 0 && (
          <div className="msg">
            <span>תשלומים שעוד צפויים לצאת, על חשבוניות שכבר בתיק:</span>
            <div className="mini">
              {expected.map((x) => (
                <div key={(x.doc || "") + x.total}>
                  <span>{x.vendor}{x.doc ? `, ${x.doc}` : ""}{x.paid ? `, שולמו ${x.paid}` : ""}</span>
                  <b className="num">{money(x.left, x.currency)}</b>
                </div>
              ))}
            </div>
            <span className="close">כשהתשלום יוצא, אשייך אותו לבד.</span>
          </div>
        )}

        {feesOpen.length > 0 && (
          <div className="msg">
            <span>חסרות חשבוניות העמלה של {feesOpen.map((f) => f.name.split(",")[0]).join(" ושל ")}.<br />רו״ח צריך אותן כדי לסגור את הסליקה.</span>
            <div className="acts">
              {feesOpen.slice(0, 2).map((f) => (
                <Upload key={f.key} feeKey={f.key} month={month} label={`להעלות, ${f.name.split(",")[0]}`} />
              ))}
              <ActionButton action={setFee.bind(null, month, feesOpen[0].key, "not_required", undefined)} label="לא היו עמלות" />
            </div>
          </div>
        )}

        {kpi.required > 0 && !open && feesOpen.length === 0 && (
          <div className="msg yellow">
            <span>כל החשבוניות של {monthName(month).split(" ")[0]} בתיק.<br />נשאר רק לשלוח לרו״ח.</span>
            <div className="acts" style={{ justifyContent: "space-between" }}>
              <span className="close">לחיצה אחת, והחודש סגור.</span>
              <Link className="btn dark" href={`/close?m=${month}`}>לסגור את החודש</Link>
            </div>
          </div>
        )}

        <div className="quick">
          <Link href={`/expenses?m=${month}&f=missing`}>מה עוד חסר</Link>
          <a href={`/api/export?m=${month}`}>ייצוא לאקסל</a>
          {folder && (
            <a href={`https://drive.google.com/drive/folders/${folder.folder_id}`} target="_blank" rel="noopener">
              התיקייה ב־Drive
            </a>
          )}
          <Link href={`/close?m=${month}`}>סגירת החודש</Link>
          <Link href={`/documents?m=${month}`}>כל המסמכים</Link>
        </div>
      </div>
    </Shell>
  );
}
