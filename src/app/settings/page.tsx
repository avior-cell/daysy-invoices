import Link from "next/link";
import Shell, { pickMonth, requireUser } from "@/components/Shell";
import Hero from "@/components/Hero";
import { getMe, v } from "@/lib/voice";
import { db } from "@/lib/db";
import { saveProfile } from "../actions";

export const dynamic = "force-dynamic";

/** First visit: a short introduction. Later: name, form of address, and what is connected. */
export default async function Settings({ searchParams }: { searchParams: { m?: string; first?: string } }) {
  const me = await getMe(await requireUser());
  const { month, months } = await pickMonth(searchParams.m);
  const first = !!searchParams.first || !me.isSet;
  const [{ data: google }, { count: banks }, { count: shared }] = await Promise.all([
    db().from("google_accounts").select("email").eq("email", me.email.toLowerCase()).maybeSingle(),
    db().from("expenses").select("id", { count: "exact", head: true }),
    db().from("invoices").select("id", { count: "exact", head: true }).eq("source", "whatsapp"),
  ]);
  const ok = <span className="pill filed">מחובר</span>;
  return (
    <Shell path="/settings" month={month} months={months}>
      <Hero buddy={first} small title={first ? "נעים להכיר." : "ההגדרות שלך."} hi={first ? "כמה פרטים, ובאדי מתחיל לעבוד." : me.email} />
      <div className="home">
        <form action={saveProfile} className="msg" style={{ gap: 12 }}>
          <input type="hidden" name="next" value={first ? "/" : `/settings?m=${month}`} />
          <label className="field">
            איך קוראים לך?
            <input name="name" defaultValue={me.name} autoComplete="given-name" required />
          </label>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 6 }}>
            <legend className="field" style={{ marginBottom: 6 }}>איך לפנות אליך?</legend>
            <div className="seg">
              <label><input type="radio" name="g" value="m" defaultChecked={me.g === "m"} />בלשון זכר</label>
              <label><input type="radio" name="g" value="f" defaultChecked={me.g === "f"} />בלשון נקבה</label>
            </div>
          </fieldset>
          <span style={{ fontSize: 15 }}>למשל: <b>&quot;צלם את הקבלה, ואני אסדר.&quot;</b> או <b>&quot;צלמי את הקבלה, ואני אסדר.&quot;</b></span>
          <button className="btn yellow big" type="submit">{first ? v(me.g, "בוא נתחיל", "בואי נתחיל") : "לשמור"}</button>
        </form>

        <div className="msg">
          <b>מה מחובר</b>
          <div className="kv"><span><b>שלב 1 |</b> המייל, {me.email}</span>{google ? ok : <span className="pill missing">לא מחובר</span>}</div>
          <div className="kv"><span><b>שלב 2 |</b> הבנק והכרטיס, דרך Financy</span>{banks ? ok : <span className="pill nofile">ממתין</span>}</div>
          <div className="kv"><span><b>שלב 3 |</b> שיתוף מוואטסאפ, דרך avior+buddy@daysy.co.il</span>{shared ? <span className="pill filed">פעיל</span> : <span className="pill nofile">עוד לא נוסה</span>}</div>
          <span className="close">{first ? "שלוש דקות, והקלסר שלך מתחיל להתמלא." : "הכל עובד ברקע, כל דקה."}</span>
        </div>

        {!first && (
          <div className="msg">
            <b>להתקין בטלפון</b>
            <span>באייפון: שיתוף, ואז &quot;הוספה למסך הבית&quot;.<br />באנדרואיד: התפריט, ואז &quot;התקנת אפליקציה&quot;.</span>
            <span className="close">אייקון אחד, ובאדי תמיד קרוב.</span>
          </div>
        )}
        {!first && <Link className="btn text" href="/api/auth/signout">יציאה</Link>}
      </div>
    </Shell>
  );
}
