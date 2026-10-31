import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadMonth } from "@/lib/data";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { filed: "יש חשבונית", nofile: "נמצאה, חסר קובץ", suggest: "הצעה לאישור", missing: "חסרה חשבונית", excluded: "לא נדרש" };
const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Month export as CSV with a BOM so Excel opens the Hebrew correctly. Missing items first. */
export async function GET(req: Request) {
  const s = await getServerSession(authOptions);
  if (!s?.user?.email) return new Response("Unauthorized", { status: 401 });
  const m = new URL(req.url).searchParams.get("m") || "";
  if (!/^\d{4}-\d{2}$/.test(m)) return new Response("Bad month", { status: 400 });
  const { rows, feeRows } = await loadMonth(m);
  const order = { missing: 0, suggest: 1, nofile: 2, filed: 3, excluded: 4 } as const;
  const sorted = [...rows].sort((a, b) => order[a.st] - order[b.st] || b.e.amount - a.e.amount);
  const head = ["סטטוס", "תאריך", "מקור", "ספק בחיוב", "פירוט", "סכום", "מטבע", "סכום מקורי", "מטבע מקורי", "ספק בחשבונית", "סכום בחשבונית", "מספר מסמך", "בסאמיט", "קישור", "סיבת החרגה", "הערה"];
  const lines = sorted.map((r) =>
    [
      LABEL[r.st],
      r.e.date,
      r.e.source === "card" ? "אשראי" : "בנק",
      r.e.vendor_text,
      r.e.purpose,
      r.e.amount,
      r.e.currency,
      r.e.orig_amount,
      r.e.orig_currency,
      r.inv?.vendor_name,
      r.inv?.amount,
      r.inv?.doc_number,
      r.inv?.inSumit ? "כן" : "",
      r.inv?.drive_url || r.inv?.download_url,
      r.st === "excluded" ? r.why : "",
      r.e.note,
    ]
      .map(cell)
      .join(","),
  );
  const fees = feeRows.map((f) => [f.st === "filed" ? "יש חשבונית" : f.st === "excluded" ? "לא נדרש" : "חסרה חשבונית", "", "עמלות סליקה", f.name, "", f.inv?.amount, "ILS", "", "", f.inv?.vendor_name, f.inv?.amount, f.inv?.doc_number, f.inv?.inSumit ? "כן" : "", f.inv?.drive_url, "", ""].map(cell).join(","));
  const csv = "﻿" + [head.join(","), ...lines, ...fees].join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="money-buddy-${m}.csv"` },
  });
}
