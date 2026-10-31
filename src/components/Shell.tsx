import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { availableMonths, monthName } from "@/lib/data";
import MonthPicker from "./MonthPicker";
import ScanStatus from "./ScanStatus";
import CameraFab from "./CameraFab";
import { getMe, type Me } from "@/lib/voice";

const TABS = [
  { href: "/", label: "באדי" },
  { href: "/review", label: "לאישור" },
  { href: "/expenses", label: "הוצאות" },
  { href: "/shelf", label: "קלסרים" },
  { href: "/documents", label: "מסמכים" },
];

export async function requireUser() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.email) redirect("/login");
  return s.user.email;
}

/** The signed-in person and how to address them. First visit goes to the short introduction. */
export async function requireMe(): Promise<Me> {
  const me = await getMe(await requireUser());
  if (!me.isSet) redirect("/settings?first=1");
  return me;
}

export async function pickMonth(m?: string) {
  const months = await availableMonths();
  // Default: last month until the 10th (still being closed), then the current month
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 7);
  const fallback = d.getDate() <= 10 && months.includes(prev) ? prev : months[0];
  return { month: m && /^\d{4}-\d{2}$/.test(m) ? m : fallback, months };
}

export default async function Shell({ path, month, months, reviewCount, children }: { path: string; month: string; months: string[]; reviewCount?: number; blue?: boolean; children: React.ReactNode }) {
  return (
    <div className="home-page">
      <header className="top">
        <div className="top-in">
          <div className="brand-row">
            <Link href={`/?m=${month}`} className="brand" aria-label="Money Buddy, דף הבית">
              <img src="/buddy.jpg" alt="" />
              Money Buddy
            </Link>
            <div className="tools">
              <ScanStatus />
              <Link href={`/settings?m=${month}`} className="gear" aria-label="הגדרות">
                <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M11 2.5v3M11 16.5v3M2.5 11h3M16.5 11h3M5 5l2.1 2.1M14.9 14.9L17 17M5 17l2.1-2.1M14.9 7.1L17 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </Link>
              <MonthPicker month={month} months={months.map((m) => ({ value: m, label: monthName(m) }))} />
            </div>
          </div>
          <nav className="nav" aria-label="ניווט">
            {TABS.map((t) => (
              <Link key={t.href} href={`${t.href}?m=${month}`} aria-current={path === t.href ? "page" : undefined}>
                {t.label}
                {t.href === "/review" && reviewCount ? <span className="count num">{reviewCount}</span> : null}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <TabBar path={path} month={month} reviewCount={reviewCount} />
    </div>
  );
}

const ICON: Record<string, React.ReactNode> = {
  "/": <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M4 4 h14 v13 l-2.3 -2 l-2.3 2 l-2.4 -2 l-2.3 2 l-2.4 -2 l-2.3 2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8 9 h6 M8 12 h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  "/review": <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M5 11 l4 4 l8 -9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  "/expenses": <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M4 6 h14 M4 11 h14 M4 16 h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  "/shelf": <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect x="3" y="4" width="4" height="14" rx="1" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="9" y="4" width="4" height="14" rx="1" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="15" y="6" width="4" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="2" transform="rotate(-8 17 12)" /></svg>,
};

/** Phone navigation: four tabs around the yellow camera button. */
function TabBar({ path, month, reviewCount }: { path: string; month: string; reviewCount?: number }) {
  const tab = (href: string, label: string) => (
    <Link href={`${href}?m=${month}`} aria-current={path === href ? "page" : undefined}>
      {ICON[href]}
      {label}
      {href === "/review" && reviewCount ? <span className="badge num">{reviewCount}</span> : null}
    </Link>
  );
  return (
    <nav className="tabbar" aria-label="ניווט ראשי">
      {tab("/", "באדי")}
      {tab("/review", "לאישור")}
      <CameraFab />
      {tab("/expenses", "הוצאות")}
      {tab("/shelf", "קלסרים")}
    </nav>
  );
}
