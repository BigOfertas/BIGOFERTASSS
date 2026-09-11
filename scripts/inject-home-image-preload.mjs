import fs from "node:fs";
import path from "node:path";

const htmlPath = path.join("dist", "client", "index.html");
const preloadPath = path.join(".tmp", "home-product-image-preload.json");

if (!fs.existsSync(htmlPath)) {
  console.error(`Hostinger index not found: ${htmlPath}`);
  process.exit(2);
}

if (!fs.existsSync(preloadPath)) {
  console.error(`Homepage image preload metadata not found: ${preloadPath}`);
  process.exit(3);
}

const metadata = JSON.parse(fs.readFileSync(preloadPath, "utf8"));
if (!metadata?.href || typeof metadata.href !== "string") {
  console.error("Homepage image preload metadata is invalid.");
  process.exit(4);
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const attributes = [
  'rel="preload"',
  'as="image"',
  `href="${escapeAttribute(metadata.href)}"`,
  'fetchpriority="high"',
  'data-home-product-image-preload="true"',
];

if (metadata.srcSet) {
  attributes.push(`imagesrcset="${escapeAttribute(metadata.srcSet)}"`);
}
if (metadata.sizes) {
  attributes.push(`imagesizes="${escapeAttribute(metadata.sizes)}"`);
}

const preloadTag = `<link ${attributes.join(" ")}>`;
let html = fs.readFileSync(htmlPath, "utf8");
html = html.replace(/<link[^>]+data-home-product-image-preload="true"[^>]*>\s*/gi, "");

if (!html.includes("</head>")) {
  console.error("Hostinger index does not contain </head>.");
  process.exit(5);
}

html = html.replace("</head>", `  ${preloadTag}\n</head>`);
fs.writeFileSync(htmlPath, html, "utf8");

console.log(
  `HOME_PRODUCT_IMAGE_PRELOAD_INJECTED href=${metadata.href} responsive=${Boolean(metadata.srcSet)}`,
);
