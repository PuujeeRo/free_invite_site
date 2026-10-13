import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { settleTip } from "@/lib/tips";

// QPay pings this when a tip invoice is paid. As with the payments webhook the
// ping is unauthenticated, so it is only a prompt to ask QPay for the real
// status (settleTip) -- never proof of payment by itself.
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const tipId = request.nextUrl.searchParams.get("tip_id");
  if (!tipId) return NextResponse.json({ error: "missing_tip_id" }, { status: 400 });

  const status = await settleTip(tipId);
  if (status === "not_found") return NextResponse.json({ error: "tip_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, paid: status === "paid" });
}
