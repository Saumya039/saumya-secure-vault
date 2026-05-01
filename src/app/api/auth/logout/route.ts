import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 500);
    }

    return jsonError("Unable to sign out.", 500);
  }
}
