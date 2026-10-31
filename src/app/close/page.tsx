import Link from "next/link";
import Shell, { pickMonth, requireMe } from "@/components/Shell";
import Hero from "@/components/Hero";
import { ils } from "@/components/fmt";
import { db } from "@/lib/db";
import { loadMonth, monthName } from "@/lib/data";
import { v } from "@/lib/voice";

export const dynamic = "force-dynamic";

const Check = ({ ok }: { ok: boolean }) =>
  ok ? (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="#2e3fe0" /><path d="M5 9 l2.6 2.6 l5 -5.4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7.5" fill="none" stroke="#a3123a" strokeWidth="2" /></svg>
  );

/** Closing a month for the accountant: what is ready, a draft email the user sends, and the Excel file. */
export default async function Close({ searchParams }: { searchParams: { m?: string } }) {
  const me = await requireMe();
  const { month, months } = await pickMonth(searchParams.m);
  const { kpi, feeRows } = await loadMonth(month);
  const { data: folder } = await db().from("drive_folders").select("folder_id").eq("month", month).maybeSingle();
  const name = monthName(month).split(" ")[0];
  const open = kpi.required - kpi.filed;
  const feesOk = feeRows.every((f) => f.st === "filed" || f.st === "excluded");
  const ready = open === 0 && feesOk;
  const folderUrl = folder ? `https://drive.google.com/drive/folders/${folder.folder_id}` : "";
  const subject = `חשבוניות ${monthName(month)}, Vivea Collective`;
  const body = [`שלום,`, ``, `החשבוניות של ${monthName(month)} מחכות בתיקייה:`, folderUrl, ``, `${kpi.filed} חיובים, לכל אחד יש חשבונית.`, `קובץ האקסל מצורף.`, ``, `תודה,`, me.name].join("\n");
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const fees = feeRows.map((f) => f.name.split(",")[0]).join(", ");

  return (
    <Shell path="/close" month={month} months={months} reviewCount={kpi.suggest}>
      <Hero buddy small title={ready ? `${name} מוכן לרו״ח.` : `${name} עוד לא מוכן.`} pill={`${kpi.filed} מתוך ${kpi.required} בתיק`} />
      <div className="home">
        <div className="msg">
          <div className="checks">
            <div className={open ? "no" : undefined}><Check ok={!open} /><span>{open ? `${open} חיובים עוד בלי חשבונית, ${ils(kpi.missingIls)}` : "לכל חיוב יש חשבונית"}</span></div>
            <div className={feesOk ? undefined : "no"}><Check ok={feesOk} /><span>עמלות הסליקה של {fees}</span></div>
            <div><Check ok /><span>קובץ אקסל מסודר לפי תאריך</span></div>
            <div className={folder ? undefined : "no"}><Check ok={!!folder} /><span>{folder ? `כל הקבצים בתיקיית ${name} ב־Drive` : "תיקיית החודש עוד לא נוצרה ב־Drive"}</span></div>
          </div>
          <span className="close">{ready ? "לחיצה אחת, והחודש סגור." : "עוד קצת, ואפשר לשלוח."}</span>
        </div>
        {ready ? (
          <>
            <a className="btn yellow big" href={mailto}>לשלוח לרו״ח</a>
            <span className="sub" style={{ textAlign: "center", fontSize: 14 }}>אכין טיוטת מייל עם הקישור לתיקייה. {v(me.g, "אתה מוסיף את רו״ח ושולח.", "את מוסיפה את רו״ח ושולחת.")}</span>
          </>
        ) : (
          <Link className="btn yellow big" href={`/expenses?m=${month}&f=todo`}>לראות מה חסר</Link>
        )}
        <a className="btn big" style={{ borderRadius: 999 }} href={`/api/export?m=${month}`}>להוריד את הקלסר לאקסל</a>
        {folder && <a className="btn text" href={folderUrl} target="_blank" rel="noopener">לפתוח את התיקייה ב־Drive</a>}
      </div>
    </Shell>
  );
}
