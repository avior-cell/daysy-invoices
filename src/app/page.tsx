import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db, getSyncState } from "@/lib/db";
import ScanButton from "./ScanButton";

export const dynamic = "force-dynamic";

const fmt = (a: number | null, c: string | null) =>
  a == null ? "—" : `${c && c !== "ILS" ? c + " " : "₪"}${Number(a).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const state = await getSyncState(`gmail:${process.env.INVOICE_MAILBOX}`);
  const s = state?.stats || {};
  const { data: recent } = await db()
    .from("invoices")
    .select("id, doc_date, vendor_name, amount, currency, source, drive_url, download_url, email_subject")
    .eq("is_invoice", true)
    .order("doc_date", { ascending: false })
    .limit(100);

  return (
    <main className="wrap">
      <header>
        <h1>מעקב חשבוניות Daysy</h1>
        <div className="sub">ויוואה קולקטיב בע״מ · {session.user?.email}</div>
      </header>

      <section className="kpis" aria-label="סטטוס סריקה">
        <div className="kpi"><span className="sub">מיילים שנבדקו</span><span className="v num">{s.seen || 0}</span></div>
        <div className="kpi"><span className="sub">חשבוניות ב־Drive</span><span className="v num">{s.invoice || 0}</span></div>
        <div className="kpi"><span className="sub">להורדה ידנית</span><span className="v num">{s.link || 0}</span></div>
        <div className="kpi"><span className="sub">סטטוס</span><span className="v">{state?.full_scan_done ? "הושלם" : "בתהליך"}</span></div>
      </section>

      <section className="card">
        <h2>סריקת כל תיבת המייל</h2>
        <p className="sub">כל המיילים בכל התגיות והארכיון, מהישן ביותר ועד היום. קבצים מצורפים, PDF סרוקים וקישורי הורדה.</p>
        <ScanButton done={!!state?.full_scan_done} />
      </section>

      <section className="card">
        <h2>חשבוניות אחרונות</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>תאריך</th><th>ספק</th><th>סכום</th><th>מקור</th><th>קובץ</th></tr></thead>
            <tbody>
              {(recent || []).map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.doc_date}</td>
                  <td>{r.vendor_name || r.email_subject}</td>
                  <td className="num">{fmt(r.amount, r.currency)}</td>
                  <td>{r.source === "gmail_link" ? "קישור" : "מצורף"}</td>
                  <td>
                    {r.drive_url ? (
                      <a href={r.drive_url} target="_blank" rel="noopener"><span className="pill ok">ב־Drive</span></a>
                    ) : r.download_url ? (
                      <a href={r.download_url} target="_blank" rel="noopener"><span className="pill warn">להורדה</span></a>
                    ) : (
                      <span className="pill warn">חסר קובץ</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recent?.length && <p className="sub">עדיין אין חשבוניות. הפעילו סריקה מלאה.</p>}
        </div>
      </section>
    </main>
  );
}
