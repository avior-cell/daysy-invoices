"use client";
import { usePathname, useRouter } from "next/navigation";

export default function MonthPicker({ month, months }: { month: string; months: { value: string; label: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <select className="btn" aria-label="חודש" value={month} onChange={(e) => router.push(`${path}?m=${e.target.value}`)}>
      {months.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
