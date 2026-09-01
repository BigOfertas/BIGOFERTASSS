import { requireOwner } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import {
  buildProductImageObjectKey,
  createImageUploadUrl,
  getMaxImageBytes,
  isAllowedImageMimeType,
} from "../_shared/r2.ts";

type PresignRequest = {
  productId?: string;
  variantId?: string | null;
  contentType?: string;
  originalFilename?: string | null;
  altText?: string | null;
  byteSize?: number | null;
  sortOrder?: number | null;
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
    const productId = body.productId?.trim();
    const variantId = body.variantId?.trim() || null;
    const contentType = body.contentType?.trim().toLowerCase() ?? "";
    const originalFilename = body.originalFilename?.trim() || null;
    const altText = body.altText?.trim() || null;
    const byteSize = body.byteSize ?? null;
    const sortOrder = Math.max(0, Math.trunc(body.sortOrder ?? 0));

    if (!productId) {
      return errorResponse(request, 400, "productId obrigatorio", "invalid_product");
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
        return errorResponse(request, 400, "byteSize invalido", "invalid_image_size");
      }

      if (byteSize > getMaxImageBytes()) {
        return errorResponse(request, 413, "Imagem excede o limite configurado", "image_too_large");
      }
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .maybeSingle();

    if (productError) {
      throw new Error(productError.message);
    }

    if (!product) {
      return errorResponse(request, 404, "Produto nao encontrado", "product_not_found");
    }

    if (variantId) {
      const { data: variant, error: variantError } = await supabase
        .from("product_variants")
        .select("id, product_id")
        .eq("id", variantId)
        .maybeSingle();

      if (variantError) {
        throw new Error(variantError.message);
      }

      if (!variant || variant.product_id !== productId) {
        return errorResponse(
          request,
          400,
          "Variante nao pertence ao produto informado",
          "invalid_variant",
        );
      }
    }

    const objectKey = buildProductImageObjectKey(productId, variantId, contentType);

    const { data: image, error: insertError } = await supabase
      .from("product_images")
      .insert({
        product_id: productId,
        variant_id: variantId,
        storage_key: objectKey,
        original_filename: originalFilename,
        alt_text: altText,
        mime_type: contentType,
        status: "pending",
        is_primary: false,
        sort_order: sortOrder,
        byte_size: byteSize,
      })
      .select("id, product_id, variant_id, storage_key, status")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    try {
      const { uploadUrl, expiresIn } = await createImageUploadUrl(
        objectKey,
        contentType,
      );

      return jsonResponse(request, {
        imageId: image.id,
        objectKey,
        uploadUrl,
        expiresIn,
        method: "PUT",
        requiredHeaders: {
          "Content-Type": contentType,
        },
      });
    } catch (signError) {
      await supabase
        .from("product_images")
        .update({ status: "failed" })
        .eq("id", image.id);
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
