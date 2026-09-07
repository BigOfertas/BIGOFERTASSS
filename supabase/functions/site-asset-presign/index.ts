import { requireOwner } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import {
  buildSiteAssetObjectKey,
  createImageUploadUrl,
  getMaxImageBytes,
  isAllowedImageMimeType,
} from "../_shared/r2.ts";

const SLOT_KEYS = new Set([
  "top_banner_desktop",
  "top_banner_mobile",
  "hero_desktop",
  "hero_mobile",
  "brasileirao_banner_desktop",
  "brasileirao_banner_mobile",
  "ambient_banner_desktop",
  "ambient_banner_mobile",
  "category_kids",
  "category_training",
  "category_shorts",
  "category_basketball",
  "category_windbreaker",
  "category_fifa",
  "category_retro",
]);

type PresignRequest = {
  slotKey?: string;
  contentType?: string;
  originalFilename?: string | null;
  byteSize?: number | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return errorResponse(request, 405, "Metodo nao permitido", "method_not_allowed");
  }

  try {
    const supabase = await requireOwner(request);
    const body = (await request.json()) as PresignRequest;
    const slotKey = body.slotKey?.trim() ?? "";
    const contentType = body.contentType?.trim().toLowerCase() ?? "";
    const originalFilename = body.originalFilename?.trim() || null;
    const byteSize = body.byteSize ?? null;

    if (!SLOT_KEYS.has(slotKey)) {
      return errorResponse(request, 400, "Slot de personalizacao invalido", "invalid_slot");
    }

    if (!isAllowedImageMimeType(contentType)) {
      return errorResponse(
        request,
        400,
        "Formato nao suportado. Use WebP, AVIF, JPEG ou PNG.",
        "unsupported_image_type",
      );
    }

    if (byteSize !== null) {
      if (!Number.isInteger(byteSize) || byteSize <= 0) {
        return errorResponse(request, 400, "Tamanho de arquivo invalido", "invalid_image_size");
      }
      if (byteSize > getMaxImageBytes()) {
        return errorResponse(request, 413, "Imagem excede o limite configurado", "image_too_large");
      }
    }

    const objectKey = buildSiteAssetObjectKey(slotKey, contentType);
    const { data: upload, error: insertError } = await supabase
      .from("site_asset_uploads")
      .insert({
        slot_key: slotKey,
        storage_key: objectKey,
        original_filename: originalFilename,
        mime_type: contentType,
        byte_size: byteSize,
        status: "pending",
      })
      .select("id, slot_key, storage_key")
      .single();

    if (insertError) throw new Error(insertError.message);

    try {
      const { uploadUrl, expiresIn } = await createImageUploadUrl(objectKey, contentType);
      return jsonResponse(request, {
        uploadId: upload.id,
        slotKey,
        objectKey,
        uploadUrl,
        expiresIn,
        method: "PUT",
        requiredHeaders: { "Content-Type": contentType },
      });
    } catch (error) {
      await supabase.from("site_asset_uploads").update({ status: "failed" }).eq("id", upload.id);
      throw error;
    }
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text();
      return errorResponse(
        request,
        error.status,
        message || "Falha de autorizacao",
        error.status === 401 ? "unauthorized" : "forbidden",
      );
    }

    console.error(error);
    return errorResponse(request, 500, "Falha ao preparar upload", "upload_presign_failed");
  }
});
