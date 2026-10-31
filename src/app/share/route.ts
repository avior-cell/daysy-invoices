import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { intakeFile } from "@/lib/intake";

export const maxDuration = 60;

/**
 * Web Share Target: the installed app appears in the phone's share sheet (WhatsApp, Gallery, Files).
 * Every shared file is read and filed, then the person sees what Buddy found.
 */
export async function POST(req: Request) {
  const base = new URL(req.url).origin;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.redirect(`${base}/login?shared=1`, 303);
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return NextResponse.redirect(`${base}/shared?err=empty`, 303);
  const ids: string[] = [];
  for (const f of files.slice(0, 10)) {
    try {
      ids.push((await intakeFile(f, session.user.email, { via: "שיתוף" })).invoiceId);
    } catch {
      /* the page reports how many arrived */
    }
  }
  return NextResponse.redirect(`${base}/shared?ids=${ids.join(",")}&n=${files.length}`, 303);
}
