/**
 * Bank and card debits that never get a supplier invoice. Returns the reason, or null if an invoice is required.
 * Fee and transfer rules look at the bank's own description (vendor), not the free-text purpose, so a payment
 * to a real supplier whose purpose mentions "commission" or the company name still needs an invoice.
 */
export function exclusionReason(vendor: string, purpose: string, source: "bank" | "card" | "import", category = "", extra: string[] = []): string | null {
  const all = `${vendor} ${purpose}`;
  if (extra.some((w) => w && all.includes(w))) return "החרגה ידנית";
  if (/ביטוח לאומי|מס הכנסה|מע"?מ|מע”מ|רשות המסים|מנורה|פנסיה|גמל|קופת/.test(vendor) || /משכורת|שכר עבודה/.test(purpose)) return "שכר ומיסים";
  if (
    /^(עמ'|ע\.מ|עמלת|דמי טי?פול|השלמה למינ)|ריבית|רבית|הלוו?אה|הלו'|הלו׳|פירעון מידי|מטח-קניה|קנית מט.?ח|המרת מט.?ח/.test(vendor) ||
    ["TRADING", "LOAN", "RETURN"].includes(category)
  )
    return "עמלות, ריבית ומט״ח";
  if (source === "bank" && /כרטיס|ישראכרט|מסטרקארד|ויזה|לאומי קארד|כאל/i.test(vendor)) return "חיוב כרטיס מרוכז";
  if (/ויוואה|פקדון|פיקדון|סגירה|ניוד/.test(vendor)) return "העברה פנימית";
  return null;
}
