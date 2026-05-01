import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { deleteFile, getEncryptedFile } from "@/lib/files";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const file = await getEncryptedFile(user.id, id);

    if (!file) {
      return jsonError("File not found.", 404);
    }

    return NextResponse.json({ file });
  } catch (error) {
    return handleFileError(error, "Unable to download file.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteFile(user.id, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleFileError(error, "Unable to delete file.");
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
