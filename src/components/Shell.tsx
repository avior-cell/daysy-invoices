import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { availableMonths, monthName } from "@/lib/data";
import MonthPicker from "./MonthPicker";
import ScanStatus from "./ScanStatus";

const TABS = [
  { href: "/", label: "סגירת חודש" },
  { href: "/review", label: "לאישור" },
  { href: "/expenses", label: "הוצאות" },
  { href: "/documents", label: "מסמכים" },
];

export async function requireUser() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.email) redirect("/login");
  return s.user.email;
}

export async function pickMonth(m?: string) {
  const months = await availableMonths();
  // Default: last month until the 10th (still being closed), then the current month
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 7);
  const fallback = d.getDate() <= 10 && months.includes(prev) ? prev : months[0];
  return { month: m && /^\d{4}-\d{2}$/.test(m) ? m : fallback, months };
}

export default async function Shell({ path, month, months, reviewCount, children }: { path: string; month: string; months: string[]; reviewCount?: number; children: React.ReactNode }) {
  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand-row">
            <Link href={`/?m=${month}`} className="brand" aria-label="Money Buddy, דף הבית">
              <span className="mark">₪</span>
              Money Buddy
            </Link>
            <div className="tools">
              <ScanStatus />
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
      <main className="wrap">{children}</main>
    </>
  );
}
