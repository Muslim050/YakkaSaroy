import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { adminOrNull } from "@/lib/auth";
import { uploadsEnabled, UPLOAD_MAX_BYTES, UPLOAD_TYPES } from "@/lib/uploads";

/**
 * Hands the browser a short-lived token so photos and videos go straight to Vercel Blob,
 * past the 4.5 MB limit on function request bodies. The file never passes through here.
 */
export async function POST(request: Request) {
  if (!uploadsEnabled()) return NextResponse.json({ error: "Хранилище файлов не подключено" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Не удалось прочитать запрос" }, { status: 400 });
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await adminOrNull())) throw new Error("Войдите как администратор");
        if (!pathname.startsWith("catalog/")) throw new Error("Файлы каталога хранятся в папке catalog/");
        return { allowedContentTypes: UPLOAD_TYPES, maximumSizeInBytes: UPLOAD_MAX_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось начать загрузку" }, { status: 400 });
  }
}
