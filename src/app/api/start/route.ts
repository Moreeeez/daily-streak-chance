import { NextResponse } from "next/server";
import { getRequestIdentity, startDailyRun } from "@/lib/server/store";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const { ipHash } = getRequestIdentity(request);
  const started = await startDailyRun(payload, ipHash);

  return NextResponse.json(started, { status: started.status });
}
