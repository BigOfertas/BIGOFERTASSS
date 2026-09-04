import { supabase } from "@/integrations/supabase/client";
import type { ProductImage } from "@/lib/products";
import { getUserFacingError } from "@/lib/user-facing-error";

export const ADMIN_IMAGE_ACCEPT = "image/webp,image/avif,image/jpeg,image/png";
export const ADMIN_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/webp",
  "image/avif",
  "image/jpeg",
  "image/png",
]);

type PresignResponse = {
  imageId: string;
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
  method: "PUT";
  requiredHeaders: Record<string, string>;
};

type CompleteResponse = {
  image: ProductImage;
};

function friendlyError(error: unknown, fallback: string) {
  return new Error(getUserFacingError(error, fallback));
}

export function validateAdminImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Formato não aceito. Use WebP, AVIF, JPEG ou PNG.");
  }

  if (file.size <= 0) {
    throw new Error("A imagem selecionada está vazia.");
  }

  if (file.size > ADMIN_IMAGE_MAX_BYTES) {
    throw new Error("A imagem é maior que 15 MB.");
  }
}

export async function fetchAdminProductImages(
  productId: string,
): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .is("variant_id", null)
    .eq("status", "ready")
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw friendlyError(error, "Não foi possível carregar as imagens do produto.");
  }

  return data ?? [];
}

export async function uploadAdminProductImage(input: {
  productId: string;
  productName: string;
  file: File;
  sortOrder: number;
}): Promise<ProductImage> {
  validateAdminImageFile(input.file);

  const { data: presignData, error: presignError } =
    await supabase.functions.invoke<PresignResponse>("r2-image-presign", {
      body: {
        productId: input.productId,
        variantId: null,
        contentType: input.file.type.toLowerCase(),
        originalFilename: input.file.name,
        altText: input.productName,
        byteSize: input.file.size,
        sortOrder: input.sortOrder,
      },
    });

  if (presignError || !presignData?.imageId || !presignData.uploadUrl) {
    throw friendlyError(
      presignError,
      "Não foi possível preparar o envio da imagem.",
    );
  }

  let uploadResponse: Response;

  try {
    uploadResponse = await fetch(presignData.uploadUrl, {
      method: "PUT",
      headers: presignData.requiredHeaders,
      body: input.file,
    });
  } catch (error) {
    await supabase
      .from("product_images")
      .update({ status: "failed", is_primary: false })
      .eq("id", presignData.imageId);
    throw friendlyError(error, "Não foi possível enviar a imagem agora.");
  }

  if (!uploadResponse.ok) {
    await supabase
      .from("product_images")
      .update({ status: "failed", is_primary: false })
      .eq("id", presignData.imageId);
    throw new Error("Não foi possível enviar a imagem agora.");
  }

  const { data: completeData, error: completeError } =
    await supabase.functions.invoke<CompleteResponse>("r2-image-complete", {
      body: { imageId: presignData.imageId },
    });

  if (completeError || !completeData?.image) {
    throw friendlyError(
      completeError,
      "A imagem foi enviada, mas não foi possível confirmar o cadastro.",
    );
  }

  return completeData.image;
}

export async function setAdminProductPrimaryImage(imageId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("set_primary_product_image", {
    target_image_id: imageId,
  });

  if (error) {
    throw friendlyError(error, "Não foi possível definir a imagem principal.");
  }
}

export async function saveAdminProductImageOrder(
  imageIds: string[],
): Promise<void> {
  for (const [index, imageId] of imageIds.entries()) {
    const { error } = await supabase
      .from("product_images")
      .update({ sort_order: index })
      .eq("id", imageId);

    if (error) {
      throw friendlyError(error, "Não foi possível salvar a ordem das imagens.");
    }
  }
}

export async function archiveAdminProductImage(
  imageId: string,
  productId: string,
): Promise<void> {
  const { error } = await supabase
    .from("product_images")
    .update({ status: "archived", is_primary: false })
    .eq("id", imageId)
    .eq("product_id", productId);

  if (error) {
    throw friendlyError(error, "Não foi possível retirar a imagem do produto.");
  }

  const remaining = await fetchAdminProductImages(productId);

  if (remaining.length > 0 && !remaining.some((image) => image.is_primary)) {
    await setAdminProductPrimaryImage(remaining[0].id);
  }
}
