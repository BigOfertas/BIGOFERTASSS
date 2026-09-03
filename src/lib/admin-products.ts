import { supabase } from "@/integrations/supabase/client";
import type { Enums, Tables } from "@/integrations/supabase/types";
import { getUserFacingError } from "@/lib/user-facing-error";

type ProductRow = Tables<"products">;
type VariantRow = Tables<"product_variants">;
type CategoryRow = Tables<"categories">;

export type AdminProductStatus = Enums<"product_status">;

export type AdminCategory = Pick<
  CategoryRow,
  "id" | "name" | "slug" | "is_active" | "sort_order"
>;

export type AdminDefaultVariant = Pick<
  VariantRow,
  | "id"
  | "sku"
  | "name"
  | "stock_quantity"
  | "status"
  | "is_default"
>;

type AdminVariantLookup = AdminDefaultVariant & Pick<VariantRow, "product_id">;

type ProductIdentityReservation = {
  reservation_id: number;
  product_sku: string;
  product_slug: string;
  default_variant_sku: string;
};

export type AdminProduct = Pick<
  ProductRow,
  | "id"
  | "name"
  | "sku"
  | "slug"
  | "description"
  | "price"
  | "promotional_price"
  | "status"
  | "primary_category_id"
  | "category"
  | "campeonato"
  | "liga"
  | "time"
  | "specifications"
  | "weight_grams"
  | "length_cm"
  | "width_cm"
  | "height_cm"
  | "stock"
  | "created_at"
  | "updated_at"
> & {
  defaultVariant: AdminDefaultVariant | null;
};

export type AdminProductInput = {
  id?: string;
  name: string;
  description: string;
  price: number;
  promotionalPrice: number | null;
  status: AdminProductStatus;
  primaryCategoryId: string | null;
  categoryName: string | null;
  campeonato: string;
  liga: string;
  time: string;
  specifications: string;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  defaultVariantId?: string;
  variantName: string;
  stockQuantity: number;
};

export type AdminCatalogSnapshot = {
  products: AdminProduct[];
  categories: AdminCategory[];
};

function optionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function friendlyError(error: unknown, fallback: string) {
  return new Error(getUserFacingError(error, fallback));
}

function validateInput(input: AdminProductInput) {
  if (!input.name.trim()) {
    throw new Error("Informe o nome do produto.");
  }

  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error("Informe um preço válido.");
  }

  if (
    input.promotionalPrice !== null &&
    (!Number.isFinite(input.promotionalPrice) ||
      input.promotionalPrice < 0 ||
      input.promotionalPrice >= input.price)
  ) {
    throw new Error("O preço promocional deve ser menor que o preço normal.");
  }

  if (!Number.isInteger(input.stockQuantity) || input.stockQuantity < 0) {
    throw new Error(
      "O estoque precisa ser um número inteiro igual ou maior que zero.",
    );
  }

  const dimensions = [input.lengthCm, input.widthCm, input.heightCm];
  const dimensionCount = dimensions.filter((value) => value !== null).length;

  if (dimensionCount !== 0 && dimensionCount !== 3) {
    throw new Error("Preencha as três dimensões ou deixe todas vazias.");
  }

  if (dimensions.some((value) => value !== null && value <= 0)) {
    throw new Error("As dimensões precisam ser maiores que zero.");
  }

  if (input.weightGrams !== null && input.weightGrams <= 0) {
    throw new Error("O peso precisa ser maior que zero.");
  }
}

async function allocateProductIdentity(): Promise<ProductIdentityReservation> {
  const { data, error } = await (supabase as any).rpc(
    "allocate_product_identity",
  );

  if (error) {
    throw friendlyError(error, "Não foi possível preparar o cadastro do produto.");
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (
    !row ||
    typeof row.reservation_id !== "number" ||
    typeof row.product_sku !== "string" ||
    typeof row.product_slug !== "string" ||
    typeof row.default_variant_sku !== "string"
  ) {
    throw new Error("Não foi possível preparar o cadastro do produto.");
  }

  return row as ProductIdentityReservation;
}

async function releaseProductIdentity(reservationId: number): Promise<void> {
  const { error } = await (supabase as any).rpc("release_product_identity", {
    target_reservation_id: reservationId,
  });

  if (error) {
    console.error("Falha ao liberar a identificação reservada do produto:", error);
  }
}

export async function fetchAdminCatalog(): Promise<AdminCatalogSnapshot> {
  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id,name,sku,slug,description,price,promotional_price,status,primary_category_id,category,campeonato,liga,time,specifications,weight_grams,length_cm,width_cm,height_cm,stock,created_at,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("categories")
      .select("id,name,slug,is_active,sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (productsResult.error) {
    throw friendlyError(productsResult.error, "Não foi possível carregar os produtos.");
  }

  if (categoriesResult.error) {
    throw friendlyError(categoriesResult.error, "Não foi possível carregar as categorias.");
  }

  const products = productsResult.data ?? [];
  const productIds = products.map((product) => product.id);
  let variants: AdminVariantLookup[] = [];

  if (productIds.length > 0) {
    const variantsResult = await supabase
      .from("product_variants")
      .select("id,product_id,sku,name,stock_quantity,status,is_default")
      .in("product_id", productIds)
      .order("is_default", { ascending: false })
      .order("sort_order", { ascending: true });

    if (variantsResult.error) {
      throw friendlyError(variantsResult.error, "Não foi possível carregar as variações dos produtos.");
    }

    variants = variantsResult.data ?? [];
  }

  const firstVariantByProduct = new Map<string, AdminDefaultVariant>();

  for (const variant of variants) {
    if (!firstVariantByProduct.has(variant.product_id)) {
      const { product_id: _productId, ...defaultVariant } = variant;
      firstVariantByProduct.set(variant.product_id, defaultVariant);
    }
  }

  return {
    products: products.map((product) => ({
      ...product,
      defaultVariant: firstVariantByProduct.get(product.id) ?? null,
    })),
    categories: categoriesResult.data ?? [],
  };
}

export async function saveAdminProduct(
  input: AdminProductInput,
): Promise<string> {
  validateInput(input);

  const productPayload = {
    name: input.name.trim(),
    description: optionalText(input.description),
    price: input.price,
    promotional_price: input.promotionalPrice,
    primary_category_id: input.primaryCategoryId,
    category: input.categoryName,
    campeonato: optionalText(input.campeonato),
    liga: optionalText(input.liga),
    time: optionalText(input.time),
    specifications: optionalText(input.specifications),
    weight_grams: input.weightGrams,
    length_cm: input.lengthCm,
    width_cm: input.widthCm,
    height_cm: input.heightCm,
  };

  const variantPayload = {
    name: optionalText(input.variantName),
    stock_quantity: input.stockQuantity,
    status: "active" as const,
    is_default: true,
    sort_order: 0,
  };

  if (input.id) {
    if (input.defaultVariantId) {
      const variantResult = await supabase
        .from("product_variants")
        .update(variantPayload)
        .eq("id", input.defaultVariantId)
        .eq("product_id", input.id);

      if (variantResult.error) {
        throw friendlyError(variantResult.error, "Não foi possível atualizar a variação do produto.");
      }
    } else {
      const productIdentityResult = await supabase
        .from("products")
        .select("sku")
        .eq("id", input.id)
        .single();

      if (productIdentityResult.error) {
        throw friendlyError(productIdentityResult.error, "Não foi possível carregar o produto.");
      }

      const variantResult = await supabase.from("product_variants").insert({
        ...variantPayload,
        product_id: input.id,
        sku: `${productIdentityResult.data.sku}-STD`,
      });

      if (variantResult.error) {
        throw friendlyError(variantResult.error, "Não foi possível criar a variação do produto.");
      }
    }

    const productResult = await supabase
      .from("products")
      .update({
        ...productPayload,
        status: input.status,
      })
      .eq("id", input.id);

    if (productResult.error) {
      throw friendlyError(productResult.error, "Não foi possível atualizar o produto.");
    }

    return input.id;
  }

  const identity = await allocateProductIdentity();

  const createResult = await supabase
    .from("products")
    .insert({
      ...productPayload,
      sku: identity.product_sku,
      slug: identity.product_slug,
      status: "draft",
    })
    .select("id")
    .single();

  if (createResult.error) {
    await releaseProductIdentity(identity.reservation_id);
    throw friendlyError(createResult.error, "Não foi possível cadastrar o produto.");
  }

  const productId = createResult.data.id;

  const variantResult = await supabase.from("product_variants").insert({
    ...variantPayload,
    product_id: productId,
    sku: identity.default_variant_sku,
  });

  if (variantResult.error) {
    await supabase.from("products").delete().eq("id", productId);
    await releaseProductIdentity(identity.reservation_id);
    throw friendlyError(variantResult.error, "Não foi possível criar a variação do produto.");
  }

  if (input.status !== "draft") {
    const activateResult = await supabase
      .from("products")
      .update({ status: input.status })
      .eq("id", productId);

    if (activateResult.error) {
      throw friendlyError(activateResult.error, "Não foi possível atualizar o produto.");
    }
  }

  return productId;
}

export async function archiveAdminProduct(productId: string): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ status: "archived" })
    .eq("id", productId);

  if (error) {
    throw friendlyError(error, "Não foi possível arquivar o produto.");
  }
}
