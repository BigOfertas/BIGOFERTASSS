import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const root = read("src/routes/__root.tsx");
const product = read("src/routes/product/$id.tsx");
const support = read("src/components/support/FloatingWhatsAppSupport.tsx");
const share = read("src/components/product/ProductShare.tsx");
const brand = read("src/config/brand.ts");
const seo = read("src/lib/product-seo.ts");

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check(
  "WhatsApp reutiliza BRAND.whatsappUrl",
  support.includes("BRAND.whatsappUrl") && brand.includes("whatsappUrl"),
);
check(
  "mensagem da home inclui saudacao e marca dinamica",
  support.includes("Olá! 👋 Preciso de ajuda com a minha compra na") &&
    support.includes("BRAND.officialName"),
);
check(
  "mensagem do produto inclui nome e URL",
  support.includes("Tenho uma dúvida sobre este produto") &&
    support.includes("productName") &&
    support.includes("productUrl"),
);
check(
  "WhatsApp aparece somente na home pelo root",
  root.includes('pathname === "/"') && root.includes("<FloatingWhatsAppSupport />"),
);
check(
  "produto usa WhatsApp contextual",
  product.includes("<FloatingWhatsAppSupport") &&
    product.includes("productName={product.name}") &&
    product.includes("productUrl={productSeo.canonicalUrl}"),
);
check(
  "botao respeita safe-area e fica acima do CTA movel",
  support.includes("env(safe-area-inset-bottom)") &&
    support.includes("6.5rem") &&
    product.includes("fixed inset-x-0 bottom-0 z-40"),
);
check(
  "icone combina balao e telefone para leitura de WhatsApp",
  support.includes("MessageCircle") && support.includes("Phone"),
);
check(
  "tooltip discreto esta presente",
  support.includes("Fale conosco") && support.includes("group-hover:opacity-100"),
);
check(
  "compartilhamento aparece na pagina de produto",
  product.includes("<ProductShare") && product.includes("canonicalUrl={productSeo.canonicalUrl}"),
);
check(
  "WhatsApp de compartilhamento leva nome e link",
  share.includes("wa.me/?text=") &&
    share.includes("shareMessage") &&
    share.includes("productName") &&
    share.includes("canonicalUrl"),
);
check(
  "copiar link usa toast e nao alert",
  share.includes('toast.success("Link copiado!")') && !share.includes("alert("),
);
check(
  "Web Share API e condicional",
  share.includes('typeof navigator.share === "function"') &&
    share.includes("await navigator.share"),
);
check(
  "Web Share recebe nome do produto no texto e URL canonica separada",
  share.includes("text: shareText") &&
    share.includes("productName +") &&
    share.includes("url: canonicalUrl"),
);
check("Telegram possui URL oficial de share", share.includes("https://t.me/share/url"));
check(
  "URL compartilhada vem do canonical SEO",
  product.includes("buildProductSeoData") &&
    seo.includes("canonicalUrl") &&
    seo.includes("BRAND.siteUrl"),
);
check(
  "Open Graph do produto preserva nome imagem descricao e URL",
  seo.includes('property: "og:title"') &&
    seo.includes('property: "og:description"') &&
    seo.includes('property: "og:url"') &&
    seo.includes('property: "og:image"'),
);
check(
  "nenhum localhost foi introduzido nos componentes",
  !support.includes("localhost") && !share.includes("localhost"),
);
check(
  "admin nao recebe WhatsApp global",
  !root.includes('pathname.startsWith("/admin")') && !root.includes("showFloatingSupport"),
);

let failed = 0;
for (const [name, ok] of checks) {
  console.log((ok ? "PASS" : "FAIL") + " - " + name);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
console.log(
  "\n" +
    checks.length +
    "/" +
    checks.length +
    " validações de WhatsApp/compartilhamento aprovadas.",
);
