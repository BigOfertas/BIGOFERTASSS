import { requireOwner } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import {
  buildProductImageObjectKeys,
  createImageUploadUrl,
  getMaxImageBytes,
} from "../_shared/r2.ts";

type RenditionInput = {
  byteSize?: number | null;
  widthPx?: number | null;
  heightPx?: number | null;
};

type PresignRequest = {
  productId?: string;
  variantId?: string | null;
  originalFilename?: string | null;
  altText?: string | null;
  sortOrder?: number | null;
  full?: RenditionInput;
  card?: RenditionInput;
  thumb?: RenditionInput;
};

function validRendition(value: RenditionInput | undefined) {
  const byteSize = value?.byteSize ?? null;
  const widthPx = value?.widthPx ?? null;
  const heightPx = value?.heightPx ?? null;

  return (
    Number.isInteger(byteSize) &&
    (byteSize as number) > 0 &&
    (byteSize as number) <= getMaxImageBytes() &&
    Number.isInteger(widthPx) &&
    (widthPx as number) > 0 &&
    Number.isInteger(heightPx) &&
    (heightPx as number) > 0
  );
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
    const body = (await request.json()) as PresignRequest;
    const productId = body.productId?.trim();
    const variantId = body.variantId?.trim() || null;
    const originalFilename = body.originalFilename?.trim() || null;
    const altText = body.altText?.trim() || null;
    const sortOrder = Math.max(0, Math.trunc(body.sortOrder ?? 0));

    if (!productId) {
      return errorResponse(request, 400, "productId obrigatorio", "invalid_product");
    }

    if (!validRendition(body.full) || !validRendition(body.card) || !validRendition(body.thumb)) {
      return errorResponse(
        request,
        400,
        "As tres versoes WebP da imagem devem ter tamanho e dimensoes validos",
        "invalid_renditions",
      );
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .maybeSingle();

    if (productError) throw new Error(productError.message);
    if (!product) {
      return errorResponse(request, 404, "Produto nao encontrado", "product_not_found");
    }

    if (variantId) {
      const { data: variant, error: variantError } = await supabase
        .from("product_variants")
        .select("id, product_id")
        .eq("id", variantId)
        .maybeSingle();

      if (variantError) throw new Error(variantError.message);
      if (!variant || variant.product_id !== productId) {
        return errorResponse(
          request,
          400,
          "Variante nao pertence ao produto informado",
          "invalid_variant",
        );
      }
    }

    const objectKeys = buildProductImageObjectKeys(productId, variantId);
    const full = body.full!;
    const card = body.card!;
    const thumb = body.thumb!;

    const { data: image, error: insertError } = await supabase
      .from("product_images")
      .insert({
        product_id: productId,
        variant_id: variantId,
        storage_key: objectKeys.full,
        card_storage_key: objectKeys.card,
        thumb_storage_key: objectKeys.thumb,
        original_filename: originalFilename,
        alt_text: altText,
        mime_type: "image/webp",
        status: "pending",
        is_primary: false,
        sort_order: sortOrder,
        byte_size: full.byteSize,
        width_px: full.widthPx,
        height_px: full.heightPx,
        card_byte_size: card.byteSize,
        card_width_px: card.widthPx,
        card_height_px: card.heightPx,
        thumb_byte_size: thumb.byteSize,
        thumb_width_px: thumb.widthPx,
        thumb_height_px: thumb.heightPx,
      })
      .select("id, product_id, variant_id, storage_key, card_storage_key, thumb_storage_key, status")
      .single();

    if (insertError) throw new Error(insertError.message);

    try {
      const [fullUpload, cardUpload, thumbUpload] = await Promise.all([
        createImageUploadUrl(objectKeys.full, "image/webp"),
        createImageUploadUrl(objectKeys.card, "image/webp"),
        createImageUploadUrl(objectKeys.thumb, "image/webp"),
      ]);

      return jsonResponse(request, {
        imageId: image.id,
        expiresIn: Math.min(fullUpload.expiresIn, cardUpload.expiresIn, thumbUpload.expiresIn),
        uploads: {
          full: {
            objectKey: objectKeys.full,
            uploadUrl: fullUpload.uploadUrl,
            requiredHeaders: { "Content-Type": "image/webp" },
          },
          card: {
            objectKey: objectKeys.card,
            uploadUrl: cardUpload.uploadUrl,
            requiredHeaders: { "Content-Type": "image/webp" },
          },
          thumb: {
            objectKey: objectKeys.thumb,
            uploadUrl: thumbUpload.uploadUrl,
            requiredHeaders: { "Content-Type": "image/webp" },
          },
        },
      });
    } catch (signError) {
      await supabase.from("product_images").update({ status: "failed" }).eq("id", image.id);
      throw signError;
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
