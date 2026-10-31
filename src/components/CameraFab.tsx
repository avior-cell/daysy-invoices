"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** The yellow + in the tab bar: snap a receipt or pick a PDF, Buddy reads and files it. */
export default function CameraFab() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch("/api/upload", { method: "POST", body: fd }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.ok) {
      const v = j.read?.vendor_name ? `${j.read.vendor_name}, ` : "";
      const a = j.read?.amount != null ? `${j.read.currency && j.read.currency !== "ILS" ? j.read.currency + " " : "₪"}${j.read.amount}` : "";
      setMsg(`נשמר בקלסר: ${v}${a}`);
      router.refresh();
    } else setMsg(j.error || "לא הצלחתי לשמור. אפשר לנסות שוב.");
    setTimeout(() => setMsg(""), 5000);
  }
  return (
    <>
      <label className="fab" aria-label="צילום או העלאת חשבונית" aria-busy={busy}>
        {busy ? (
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="9" fill="none" stroke="#12163f" strokeWidth="3" strokeDasharray="14 40"><animateTransform attributeName="transform" type="rotate" from="0 13 13" to="360 13 13" dur="0.9s" repeatCount="indefinite" /></circle></svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 22 22" aria-hidden="true"><rect x="2.5" y="6" width="17" height="12" rx="3" fill="none" stroke="#12163f" strokeWidth="2" /><circle cx="11" cy="12" r="3.2" fill="none" stroke="#12163f" strokeWidth="2" /><path d="M7.5 6 l1.6 -2.4 h3.8 l1.6 2.4" fill="none" stroke="#12163f" strokeWidth="2" strokeLinejoin="round" /></svg>
        )}
        <input type="file" accept="application/pdf,image/*" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
      </label>
      {msg && <div className="toast" role="status">{msg}</div>}
    </>
  );
}
