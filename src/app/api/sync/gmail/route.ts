import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { progress } from "@/lib/engine";

export const dynamic = "force-dynamic";

/** Scan progress for the status bar. The scan itself runs in the background engine. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await progress());
}
