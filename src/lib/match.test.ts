import { test } from "node:test";
import assert from "node:assert/strict";
import { matchAll, vendorSimilarity } from "./match.ts";
import { exclusionReason } from "./classify.ts";
import { invoiceLinks } from "./links.ts";

test("exact amount and vendor alias auto-match, closest first", () => {
  const exp = [
    { id: "e1", date: "2026-10-14", vendor_text: "FACEBK *VBAQA92MJ4", amount: 3456, currency: "ILS" },
    { id: "e2", date: "2026-10-20", vendor_text: "HEYY.IO", amount: 473.92, currency: "ILS", orig_amount: 149, orig_currency: "USD" },
    { id: "e3", date: "2026-10-18", vendor_text: "GOOGLE*ADS7819538674", amount: 2500, currency: "ILS" },
  ];
  const inv = [
    { id: "i1", doc_date: "2026-10-14", vendor_name: "Meta Platforms", amount: 3456, currency: "ILS" },
    { id: "i2", doc_date: "2026-10-20", vendor_name: "Heyy", amount: 149, currency: "USD" },
    { id: "i3", doc_date: "2026-10-18", vendor_name: "Google Ireland", amount: 2400, currency: "ILS" },
  ];
  const m = matchAll(exp, inv);
  assert.deepEqual(
    m.map((x) => [x.expense_id, x.invoice_id, x.kind]),
    [
      ["e1", "i1", "auto"],
      ["e2", "i2", "auto"],
      ["e3", "i3", "suggest"],
    ],
  );
});

test("rejected pair is not matched again", () => {
  const exp = [{ id: "e1", date: "2026-10-14", vendor_text: "Meta", amount: 10, currency: "ILS" }];
  const inv = [{ id: "i1", doc_date: "2026-10-14", vendor_name: "Meta", amount: 10, currency: "ILS" }];
  assert.equal(matchAll(exp, inv, { rejected: new Set(["e1:i1"]) }).length, 0);
});

test("import payments match the maker's invoices", () => {
  const e = { id: "e", date: "2026-08-24", vendor_text: "תש. יבוא פתוח", purpose: "inv254479 pay", amount: 2083.33, currency: "EUR" };
  assert.equal(vendorSimilarity(e, { id: "i", doc_date: "2026-06-15", vendor_name: "M.I.S.S. GmbH", amount: 6250, currency: "EUR" }), 1);
});

test("exclusions cover loans, interest spelling and salary", () => {
  assert.equal(exclusionReason("הו”ק הלואה קרן", "", "bank"), "עמלות, ריבית ומט״ח");
  assert.equal(exclusionReason("הו”ק הלו' רבית", "", "bank"), "עמלות, ריבית ומט״ח");
  assert.equal(exclusionReason("ביטוח לאומי", "", "bank"), "שכר ומיסים");
  assert.equal(exclusionReason("תפוז שליחויות בע”מ", "", "card"), null);
  // "פרעון <ספק>" is a card payment to a real supplier
  assert.equal(exclusionReason("פרעון עא אייר דיגיטל", "", "card"), null);
  assert.equal(exclusionReason("פועלים פירעון מידי", "", "card"), "עמלות, ריבית ומט״ח");
  assert.equal(exclusionReason("הפקדה לפקדון", "", "bank"), "העברה פנימית");
  assert.equal(exclusionReason("הע' סגירה/ניוד", "", "bank"), "העברה פנימית");
  assert.equal(exclusionReason("עמ'הקצאת אשראי", "", "bank"), "עמלות, ריבית ומט״ח");
  // A real supplier stays required even when its purpose mentions commission or the company name
  assert.equal(exclusionReason("אלוהה א.מ גרופ בע”מ", "עמלת מכירה רבעונית 1", "bank"), null);
  assert.equal(exclusionReason("ע.א אייר דיגיטל בע”מ", "ריטיינר מרץ ויוואה", "bank"), null);
});

test("invoice links are unwrapped from tracking redirects", () => {
  const body =
    "להורדת המסמך https://32skv1gy.r.il-central-1.awstrack.me/L0/https:%2F%2Farboxinvoice.co.il%2Fapi%2FopenInvoice%2F%3Fq=ABC/1/0122/x=145 unsubscribe https://x.com/unsubscribe";
  assert.deepEqual(invoiceLinks(body), ["https://arboxinvoice.co.il/api/openInvoice/?q=ABC"]);
});
