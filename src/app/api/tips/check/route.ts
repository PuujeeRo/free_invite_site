import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { settleTip } from "@/lib/tips";

// Polled by the tip checkout page while the payer is in their banking app --
// the same arrangement, for the same reasons, as the tip checkout page.
// The tip id is an unguessable uuid and this only reports status: nothing here
// can mark a tip paid that QPay has not confirmed.
export async function GET(request: NextRequest) {
  const tipId = request.nextUrl.searchParams.get("tip_id");
  if (!tipId) return NextResponse.json({ error: "missing_tip_id" }, { status: 400 });

  const status = await settleTip(tipId);
  if (status === "not_found") return NextResponse.json({ error: "tip_not_found" }, { status: 404 });
  return NextResponse.json({ status });
}
