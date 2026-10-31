"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Upload a PDF or snap a photo, straight onto an expense or a clearing-fee row. */
export default function Upload({ expenseId, feeKey, month, label = "העלאת חשבונית", primary }: { expenseId?: string; feeKey?: string; month?: string; label?: string; primary?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function onFile(f: File | undefined) {
    if (!f) return;
    setState("busy");
    const fd = new FormData();
    fd.append("file", f);
    if (expenseId) fd.append("expenseId", expenseId);
    if (feeKey) fd.append("feeKey", feeKey);
    if (month) fd.append("month", month);
    const r = await fetch("/api/upload", { method: "POST", body: fd }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) {
      setState("done");
      setMsg("נשמר בקלסר של החודש.");
      router.refresh();
    } else {
      setState("error");
      setMsg(j.error || "ההעלאה לא עברה. אפשר לנסות שוב.");
    }
    setTimeout(() => setState("idle"), 4000);
  }
  return (
    <>
      <label className={`btn small upload-label${primary ? " primary" : ""}`} aria-busy={state === "busy"}>
        {state === "busy" ? "מעלה…" : label}
        <input type="file" accept="application/pdf,image/*" onChange={(e) => onFile(e.target.files?.[0])} disabled={state === "busy"} />
      </label>
      {(state === "done" || state === "error") && <div className="toast" role="status">{msg}</div>}
    </>
  );
}
