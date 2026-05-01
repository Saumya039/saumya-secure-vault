import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { createEncryptedFile, listFiles, type CreateEncryptedFileInput } from "@/lib/files";
import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const files = await listFiles(user.id);

    return NextResponse.json({ files });
  } catch (error) {
    return handleFileError(error, "Unable to load files.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<CreateEncryptedFileInput>(request);
    const file = await createEncryptedFile(user.id, body);

    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    return handleFileError(error, "Unable to upload file.");
  }
}

function handleFileError(error: unknown, fallback: string) {
  if (error instanceof UnauthorizedError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof Error) {
    return jsonError(error.message, 400);
  }

  return jsonError(fallback, 500);
}
