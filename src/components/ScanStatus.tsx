"use client";
import { useEffect, useState } from "react";

type P = { listingDone: boolean; listed: number; queue: Record<string, number> };

/** Live scan status. The scan runs on the server; this only reports it. */
export default function ScanStatus() {
  const [p, setP] = useState<P | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/sync/gmail")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => alive && j && setP(j))
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  if (!p) return null;
  const q = p.queue || {};
  const left = (q.pending || 0) + (q.working || 0);
  const done = q.done || 0;
  const live = left > 0 || !p.listingDone;
  return (
    <span className="status" title="הסריקה רצה בשרת גם כשהדף סגור">
      <span className={`dot${live ? " live" : ""}`} />
      {live ? (
        <span>
          סורק מיילים · <span className="num">{done.toLocaleString("he-IL")}</span> מתוך <span className="num">{(done + left).toLocaleString("he-IL")}</span>
        </span>
      ) : (
        <span>המייל מעודכן</span>
      )}
    </span>
  );
}
