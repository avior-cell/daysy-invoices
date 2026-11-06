import Link from "next/link";
import Shell, { pickMonth, requireMe } from "@/components/Shell";
import Hero from "@/components/Hero";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Health = "ok" | "stale" | "off";
const PILL: Record<Health, [string, string]> = { ok: ["filed", "מחובר"], stale: ["nofile", "צריך בדיקה"], off: ["missing", "לא מחובר"] };

function ago(iso: string | null | undefined) {
  if (!iso) return "עוד לא";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60e3);
  if (m < 2) return "עכשיו";
  if (m < 60) return `לפני ${m} דקות`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "לפני שעה" : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? "אתמול" : `לפני ${d} ימים`;
}

async function lastOf(sources: string[]) {
  const [{ data }, { count }] = await Promise.all([
    db().from("invoices").select("created_at").in("source", sources).order("created_at", { ascending: false }).limit(1),
    db().from("invoices").select("id", { count: "exact", head: true }).in("source", sources).eq("is_invoice", true),
  ]);
  return { last: data?.[0]?.created_at as string | undefined, count: count || 0 };
}

/** Where invoices come from, whether each source is alive, and what to do when one is not. */
export default async function Connections({ searchParams }: { searchParams: { m?: string } }) {
  const me = await requireMe();
  const { month, months } = await pickMonth(searchParams.m);
  const [{ data: google }, gmailList, groupErr, gmail, drive, whatsapp, upload, { data: lastExp }, { count: expCount }] = await Promise.all([
    db().from("google_accounts").select("email, updated_at").limit(1).maybeSingle(),
    db().from("app_settings").select("updated_at").eq("key", "gmail_list").maybeSingle(),
    getSetting<{ at: string; message: string }>("auto_group_error"),
    lastOf(["gmail", "gmail_link"]),
    lastOf(["drive", "inbox"]),
    lastOf(["whatsapp"]),
    lastOf(["upload"]),
    db().from("expenses").select("date").order("date", { ascending: false }).limit(1),
    db().from("expenses").select("id", { count: "exact", head: true }),
  ]);
  const scanned = gmailList.data?.updated_at as string | undefined;
  const scanAgeMin = scanned ? (Date.now() - Date.parse(scanned)) / 60e3 : Infinity;
  const bankDate = lastExp?.[0]?.date as string | undefined;
  const bankAgeDays = bankDate ? (Date.now() - Date.parse(bankDate)) / 864e5 : Infinity;
  const sumitOn = !!(process.env.SUMIT_API_KEY && process.env.SUMIT_COMPANY_ID);
  const financyOn = !!process.env.FINANCY_API_KEY;

  const rows: { name: string; how: string; health: Health; detail: string; action?: { label: string; href: string } }[] = [
    {
      name: "המייל",
      how: google?.email || me.email,
      health: !google ? "off" : scanAgeMin > 30 ? "stale" : "ok",
      detail: `נסרק ${ago(scanned)}. ${gmail.count} חשבוניות מהמייל, האחרונה ${ago(gmail.last)}.`,
      action: !google || scanAgeMin > 30 ? { label: "להתחבר מחדש", href: "/api/auth/signin" } : undefined,
    },
    {
      name: "הבנק והכרטיסים",
      how: financyOn ? "Financy, אוטומטי" : "Financy, עדכון ידני",
      health: !expCount ? "off" : financyOn && bankAgeDays <= 7 ? "ok" : "stale",
      detail: `${expCount || 0} חיובים. החיוב האחרון מ־${bankDate ? new Date(bankDate).toLocaleDateString("he-IL") : "אף פעם"}. חשבון האירו (142) לא מעביר תנועות.`,
      action: financyOn ? undefined : { label: "מה צריך", href: "#financy" },
    },
    {
      name: "Drive",
      how: "תיקיית הקליטה ותיקיות קודמות",
      health: "ok",
      detail: `${drive.count} חשבוניות מ־Drive, האחרונה ${ago(drive.last)}.`,
    },
    {
      name: "וואטסאפ ושיתוף",
      how: "שיתוף מהטלפון, או העברה ל־avior+buddy@daysy.co.il",
      health: whatsapp.count ? "ok" : "stale",
      detail: whatsapp.count ? `${whatsapp.count} מסמכים, האחרון ${ago(whatsapp.last)}.` : "עוד לא נשלח אף מסמך.",
      action: whatsapp.count ? undefined : { label: "איך משתפים", href: "#share" },
    },
    {
      name: "צילום והעלאה",
      how: "כפתור המצלמה באפליקציה",
      health: "ok",
      detail: `${upload.count} מסמכים, האחרון ${ago(upload.last)}.`,
    },
    {
      name: "סאמיט",
      how: sumitOn ? "API, סנכרון אוטומטי" : "עוד לא מחובר",
      health: sumitOn ? "ok" : "off",
      detail: sumitOn ? "המפתח קיים. הסנכרון יופעל בגרסה הבאה." : "מסמכים מסאמיט נכנסים כרגע רק מקובצי zip.",
      action: sumitOn ? undefined : { label: "איך מחברים", href: "#sumit" },
    },
  ];
  const bad = rows.filter((r) => r.health !== "ok").length;

  return (
    <Shell path="/connections" month={month} months={months}>
      <Hero small title="מאיפה מגיעות החשבוניות." hi={bad ? `${bad} מקורות צריכים תשומת לב.` : "הכל זורם."} pill={`${rows.length - bad} מתוך ${rows.length} פעילים`} />
      <div className="home">
        {rows.map((r) => (
          <div className="msg" key={r.name}>
            <div className="kv">
              <b>{r.name}</b>
              <span className={`pill ${PILL[r.health][0]}`}>{PILL[r.health][1]}</span>
            </div>
            <span className="sub" style={{ fontSize: 14 }}>{r.how}</span>
            <span>{r.detail}</span>
            {r.action && (
              <div className="acts">
                <a className="btn small" href={r.action.href}>{r.action.label}</a>
              </div>
            )}
          </div>
        ))}

        {groupErr && (
          <div className="msg yellow">
            <span>השיוך האוטומטי של תשלומים נתקע {ago(groupErr.at)}.</span>
            <span className="close">ננסה שוב בעוד 20 דקות.</span>
          </div>
        )}

        <div className="msg" id="financy">
          <b>הבנק והכרטיסים</b>
          <span>
            כרגע התנועות מ־Financy נטענות ידנית. כדי שייכנסו לבד, צריך מפתח API של Financy במשתנה FINANCY_API_KEY ב־Vercel.
            <br />
            חשבון האירו 142 מופיע ב־Financy בלי תנועות. אפשר לשלוח דף חשבון מהבנק, והוא ייטען.
          </span>
        </div>
        <div className="msg" id="share">
          <b>שיתוף מהטלפון</b>
          <span>
            באנדרואיד: לחיצה ארוכה על הקובץ, שיתוף, Money Buddy.
            <br />
            באייפון: העברה של הקובץ במייל ל־avior+buddy@daysy.co.il.
          </span>
          <span className="close">שיתוף אחד, וזה בקלסר.</span>
        </div>
        <div className="msg" id="sumit">
          <b>חיבור סאמיט</b>
          <span>
            בסאמיט: הגדרות, מפתחות API. מעתיקים CompanyID ומפתח פרטי.
            <br />
            ב־Vercel: הפרויקט daysy-invoices, Settings, Environment Variables. מוסיפים SUMIT_COMPANY_ID ו־SUMIT_API_KEY.
          </span>
          <span className="close">שתי שורות, ושלומי מפסיק להעלות zip.</span>
        </div>
        <Link className="btn text" href={`/settings?m=${month}`}>חזרה להגדרות</Link>
      </div>
    </Shell>
  );
}
