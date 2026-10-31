import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSyncState } from "@/lib/db";
import { fullScan } from "@/lib/gmail";

export const maxDuration = 300;

/** Status of the mailbox scan. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getSyncState(`gmail:${process.env.INVOICE_MAILBOX}`));
}

/** Run one slice of the full scan now (the page calls this repeatedly until done). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await fullScan(process.env.INVOICE_MAILBOX!, 45_000));
  } catch (e) {
    const msg = (e as Error).message || String(e);
    console.error("full scan failed", msg);
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 });
  }
}
