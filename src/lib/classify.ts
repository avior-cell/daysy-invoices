/** Bank and card debits that never get a supplier invoice. Returns the reason, or null if an invoice is required. */
export function exclusionReason(text: string, source: "bank" | "card" | "import", category = "", extra: string[] = []): string | null {
  if (extra.some((w) => w && text.includes(w))) return "החרגה ידנית";
  if (/ביטוח לאומי|מס הכנסה|מע"?מ|מע”מ|מעמ|רשות המסים|מנורה|פנסיה|גמל|משכורת|שכר עבודה|קופת/.test(text)) return "שכר ומיסים";
  if (
    /עמל|ריבית|רבית|דמי ניהול|דמי טי?פול|הלוו?אה|הלו'|הלו׳|פרעון|פירעון|מט.?ח|מטח/.test(text) ||
    ["TRADING", "LOAN", "RETURN"].includes(category)
  )
    return "עמלות, ריבית ומט״ח";
  if (source === "bank" && /כרטיס|ישראכרט|מסטרקארד|ויזה|לאומי קארד|כאל/i.test(text)) return "חיוב כרטיס מרוכז";
  if (/ויוואה/.test(text)) return "העברה פנימית";
  return null;
}
