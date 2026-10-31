"use client";
import { useTransition } from "react";

/** A button that runs a server action and shows that it is working. */
export default function ActionButton({ action, label, busy = "רגע…", primary, small = true, kind }: { action: () => Promise<void>; label: string; busy?: string; primary?: boolean; small?: boolean; kind?: "yellow" | "text" | "dark" }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className={`btn${small ? " small" : ""}${primary ? " primary" : ""}${kind ? " " + kind : ""}`} disabled={pending} onClick={() => start(() => action())}>
      {pending ? busy : label}
    </button>
  );
}
