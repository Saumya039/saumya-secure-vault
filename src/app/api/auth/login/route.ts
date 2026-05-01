import { NextResponse } from "next/server";
import { AuthError, createSession, loginUser, UnauthorizedError } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<LoginBody>(request);
    const user = await loginUser(body.email ?? "", body.password ?? "");
    await createSession(user.id);

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError || error instanceof UnauthorizedError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof Error) {
      return jsonError(error.message, 500);
    }

    return jsonError("Unable to sign in.", 500);
  }
}
