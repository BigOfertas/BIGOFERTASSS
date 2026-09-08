import fs from "node:fs";

const routePath = "src/routes/product/$id.tsx";
let route = fs.readFileSync(routePath, "utf8");

route = route.replace(
  'import { getProductGalleryItems } from "@/lib/product-images";\n',
  'import { getProductGalleryItems } from "@/lib/product-images";\nimport { buildProductHead } from "@/lib/product-seo";\n',
);

const oldRoute = `export const Route = createFileRoute("/product/$id")({\n  head: () => ({\n    meta: [\n      { title: \`Produto | \${BRAND.officialName}\` },\n      {\n        name: "description",\n        content: \`Confira os detalhes do produto no catálogo \${BRAND.officialName}.\`,\n      },\n    ],\n  }),\n  component: ProductDetail,\n});`;

const newRoute = `export const Route = createFileRoute("/product/$id")({\n  loader: ({ params }) => fetchProductDetail(params.id),\n  head: ({ loaderData }) =>\n    loaderData\n      ? buildProductHead(loaderData)\n      : {\n          meta: [\n            { title: \`Produto | \${BRAND.officialName}\` },\n            {\n              name: "description",\n              content: \`Confira os detalhes do produto no catálogo \${BRAND.officialName}.\`,\n            },\n          ],\n        },\n  component: ProductDetail,\n});`;

if (!route.includes(oldRoute)) throw new Error("Route head block not found");
route = route.replace(oldRoute, newRoute);

route = route.replace(
  `function ProductDetail() {\n  const { id } = Route.useParams();\n  const { addToCart } = useCart();`,
  `function ProductDetail() {\n  const { id } = Route.useParams();\n  const loaderDetail = Route.useLoaderData();\n  const { addToCart } = useCart();`,
);

route = route.replace(
  `    queryFn: () => fetchProductDetail(id),\n    staleTime: 60_000,`,
  `    queryFn: () => fetchProductDetail(id),\n    initialData: loaderDetail,\n    staleTime: 60_000,`,
);

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

// Temporary branch-only helper. Removed after the edit is committed.
