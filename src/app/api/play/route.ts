import { NextResponse } from "next/server";
import { recordRun } from "@/lib/server/store";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const saved = await recordRun(payload);

  return NextResponse.json(saved, { status: saved.status });
}
