/** Find invoice download links in an email body and fetch the PDF behind them. */

const INVOICE_HOSTS =
  /(greeninvoice|morning\.co|ezcount|icount|invoice4u|arboxinvoice|cardcom|rivhit|hyp\.co\.il|tranzila|yaad|meshulam|grow\.link|sumit|payplus|ipaper|easycount|finbot|stripe\.com\/(?:invoice|receipt)|invoice\.stripe|pay\.google|paddle|chargebee|recurly)/i;
const INVOICE_WORDS = /(invoice|receipt|document|openinvoice|download|pdf|חשבונית|קבלה)/i;
const NOISE = /(unsubscribe|facebook\.com\/(?!ads)|twitter|instagram|linkedin|youtube|privacy|terms|\.(png|jpe?g|gif|svg)(\?|$))/i;

/** Unwrap tracking redirects that embed the real URL (awstrack, sendgrid, mailchimp style). */
export function unwrap(url: string): string {
  const at = url.slice(1).search(/https?(?::|%3A)(?:\/\/|%2F%2F)/i);
  if (at >= 0) {
    try {
      const inner = decodeURIComponent(url.slice(at + 1).split(/\/\d\/0\d{3}/)[0]);
      if (/^https?:\/\//.test(inner)) return inner;
    } catch {
      /* keep original */
    }
  }
  return url;
}

export function invoiceLinks(text: string): string[] {
  const out: string[] = [];
  for (const m of (text || "").matchAll(/https?:\/\/[^\s)\]|"'<>]+/g)) {
    const u = unwrap(m[0].replace(/[.,;]+$/, ""));
    if (NOISE.test(u)) continue;
    if (!INVOICE_HOSTS.test(u) && !INVOICE_WORDS.test(u)) continue;
    if (!out.includes(u)) out.push(u);
  }
  // Known invoice hosts first
  return out.sort((a, b) => Number(INVOICE_HOSTS.test(b)) - Number(INVOICE_HOSTS.test(a))).slice(0, 4);
}

export type Fetched = { bytes: Buffer; mime: string; name: string; finalUrl: string };

/**
 * Follow a link and return a PDF or image if the server hands one back, either directly
 * or from an HTML page that links to one. Returns null when the document needs a login.
 */
export async function fetchInvoice(url: string, depth = 0): Promise<Fetched | null> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 (compatible; DaysyInvoices/1.0)", accept: "application/pdf,text/html;q=0.9,*/*;q=0.5" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const mime = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const finalUrl = res.url;
  if (mime === "application/pdf" || mime.startsWith("image/") || mime === "application/octet-stream") {
    const bytes = Buffer.from(await res.arrayBuffer());
    if (mime === "application/octet-stream" && bytes.subarray(0, 4).toString() !== "%PDF") return null;
    const cd = res.headers.get("content-disposition") || "";
    const name = decodeURIComponent((cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i) || [])[1] || "invoice.pdf");
    return { bytes, mime: mime === "application/octet-stream" ? "application/pdf" : mime, name, finalUrl };
  }
  if (mime === "text/html" && depth < 2) {
    const html = await res.text();
    const candidates = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)]
      .map((m) => {
        try {
          return new URL(m[1].replace(/&amp;/g, "&"), finalUrl).toString();
        } catch {
          return "";
        }
      })
      .filter((u) => u && /(\.pdf(\?|$)|download|pdf|print|getdocument|openinvoice)/i.test(u));
    for (const c of candidates.slice(0, 3)) {
      const got = await fetchInvoice(c, depth + 1).catch(() => null);
      if (got) return got;
    }
  }
  return null;
}
