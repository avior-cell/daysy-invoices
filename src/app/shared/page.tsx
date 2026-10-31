import Link from "next/link";
import { requireUser } from "@/components/Shell";
import { db } from "@/lib/db";
import { money, day } from "@/components/fmt";
import { monthName } from "@/lib/data";

export const dynamic = "force-dynamic";

/** What Buddy read from the files shared into the app, and whether each one already found its charge. */
export default async function Shared({ searchParams }: { searchParams: { ids?: string; n?: string; err?: string } }) {
  await requireUser();
  const ids = (searchParams.ids || "").split(",").filter(Boolean);
  const { data: invs } = ids.length
    ? await db().from("invoices").select("id, vendor_name, amount, currency, doc_date, month, doc_type, drive_url").in("id", ids)
    : { data: [] as never[] };
  const rows = await Promise.all(
    (invs || []).map(async (i) => {
      const { data: exp } = i.amount
        ? await db()
            .from("expenses")
            .select("id, date, vendor_text, amount, currency")
            .or(`amount.eq.${i.amount},orig_amount.eq.${i.amount}`)
            .gte("date", new Date(Date.parse(i.doc_date) - 45 * 864e5).toISOString().slice(0, 10))
            .lte("date", new Date(Date.parse(i.doc_date) + 45 * 864e5).toISOString().slice(0, 10))
            .limit(1)
        : { data: [] as never[] };
      return { i, exp: exp?.[0] || null };
    }),
  );
  const failed = Number(searchParams.n || 0) - rows.length;
  return (
    <div className="home-page">
      <section className="wave-hero">
        <img className="buddy" src="/buddy.jpg" alt="באדי" />
        <h1>{rows.length ? (rows.length === 1 ? "קראתי. הנה מה שמצאתי." : `קראתי ${rows.length} מסמכים.`) : "לא הצלחתי לקרוא."}</h1>
        <div className="offer">{rows.length ? "הכל כבר בקלסר" : "אפשר לצלם שוב"}</div>
      </section>
      <div className="home">
        {rows.map(({ i, exp }) => (
          <div className="msg" key={i.id}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <div className="card" style={{ padding: 10, gap: 0 }}><span className="sub">ספק</span><b>{i.vendor_name || "לא זוהה"}</b></div>
              <div className="card" style={{ padding: 10, gap: 0, background: "var(--yellow)", borderColor: "var(--ink)" }}><span className="sub" style={{ color: "var(--ink)" }}>סכום</span><b style={{ fontSize: 20 }} className="num">{money(i.amount, i.currency)}</b></div>
              <div className="card" style={{ padding: 10, gap: 0 }}><span className="sub">תאריך</span><b className="num">{day(i.doc_date)}</b></div>
              <div className="card" style={{ padding: 10, gap: 0 }}><span className="sub">בקלסר של</span><b>{i.month ? monthName(i.month) : "לא ידוע"}</b></div>
            </div>
            <span>{exp ? `זה החיוב של ${exp.vendor_text} מ־${day(exp.date)}.` : "עוד לא ראיתי את החיוב בבנק או בכרטיס."}</span>
            <span className="close">{exp ? "הם כבר יחד בקלסר." : "כשהוא יופיע, אשייך לבד."}</span>
            <div className="acts">
              {i.drive_url && <a className="btn small" href={i.drive_url} target="_blank" rel="noopener">לראות את הקובץ</a>}
              <Link className="btn small primary" href={`/expenses?m=${i.month}`}>לחודש הזה</Link>
            </div>
          </div>
        ))}
        {failed > 0 && <div className="msg">{failed} קבצים לא נקלטו. אפשר לשלוח אותם שוב.</div>}
        <Link href="/" className="btn yellow" style={{ minHeight: 52, fontSize: 17 }}>חזרה לבאדי</Link>
      </div>
    </div>
  );
}
