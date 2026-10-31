"use client";
import { useTransition } from "react";

/** A button that runs a server action and shows that it is working. */
export default function ActionButton({ action, label, busy = "רגע…", primary, small = true }: { action: () => Promise<void>; label: string; busy?: string; primary?: boolean; small?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className={`btn${small ? " small" : ""}${primary ? " primary" : ""}`} disabled={pending} onClick={() => start(() => action())}>
      {pending ? busy : label}
    </button>
  );
}
