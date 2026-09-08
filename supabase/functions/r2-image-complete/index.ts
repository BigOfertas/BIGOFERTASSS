import { requireOwner } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import { getMaxImageBytes, headProductImage, isAllowedImageMimeType } from "../_shared/r2.ts";

type CompleteRequest = {
  imageId?: string;
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
    const imageId = body.imageId?.trim();
    const widthPx = body.widthPx ?? null;
    const heightPx = body.heightPx ?? null;

    if (!imageId) {
      return errorResponse(request, 400, "imageId obrigatorio", "invalid_image");
    }

    if (
      (widthPx === null) !== (heightPx === null) ||
      (widthPx !== null && (!Number.isInteger(widthPx) || widthPx <= 0)) ||
      (heightPx !== null && (!Number.isInteger(heightPx) || heightPx <= 0))
    ) {
      return errorResponse(
        request,
        400,
        "Dimensoes devem ser positivas e informadas em conjunto",
        "invalid_dimensions",
      );
    }

    const { data: image, error: imageError } = await supabase
      .from("product_images")
      .select("id, storage_key, card_storage_key, thumb_storage_key, mime_type, status")
      .eq("id", imageId)
      .maybeSingle();

    if (imageError) throw new Error(imageError.message);
    if (!image) {
      return errorResponse(request, 404, "Imagem nao encontrada", "image_not_found");
    }
    if (image.status === "archived") {
      return errorResponse(request, 409, "Imagem arquivada", "image_archived");
    }

    const keys = [image.storage_key, image.card_storage_key, image.thumb_storage_key].filter(
      (value): value is string => Boolean(value),
    );
    const remotes = await Promise.all(keys.map((key) => headProductImage(key)));
    const mainRemote = remotes[0];

    if (!mainRemote) {
      return errorResponse(request, 422, "Imagem principal ausente no R2", "missing_remote_image");
    }

    for (const remote of remotes) {
      const remoteType = remote.contentType ?? image.mime_type;
      if (!isAllowedImageMimeType(remoteType) || remoteType !== image.mime_type) {
        await supabase
          .from("product_images")
          .update({ status: "failed", is_primary: false })
          .eq("id", image.id);
        return errorResponse(
          request,
          422,
          "Derivados da imagem sao invalidos",
          "invalid_remote_type",
        );
      }
      if (
        remote.byteSize === null ||
        remote.byteSize <= 0 ||
        remote.byteSize > getMaxImageBytes()
      ) {
        await supabase
          .from("product_images")
          .update({ status: "failed", is_primary: false })
          .eq("id", image.id);
        return errorResponse(
          request,
          422,
          "Derivados da imagem possuem tamanho invalido",
          "invalid_remote_size",
        );
      }
    }

    const { data: completedImage, error: updateError } = await supabase
      .from("product_images")
      .update({
        status: "ready",
        mime_type: mainRemote.contentType ?? image.mime_type,
        byte_size: mainRemote.byteSize,
        etag: mainRemote.etag,
        width_px: widthPx,
        height_px: heightPx,
      })
      .eq("id", image.id)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message);
    return jsonResponse(request, { image: completedImage });
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
