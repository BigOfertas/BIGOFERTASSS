import { requireOwner } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import { getMaxImageBytes, headProductImage, isAllowedImageMimeType } from "../_shared/r2.ts";

type CompleteRequest = {
  imageId?: string;
};

async function validateRemoteImage(objectKey: string, expectedType: string) {
  const remote = await headProductImage(objectKey);
  const remoteType = remote.contentType ?? expectedType;

  if (!isAllowedImageMimeType(remoteType)) {
    throw new Error("INVALID_REMOTE_TYPE");
  }

  if (remoteType !== expectedType) {
    throw new Error("CONTENT_TYPE_MISMATCH");
  }

  if (remote.byteSize === null || remote.byteSize <= 0) {
    throw new Error("INVALID_REMOTE_SIZE");
  }

  if (remote.byteSize > getMaxImageBytes()) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  return remote;
}

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

    if (!imageId) {
      return errorResponse(request, 400, "imageId obrigatorio", "invalid_image");
    }

    const { data: image, error: imageError } = await supabase
      .from("product_images")
      .select(
        "id, storage_key, card_storage_key, thumb_storage_key, mime_type, status, width_px, height_px, card_width_px, card_height_px, thumb_width_px, thumb_height_px",
      )
      .eq("id", imageId)
      .maybeSingle();

    if (imageError) throw new Error(imageError.message);
    if (!image) {
      return errorResponse(request, 404, "Imagem nao encontrada", "image_not_found");
    }
    if (image.status === "archived") {
      return errorResponse(request, 409, "Imagem arquivada", "image_archived");
    }

    try {
      const full = await validateRemoteImage(image.storage_key, image.mime_type);
      let card = null;
      let thumb = null;

      if (image.card_storage_key || image.thumb_storage_key) {
        if (!image.card_storage_key || !image.thumb_storage_key) {
          throw new Error("INCOMPLETE_RENDITIONS");
        }

        [card, thumb] = await Promise.all([
          validateRemoteImage(image.card_storage_key, "image/webp"),
          validateRemoteImage(image.thumb_storage_key, "image/webp"),
        ]);
      }

      const { data: completedImage, error: updateError } = await supabase
        .from("product_images")
        .update({
          status: "ready",
          mime_type: image.mime_type,
          byte_size: full.byteSize,
          etag: full.etag,
          card_byte_size: card?.byteSize ?? null,
          thumb_byte_size: thumb?.byteSize ?? null,
        })
        .eq("id", image.id)
        .select("*")
        .single();

      if (updateError) throw new Error(updateError.message);
      return jsonResponse(request, { image: completedImage });
    } catch (verificationError) {
      await supabase
        .from("product_images")
        .update({ status: "failed", is_primary: false })
        .eq("id", image.id);

      const code = verificationError instanceof Error ? verificationError.message : "";
      if (code === "IMAGE_TOO_LARGE") {
        return errorResponse(request, 413, "Objeto excede o limite configurado", "image_too_large");
      }
      if (code === "CONTENT_TYPE_MISMATCH") {
        return errorResponse(
          request,
          422,
          "Content-Type do objeto difere do upload autorizado",
          "content_type_mismatch",
        );
      }
      if (code === "INCOMPLETE_RENDITIONS") {
        return errorResponse(
          request,
          422,
          "As versoes otimizadas da imagem estao incompletas",
          "incomplete_renditions",
        );
      }
      if (code === "INVALID_REMOTE_TYPE") {
        return errorResponse(
          request,
          422,
          "Objeto no R2 nao e uma imagem suportada",
          "invalid_remote_type",
        );
      }
      if (code === "INVALID_REMOTE_SIZE") {
        return errorResponse(
          request,
          422,
          "Objeto vazio ou sem tamanho verificavel",
          "invalid_remote_size",
        );
      }
      throw verificationError;
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
    return errorResponse(request, 500, "Falha ao confirmar upload", "upload_complete_failed");
  }
});
