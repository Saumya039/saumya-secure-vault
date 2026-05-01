import { NextResponse } from "next/server";
import { AuthError, createSession, registerUser, UnauthorizedError } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

type RegisterBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<RegisterBody>(request);
    const user = await registerUser(body.email ?? "", body.password ?? "");
    await createSession(user.id);

    return NextResponse.json({ user });
  } catch (error) {
    return handleAuthError(error);
  }
}

function handleAuthError(error: unknown) {
  if (error instanceof AuthError || error instanceof UnauthorizedError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof Error) {
    return jsonError(error.message, 500);
  }

  return jsonError("Unable to create account.", 500);
}
