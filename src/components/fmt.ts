export const ils = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;
export const money = (a: number | null | undefined, c?: string | null) =>
  a == null ? "לא צוין" : `${c && c !== "ILS" ? c + " " : "₪"}${Number(a).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const day = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");
export const STATUS_LABEL: Record<string, string> = { filed: "בתיק", nofile: "חסר קובץ", suggest: "לאישור", missing: "חסרה", excluded: "לא צריך" };
