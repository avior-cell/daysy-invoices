import Link from "next/link";
import Shell, { pickMonth, requireMe } from "@/components/Shell";
import Hero from "@/components/Hero";
import { ils } from "@/components/fmt";
import { loadMonth, monthName } from "@/lib/data";

export const dynamic = "force-dynamic";
const SHORT = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

/** The year as a shelf of binders: each month fills with blue as its invoices come in. */
export default async function Shelf({ searchParams }: { searchParams: { m?: string; y?: string; s?: string } }) {
  await requireMe();
  const { month, months } = await pickMonth(searchParams.m);
  const year = /^\d{4}$/.test(searchParams.y || "") ? searchParams.y! : month.slice(0, 4);
  const inYear = new Set(months.filter((m) => m.startsWith(year)));
  const all = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const stats = await Promise.all(
    all.map(async (m) => {
      if (!inYear.has(m)) return { m, req: 0, cov: 0, open: 0, suggest: 0 };
      const { kpi } = await loadMonth(m);
      return { m, req: kpi.required, cov: kpi.filed, open: kpi.missingIls, suggest: kpi.suggest };
    }),
  );
  const req = stats.reduce((a, s) => a + s.req, 0);
  const cov = stats.reduce((a, s) => a + s.cov, 0);
  const open = stats.reduce((a, s) => a + s.open, 0);
  const pct = req ? Math.round((cov / req) * 100) : 0;
  const sel = /^\d{4}-\d{2}$/.test(searchParams.s || "") ? searchParams.s! : month.startsWith(year) ? month : stats.filter((s) => s.req).pop()?.m || all[0];
  const S = stats.find((s) => s.m === sel)!;
  const sPct = S.req ? Math.round((S.cov / S.req) * 100) : 0;
  const years = [...new Set(months.map((m) => m.slice(0, 4)))];

  const spine = (s: (typeof stats)[number], i: number) => {
    const future = s.req === 0;
    const p = future ? 0 : Math.round((s.cov / s.req) * 100);
    const closed = !future && p === 100;
    const color = p >= 85 ? "#9aa3f7" : p >= 65 ? "#c4c9fa" : "var(--yellow)";
    const label = `${monthName(s.m)}, ${future ? "עוד לא התחיל" : `${p} אחוז בתיק`}`;
    const body = (
      <>
        {!future && <span className="ring" aria-hidden="true" />}
        <span className="name">{SHORT[i]}</span>
        {!future && !closed && <span className="fill" style={{ height: Math.round((p * 114) / 100), background: color }} />}
        {!future && <span className="p">{closed ? "✓" : `${p}%`}</span>}
      </>
    );
    const cls = `spine${closed ? " closed" : ""}${future ? " future" : ""}`;
    return future ? (
      <span key={s.m} className={cls} aria-label={label}>{body}</span>
    ) : (
      <Link key={s.m} className={cls} href={`/shelf?m=${month}&y=${year}&s=${s.m}`} aria-label={label} aria-current={s.m === sel ? "true" : undefined} scroll={false}>
        {body}
      </Link>
    );
  };

  return (
    <Shell path="/shelf" month={month} months={months}>
      <Hero small title={req ? `${pct}% מ־${year} בתיק.` : `הקלסרים של ${year}.`} pill={open ? `${ils(open)} עוד פתוחים` : req ? "השנה סגורה" : undefined} />
      <div className="home">
        {years.length > 1 && (
          <nav className="chips" aria-label="שנה">
            {years.map((y) => (
              <Link key={y} className="chip" aria-current={y === year ? "true" : undefined} href={`/shelf?m=${month}&y=${y}`}>{y}</Link>
            ))}
          </nav>
        )}
        <div className="shelf">
          <div className="row6">{stats.slice(0, 6).map((s, i) => spine(s, i))}</div>
          <div className="board" aria-hidden="true" />
          <div className="row6">{stats.slice(6).map((s, i) => spine(s, i + 6))}</div>
          <div className="board" aria-hidden="true" />
        </div>
        <div className="msg" style={{ textAlign: "center", justifyItems: "center" }}>
          <span style={{ fontSize: 20, fontWeight: 600 }}>הקלסר של {monthName(sel).split(" ")[0]}</span>
          {S.req ? (
            <>
              <span>{S.cov} מתוך {S.req} חיובים בתיק.{S.suggest ? ` ${S.suggest} מחכים לאישור.` : ""}</span>
              <span className="close">{S.open ? `${ils(S.open)} עוד מחכים לחשבונית.` : "הקלסר מלא."}</span>
              <div className="acts" style={{ justifyContent: "center" }}>
                <Link className="btn primary" href={`/?m=${sel}`}>לפתוח את הקלסר</Link>
                {sPct === 100 && <Link className="btn dark" href={`/close?m=${sel}`}>לשלוח לרו״ח</Link>}
              </div>
            </>
          ) : (
            <span>החודש עוד לא התחיל.</span>
          )}
        </div>
      </div>
    </Shell>
  );
}
