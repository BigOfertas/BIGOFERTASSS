import fs from "node:fs";

const routePath = "src/routes/product/$id.tsx";
let route = fs.readFileSync(routePath, "utf8");

if (!route.includes('import { buildProductHead } from "@/lib/product-seo";')) {
  route = route.replace(
    'import { getProductGalleryItems } from "@/lib/product-images";\n',
    'import { getProductGalleryItems } from "@/lib/product-images";\nimport { buildProductHead } from "@/lib/product-seo";\n',
  );
}

const oldRoute = `export const Route = createFileRoute("/product/$id")({\n  head: () => ({\n    meta: [\n      { title: \`Produto | \${BRAND.officialName}\` },\n      {\n        name: "description",\n        content: \`Confira os detalhes do produto no catálogo \${BRAND.officialName}.\`,\n      },\n    ],\n  }),\n  component: ProductDetail,\n});`;

const newRoute = `export const Route = createFileRoute("/product/$id")({\n  loader: ({ params }) => fetchProductDetail(params.id),\n  head: ({ loaderData }) =>\n    loaderData\n      ? buildProductHead(loaderData)\n      : {\n          meta: [\n            { title: \`Produto | \${BRAND.officialName}\` },\n            {\n              name: "description",\n              content: \`Confira os detalhes do produto no catálogo \${BRAND.officialName}.\`,\n            },\n          ],\n        },\n  component: ProductDetail,\n});`;

if (route.includes(oldRoute)) route = route.replace(oldRoute, newRoute);

if (!route.includes("const loaderDetail = Route.useLoaderData();")) {
  route = route.replace(
    `function ProductDetail() {\n  const { id } = Route.useParams();\n  const { addToCart } = useCart();`,
    `function ProductDetail() {\n  const { id } = Route.useParams();\n  const loaderDetail = Route.useLoaderData();\n  const { addToCart } = useCart();`,
  );
}

if (!route.includes("initialData: loaderDetail")) {
  route = route.replace(
    `    queryFn: () => fetchProductDetail(id),\n    staleTime: 60_000,`,
    `    queryFn: () => fetchProductDetail(id),\n    initialData: loaderDetail,\n    staleTime: 60_000,`,
  );
}

route = route.replace(
  `                          detail.variants,\n                          option.id,\n                          value.id,\n                          {},\n                        );`,
  `                          detail.variants,\n                          option.id,\n                          value.id,\n                          selection,\n                        );`,
);

fs.writeFileSync(routePath, route);

const seoPath = "src/components/product/ProductSeo.tsx";
let seo = fs.readFileSync(seoPath, "utf8");
seo = seo.replace(
  'const canonicalUrl = `${window.location.origin}/product/${encodeURIComponent(product.slug)}`;',
  'const canonicalUrl = `${BRAND.siteUrl}/product/${encodeURIComponent(product.slug)}`;',
);
fs.writeFileSync(seoPath, seo);

const typesPath = "src/integrations/supabase/types.ts";
let types = fs.readFileSync(typesPath, "utf8");

const rowMarker = `          byte_size: number | null;\n          checksum_sha256: string | null;`;
if (!types.includes("          card_storage_key: string | null;")) {
  types = types.replace(
    rowMarker,
    `          byte_size: number | null;\n          card_storage_key: string | null;\n          checksum_sha256: string | null;`,
  );
}

const insertMarker = `          byte_size?: number | null;\n          checksum_sha256?: string | null;`;
if (!types.includes("          card_storage_key?: string | null;")) {
  types = types.replace(
    insertMarker,
    `          byte_size?: number | null;\n          card_storage_key?: string | null;\n          checksum_sha256?: string | null;`,
  );
}

const storageRowMarker = `          storage_key: string;\n          updated_at: string;`;
if (!types.includes("          thumb_storage_key: string | null;")) {
  types = types.replace(
    storageRowMarker,
    `          storage_key: string;\n          thumb_storage_key: string | null;\n          updated_at: string;`,
  );
}

const storageOptionalMarker = `          storage_key?: string;\n          updated_at?: string;`;
if (!types.includes("          thumb_storage_key?: string | null;")) {
  types = types.replace(
    storageOptionalMarker,
    `          storage_key?: string;\n          thumb_storage_key?: string | null;\n          updated_at?: string;`,
  );
}

fs.writeFileSync(typesPath, types);

// Temporary branch-only helper. Removed after the edit is committed.
// Trigger 3: include generated product image derivative columns.
