import { NextResponse } from "next/server";
import { tick } from "@/lib/engine";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Called every minute by Supabase pg_cron (and once a night by Vercel cron as a fallback). */
async function handle(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await tick(50_000));
  } catch (e) {
    const msg = (e as Error).message || String(e);
    console.error("tick failed", msg);
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
