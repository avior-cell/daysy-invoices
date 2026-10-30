"use client";
import { useState } from "react";

/** Runs full-scan slices back to back until the server reports the whole mailbox is done. */
export default function ScanButton({ done }: { done: boolean }) {
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setRunning(true);
    try {
      for (;;) {
        const r = await fetch("/api/sync/gmail", { method: "POST" });
        if (!r.ok) throw new Error(`השרת החזיר ${r.status}`);
        const j = await r.json();
        const s = j.stats || {};
        setMsg(`נבדקו ${s.seen || 0} מיילים · ${s.invoice || 0} חשבוניות נשמרו ב־Drive · ${s.link || 0} להורדה ידנית`);
        if (j.done) break;
      }
      setMsg((m) => m + " · הסריקה הושלמה");
      location.reload();
    } catch (e) {
      setMsg(`הסריקה נעצרה: ${(e as Error).message}. אפשר ללחוץ שוב, היא תמשיך מאותה נקודה.`);
    } finally {
      setRunning(false);
    }
  }
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button className="btn" onClick={run} disabled={running}>
        {running ? "סורק…" : done ? "סריקה מלאה מחדש" : "המשך סריקה מלאה"}
      </button>
      <span className="sub">{msg || "הסריקה ממשיכה גם בלילה אוטומטית, גם אם הדף סגור."}</span>
    </div>
  );
}
