import Shell, { pickMonth, requireUser } from "@/components/Shell";
import { money, day } from "@/components/fmt";
import { db } from "@/lib/db";
import { loadMonth, monthName } from "@/lib/data";

export const dynamic = "force-dynamic";
const SRC: Record<string, string> = { gmail: "מייל", gmail_link: "קישור במייל", drive: "Drive", inbox: "תיקיית קליטה", whatsapp: "וואטסאפ", upload: "העלאה" };

export default async function Documents({ searchParams }: { searchParams: { m?: string } }) {
  await requireUser();
  const { month, months } = await pickMonth(searchParams.m);
  const { kpi } = await loadMonth(month);
  const { data } = await db()
    .from("invoices")
    .select("id, doc_date, vendor_name, amount, currency, source, drive_url, download_url, source_url, doc_number, email_subject")
    .eq("is_invoice", true)
    .eq("month", month)
    .order("doc_date", { ascending: false });
  const docs = data || [];
  return (
    <Shell path="/documents" month={month} months={months} reviewCount={kpi.suggest}>
      <div className="section-head">
        <h1>מסמכים · {monthName(month)}</h1>
        <span className="sub">
          <span className="num">{docs.length}</span> חשבוניות וקבלות שנאספו
        </span>
      </div>
      <div className="card scroll" style={{ padding: 0 }}>
        {docs.length === 0 ? (
          <div className="empty">עדיין לא נאספו מסמכים לחודש הזה. הסריקה ממשיכה ברקע.</div>
        ) : (
          <table className="t">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>ספק</th>
                <th>סכום</th>
                <th>מקור</th>
                <th>קובץ</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="num">{day(d.doc_date)}</td>
                  <td>
                    {d.vendor_name || d.email_subject}
                    {d.doc_number ? <div className="sub">מס׳ {d.doc_number}</div> : null}
                  </td>
                  <td className="num">{money(d.amount, d.currency)}</td>
                  <td>{SRC[d.source] || d.source}</td>
                  <td>
                    {d.drive_url ? (
                      <a href={d.drive_url} target="_blank" rel="noopener"><span className="pill filed">ב־Drive</span></a>
                    ) : d.download_url ? (
                      <a href={d.download_url} target="_blank" rel="noopener"><span className="pill nofile">להורדה</span></a>
                    ) : (
                      <span className="pill missing">חסר קובץ</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
