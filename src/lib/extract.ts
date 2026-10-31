import Anthropic from "@anthropic-ai/sdk";
// Import the library file directly: the package entry reads a test PDF from disk when bundled
// @ts-expect-error no types for the deep path
import pdf from "pdf-parse/lib/pdf-parse.js";

export type Extracted = {
  is_invoice: boolean;
  doc_type: "tax_invoice" | "receipt" | "invoice_receipt" | "credit_note" | "other";
  vendor_name: string | null;
  vendor_tax_id: string | null;
  amount: number | null;
  currency: "ILS" | "USD" | "EUR" | "GBP";
  doc_date: string | null;
  doc_number: string | null;
  confidence: number;
};

const RULES = `You read documents received by Vivea Collective Ltd (brand Daysy, Israel; owner Avior Hakmon).
Decide whether the document is a tax invoice, receipt, invoice-receipt or credit note (חשבונית מס, קבלה, חשבונית מס קבלה, חשבונית זיכוי, invoice, receipt) for something the company or Avior bought or paid for.
Any invoice or receipt issued TO Vivea Collective, Daysy, Avior Hakmon or Erez is a business expense and counts, including ad platform receipts (Meta, Google), customs and import brokers, freelancers and suppliers.
Text extracted from Hebrew PDFs is often reversed (characters right to left in reverse order): read it anyway.
It is NOT an invoice if it is marketing, a newsletter, a quote, a payment request the company sent to others, a bank or card statement, a shipping notice, a failed payment, or unrelated personal mail.
Return ONLY a JSON object:
{"is_invoice": boolean, "doc_type": "tax_invoice"|"receipt"|"invoice_receipt"|"credit_note"|"other", "vendor_name": short issuer name or null, "vendor_tax_id": issuer ח.פ/ע.מ/VAT id or null, "amount": final total paid including VAT as a number or null, "currency": "ILS"|"USD"|"EUR"|"GBP", "doc_date": "YYYY-MM-DD" or null, "doc_number": string or null, "confidence": 0..1}`;

let anthropic: Anthropic | null = null;
const ai = () => (anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 }));
const MODEL = () => process.env.EXTRACT_MODEL || "claude-haiku-5-5";

export async function pdfToText(bytes: Buffer): Promise<string> {
  try {
    const out = await pdf(bytes, { max: 3 });
    return out.text.replace(/\s+/g, " ").trim().slice(0, 6000);
  } catch {
    return "";
  }
}

function parseJson(text: string): Extracted | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const x = JSON.parse(m[0]);
    const amount = x.amount == null || isNaN(+x.amount) ? null : Math.round(+x.amount * 100) / 100;
    return {
      is_invoice: !!x.is_invoice,
      doc_type: x.doc_type || "other",
      vendor_name: x.vendor_name || null,
      vendor_tax_id: x.vendor_tax_id || null,
      amount,
      currency: ["ILS", "USD", "EUR", "GBP"].includes(x.currency) ? x.currency : "ILS",
      doc_date: /^\d{4}-\d{2}-\d{2}$/.test(x.doc_date || "") ? x.doc_date : null,
      doc_number: x.doc_number ? String(x.doc_number) : null,
      confidence: typeof x.confidence === "number" ? x.confidence : 0.5,
    };
  } catch {
    return null;
  }
}

type Context = { from?: string; subject?: string; date?: string; fileName?: string; body?: string };

/**
 * Read one document. Text PDFs go as text; scanned PDFs and images go to Claude as the file itself,
 * so nothing is lost when a PDF has no text layer.
 */
export async function extract(ctx: Context, file?: { bytes: Buffer; mime: string }): Promise<Extracted | null> {
  const header = `EMAIL from: ${ctx.from || ""}\nsubject: ${ctx.subject || ""}\ndate: ${ctx.date || ""}\nfile: ${ctx.fileName || ""}\n`;
  const content: Anthropic.MessageParam["content"] = [];
  if (file && file.mime === "application/pdf") {
    const text = await pdfToText(file.bytes);
    // Hebrew PDFs often come out of the text layer reversed: let the model read the page itself
    if (text.replace(/\s/g, "").length >= 60 && !/[\u0590-\u05FF]/.test(text)) {
      content.push({ type: "text", text: `${header}\nDOCUMENT TEXT:\n${text}\n\nEMAIL BODY:\n${(ctx.body || "").slice(0, 800)}` });
    } else {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.bytes.toString("base64") } });
      content.push({ type: "text", text: header });
    }
  } else if (file && /^image\/(png|jpeg|gif|webp)$/.test(file.mime)) {
    content.push({ type: "image", source: { type: "base64", media_type: file.mime as "image/png", data: file.bytes.toString("base64") } });
    content.push({ type: "text", text: header });
  } else {
    content.push({ type: "text", text: `${header}\nEMAIL BODY:\n${(ctx.body || "").slice(0, 3000)}` });
  }
  const res = await ai().messages.create({ model: MODEL(), max_tokens: 400, system: RULES, messages: [{ role: "user", content }] });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return parseJson(text);
}

/** Cheap pre-filter so obvious non-invoices never cost a model call. */
export function looksLikeInvoice(subject: string, from: string, body: string, hasPdf: boolean): boolean {
  const s = `${subject} ${from} ${body.slice(0, 1500)}`;
  if (/(newsletter|webinar|unsubscribe from this list|הזמנה לאירוע)/i.test(subject)) return hasPdf;
  return hasPdf || /(חשבונית|קבלה|חשבון עסקה|אישור תשלום|invoice|receipt|billing|payment (confirmation|received)|order confirmation|tax)/i.test(s);
}
