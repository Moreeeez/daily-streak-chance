import { NextResponse } from "next/server";
import { recordPlay } from "@/lib/server/store";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const saved = await recordPlay();

  return NextResponse.json({ ...saved, received: payload });
}
