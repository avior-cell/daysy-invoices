import Shell, { pickMonth, requireMe } from "@/components/Shell";
import Hero from "@/components/Hero";
import { money, day } from "@/components/fmt";
import { db } from "@/lib/db";
import { loadMonth, monthName } from "@/lib/data";

export const dynamic = "force-dynamic";
const SRC: Record<string, string> = { gmail: "מהמייל", gmail_link: "מקישור במייל", drive: "מ־Drive", inbox: "מתיקיית הקליטה", whatsapp: "מוואטסאפ", upload: "מצילום" };

export default async function Documents({ searchParams }: { searchParams: { m?: string } }) {
  await requireMe();
  const { month, months } = await pickMonth(searchParams.m);
  const { kpi } = await loadMonth(month);
  const { data } = await db()
    .from("invoices")
    .select("id, doc_date, vendor_name, amount, currency, source, drive_url, download_url, source_url, doc_number, email_subject")
    .eq("is_invoice", true)
    .eq("month", month)
    .order("doc_date", { ascending: false });
  const docs = data || [];
  const { data: folder } = await db().from("drive_folders").select("folder_id").eq("month", month).maybeSingle();
  return (
    <Shell path="/documents" month={month} months={months} reviewCount={kpi.suggest}>
      <Hero small title={`המסמכים של ${monthName(month).split(" ")[0]}.`} pill={`${docs.length} חשבוניות וקבלות`} />
      <div className="home wide">
        <div className="list">
          {docs.length === 0 && <div className="empty">עוד אין מסמכים לחודש הזה. באדי ממשיך לחפש ברקע.</div>}
          {docs.map((d) => (
            <div className="item" key={d.id}>
              <div>
                <div className="title">{d.vendor_name || d.email_subject}</div>
                <div className="meta">
                  {SRC[d.source] || d.source}, <span className="num">{day(d.doc_date)}</span>
                  {d.doc_number ? `, מס׳ ${d.doc_number}` : ""}
                </div>
              </div>
              <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
                <span className="amt">{money(d.amount, d.currency)}</span>
                {d.drive_url ? (
                  <a href={d.drive_url} target="_blank" rel="noopener"><span className="pill filed">{d.drive_url.startsWith("https://app.sumit") ? "בסאמיט" : "בתיק"}</span></a>
                ) : d.download_url ? (
                  <a href={d.download_url} target="_blank" rel="noopener"><span className="pill nofile">להורדה</span></a>
                ) : (
                  <span className="pill missing">חסר קובץ</span>
                )}
              </div>
            </div>
          ))}
        </div>
        {folder && (
          <a className="btn text" href={`https://drive.google.com/drive/folders/${folder.folder_id}`} target="_blank" rel="noopener">
            לפתוח את התיקייה ב־Drive
          </a>
        )}
      </div>
    </Shell>
  );
}
