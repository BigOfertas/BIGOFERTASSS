import { requireOwner } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import { getMaxImageBytes, headProductImage, isAllowedImageMimeType } from "../_shared/r2.ts";

type CompleteRequest = {
  uploadId?: string;
  widthPx?: number | null;
  heightPx?: number | null;
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
    const body = (await request.json()) as CompleteRequest;
    const uploadId = body.uploadId?.trim();
    const widthPx = body.widthPx ?? null;
    const heightPx = body.heightPx ?? null;

    if (!uploadId) {
      return errorResponse(request, 400, "uploadId obrigatorio", "invalid_upload");
    }

    if (
      (widthPx === null) !== (heightPx === null) ||
      (widthPx !== null && (!Number.isInteger(widthPx) || widthPx <= 0)) ||
      (heightPx !== null && (!Number.isInteger(heightPx) || heightPx <= 0))
    ) {
      return errorResponse(request, 400, "Dimensoes invalidas", "invalid_dimensions");
    }

    const { data: upload, error: uploadError } = await supabase
      .from("site_asset_uploads")
      .select("id, slot_key, storage_key, mime_type, status")
      .eq("id", uploadId)
      .maybeSingle();

    if (uploadError) throw new Error(uploadError.message);
    if (!upload) {
      return errorResponse(request, 404, "Upload nao encontrado", "upload_not_found");
    }

    const remote = await headProductImage(upload.storage_key);
    const remoteType = remote.contentType ?? upload.mime_type;

    if (!isAllowedImageMimeType(remoteType) || remoteType !== upload.mime_type) {
      await supabase.from("site_asset_uploads").update({ status: "failed" }).eq("id", upload.id);
      return errorResponse(request, 422, "Arquivo enviado invalido", "invalid_remote_file");
    }

    if (remote.byteSize === null || remote.byteSize <= 0 || remote.byteSize > getMaxImageBytes()) {
      await supabase
        .from("site_asset_uploads")
        .update({ status: "failed", byte_size: remote.byteSize })
        .eq("id", upload.id);
      return errorResponse(
        request,
        422,
        "Tamanho do arquivo enviado invalido",
        "invalid_remote_size",
      );
    }

    const { data: completed, error: completeError } = await supabase
      .from("site_asset_uploads")
      .update({
        status: "ready",
        mime_type: remoteType,
        byte_size: remote.byteSize,
        etag: remote.etag,
        width_px: widthPx,
        height_px: heightPx,
        completed_at: new Date().toISOString(),
      })
      .eq("id", upload.id)
      .select("*")
      .single();

    if (completeError) throw new Error(completeError.message);

    const { error: slotError } = await supabase.from("site_personalization_assets").upsert(
      {
        slot_key: upload.slot_key,
        upload_id: upload.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slot_key" },
    );

    if (slotError) throw new Error(slotError.message);

    return jsonResponse(request, {
      asset: {
        slotKey: completed.slot_key,
        storageKey: completed.storage_key,
        mimeType: completed.mime_type,
        byteSize: completed.byte_size,
        widthPx: completed.width_px,
        heightPx: completed.height_px,
      },
    });
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
    return errorResponse(request, 500, "Falha ao confirmar upload", "upload_complete_failed");
  }
});
