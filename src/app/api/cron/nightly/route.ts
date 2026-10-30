import { NextResponse } from "next/server";
import { getSyncState } from "@/lib/db";
import { fullScan, incrementalSync } from "@/lib/gmail";

export const maxDuration = 300;

/** Nightly job (vercel.json). Continues the full mailbox scan until it is done, then runs incremental sync. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const mailbox = process.env.INVOICE_MAILBOX!;
  const state = await getSyncState(`gmail:${mailbox}`);
  const gmail = state?.full_scan_done ? await incrementalSync(mailbox) : await fullScan(mailbox, 270_000);
  return NextResponse.json({ gmail });
}
