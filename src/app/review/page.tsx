import Shell, { pickMonth, requireMe } from "@/components/Shell";
import Hero from "@/components/Hero";
import ActionButton from "@/components/ActionButton";
import { money, day } from "@/components/fmt";
import { loadMonth, monthName } from "@/lib/data";
import { v } from "@/lib/voice";
import { approveMatch, markNotInvoice, rejectMatch } from "../actions";

export const dynamic = "force-dynamic";

const where = (src: string) => (src === "gmail" || src === "gmail_link" ? "במייל" : src === "whatsapp" ? "בוואטסאפ" : src === "drive" || src === "inbox" ? "ב־Drive" : "בהעלאה");

/** Why Buddy thinks it is the same charge, in one short line. */
function why(sameAmount: boolean, days: number | null) {
  const gap = days == null ? "" : days === 0 ? ", אותו יום" : days <= 7 ? `, ${days === 1 ? "יום אחד" : `${days} ימים`} הפרש` : days <= 10 ? ", שבוע הפרש" : "";
  return sameAmount ? `אותו סכום, אותו ספק${gap}.` : `אותו ספק${gap}. הסכום שונה, כדאי להציץ.`;
}

export default async function Review({ searchParams }: { searchParams: { m?: string } }) {
  const me = await requireMe();
  const { month, months } = await pickMonth(searchParams.m);
  const { rows, orphans, kpi } = await loadMonth(month);
  const pending = rows.filter((r) => r.st === "suggest" && r.inv);
  const mName = monthName(month).split(" ")[0];

  return (
    <Shell path="/review" month={month} months={months} reviewCount={kpi.suggest}>
      <Hero
        small
        title={pending.length ? "זה אותו חיוב?" : "אין מה לאשר."}
        hi={pending.length ? `בדקתי סכום, ספק ותאריך. ${v(me.g, "תגיד", "תגידי")} לי אם צדקתי.` : `כל ההתאמות של ${mName} מאושרות.`}
        pill={pending.length ? `${pending.length} מחכות לך` : undefined}
      />
      <div className="home">
        {pending.map((r) => {
          const inv = r.inv!;
          const same = inv.amount != null && (inv.amount === r.e.amount || inv.amount === r.e.orig_amount);
          const days = inv.doc_date ? Math.round(Math.abs(Date.parse(r.e.date) - Date.parse(inv.doc_date)) / 864e5) : null;
          return (
            <article className="staple-card" key={r.e.id}>
              <div className="charge">
                <span className="k">{r.e.source === "card" ? "בכרטיס" : "בבנק"}, {day(r.e.date)}</span>
                <span className="who">{r.e.vendor_text}</span>
                <span className="amt num">{money(r.e.amount, r.e.currency)}</span>
              </div>
              <svg className="staple" width="60" height="20" viewBox="0 0 60 20" aria-hidden="true"><path d="M6 17 V6 a2 2 0 0 1 2 -2 h44 a2 2 0 0 1 2 2 V17" fill="none" stroke="#8c93b5" strokeWidth="3.5" strokeLinecap="round" /></svg>
              <div className="doc">
                <span className="k">{where(inv.source || "")}, {day(inv.doc_date)}{inv.doc_number ? `, מס׳ ${inv.doc_number}` : ""}</span>
                <span className="who">{inv.vendor_name || inv.email_from}</span>
                <span className={`amt num${same ? " same" : ""}`}>{money(inv.amount, inv.currency)}</span>
                <span className="links">
                  {inv.drive_url && <a href={inv.drive_url} target="_blank" rel="noopener">לראות את החשבונית</a>}
                  {inv.source_url && <a href={inv.source_url} target="_blank" rel="noopener">המייל</a>}
                  {inv.download_url && !inv.drive_url && <a href={inv.download_url} target="_blank" rel="noopener">הקישור במייל</a>}
                </span>
              </div>
              <span className="why">{why(same, days)}</span>
              <div className="acts">
                <ActionButton action={approveMatch.bind(null, r.e.id, inv.id)} label="כן, לשייך" busy={`נכנס לקלסר של ${mName}…`} kind="yellow" small={false} />
                <div className="row2">
                  <ActionButton action={rejectMatch.bind(null, r.e.id, inv.id)} label="זה לא אותו חיוב" kind="text" />
                </div>
              </div>
            </article>
          );
        })}

        {orphans.length > 0 && (
          <div className="msg">
            <span>
              <b>{orphans.length === 1 ? "חשבונית אחת" : `${orphans.length} חשבוניות`} בלי חיוב.</b>
              <br />
              לרוב זה כרטיס שלא מחובר, מטבע זר, או מסמך שהוא לא חשבונית.
            </span>
            <div className="list">
              {orphans.map((i) => (
                <div className="item" key={i.id}>
                  <div>
                    <div className="title">{i.vendor_name || i.email_from}</div>
                    <div className="meta">
                      <span className="num">{day(i.doc_date)}</span>, {i.email_subject || i.file_name}
                    </div>
                  </div>
                  <div className="amt">{money(i.amount, i.currency)}</div>
                  <div className="actions">
                    {i.drive_url && <a className="btn small" href={i.drive_url} target="_blank" rel="noopener">לפתוח</a>}
                    <ActionButton action={markNotInvoice.bind(null, i.id)} label="זו לא חשבונית" />
                  </div>
                </div>
              ))}
            </div>
            <span className="close">כשהחיוב יופיע, אשייך לבד.</span>
          </div>
        )}
      </div>
    </Shell>
  );
}
