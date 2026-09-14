import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Trecho não encontrado: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Trecho ambíguo: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const floatingSupport = `import { Phone } from "lucide-react";

import { BRAND } from "@/config/brand";

interface FloatingWhatsAppSupportProps {
  productName?: string;
  productUrl?: string;
  productPage?: boolean;
}

function appendMessage(baseUrl: string, message: string) {
  return baseUrl + (baseUrl.includes("?") ? "&" : "?") + "text=" + encodeURIComponent(message);
}

export function FloatingWhatsAppSupport({
  productName,
  productUrl,
  productPage = false,
}: FloatingWhatsAppSupportProps) {
  const message =
    productName && productUrl
      ? "Olá! 👋 Tenho uma dúvida sobre este produto: " + productName + " — " + productUrl
      : "Olá! 👋 Preciso de ajuda com a minha compra na " + BRAND.officialName + ".";
  const href = appendMessage(BRAND.whatsappUrl, message);
  const bottomClass = productPage
    ? "bottom-[calc(env(safe-area-inset-bottom)+6.5rem)]"
    : "bottom-[calc(env(safe-area-inset-bottom)+1rem)]";

  return (
    <a
      data-floating-whatsapp
      data-product-context={productName && productUrl ? "true" : "false"}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        productName
          ? "Falar sobre " + productName + " com a " + BRAND.officialName + " pelo WhatsApp"
          : "Falar com a " + BRAND.officialName + " pelo WhatsApp"
      }
      className={
        "group fixed right-4 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-[#25D366] text-white shadow-[0_10px_28px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 motion-reduce:transform-none motion-reduce:transition-none md:bottom-6 md:right-6 " +
        bottomClass
      }
    >
      <Phone className="h-6 w-6 fill-current" strokeWidth={2.4} aria-hidden="true" />
      <span className="pointer-events-none absolute right-[calc(100%+0.75rem)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-950 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none md:block">
        Fale conosco
      </span>
    </a>
  );
}
`;

const productShare = `import { Copy, Link2, MessageCircle, Send, Share2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BRAND } from "@/config/brand";

interface ProductShareProps {
  productName: string;
  canonicalUrl: string;
}

function buildShareMessage(productName: string, canonicalUrl: string) {
  return (
    "Olha o que eu achei na " +
    BRAND.officialName +
    "! 👀⚽\\n" +
    productName +
    "\\nDá uma olhada: " +
    canonicalUrl
  );
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy_failed");
}

export function ProductShare({ productName, canonicalUrl }: ProductShareProps) {
  const [open, setOpen] = useState(false);
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false);
  const shareMessage = buildShareMessage(productName, canonicalUrl);
  const whatsAppUrl = "https://wa.me/?text=" + encodeURIComponent(shareMessage);
  const telegramText =
    "Olha o que eu achei na " +
    BRAND.officialName +
    "! 👀⚽\\n" +
    productName +
    "\\nDá uma olhada:";
  const telegramUrl =
    "https://t.me/share/url?url=" +
    encodeURIComponent(canonicalUrl) +
    "&text=" +
    encodeURIComponent(telegramText);

  useEffect(() => {
    setNativeShareAvailable(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const handleCopy = async () => {
    try {
      await copyToClipboard(canonicalUrl);
      setOpen(false);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: productName,
        text: "Olha o que eu achei na " + BRAND.officialName + "! 👀⚽",
        url: canonicalUrl,
      });
      setOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Não foi possível abrir o compartilhamento do dispositivo.");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          data-product-share-trigger
          type="button"
          variant="outline"
          className="h-10 gap-2 rounded-lg border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 shadow-none hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950"
          aria-label={"Compartilhar " + productName}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Compartilhar
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-product-share-menu
        align="start"
        sideOffset={8}
        className="w-72 rounded-xl border-gray-200 p-2 shadow-xl"
      >
        <p className="px-2 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">
          Compartilhar produto
        </p>
        <div className="grid gap-1">
          <a
            data-share-whatsapp
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            WhatsApp
          </a>
          <button
            data-share-copy
            type="button"
            onClick={handleCopy}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <Copy className="h-5 w-5 text-gray-500" aria-hidden="true" />
            Copiar link
          </button>
          {nativeShareAvailable ? (
            <button
              data-share-native
              type="button"
              onClick={handleNativeShare}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            >
              <Smartphone className="h-5 w-5 text-gray-500" aria-hidden="true" />
              Compartilhar pelo dispositivo
            </button>
          ) : null}
          <a
            data-share-telegram
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <Send className="h-5 w-5 text-sky-600" aria-hidden="true" />
            Telegram
          </a>
        </div>
        <div className="mt-2 flex items-center gap-2 border-t border-gray-100 px-2 pt-2 text-[11px] text-gray-400">
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          Link oficial da DropBox
        </div>
      </PopoverContent>
    </Popover>
  );
}
`;

const validator = `import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const root = read("src/routes/__root.tsx");
const product = read("src/routes/product/$id.tsx");
const support = read("src/components/support/FloatingWhatsAppSupport.tsx");
const share = read("src/components/product/ProductShare.tsx");
const brand = read("src/config/brand.ts");
const seo = read("src/lib/product-seo.ts");

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check("WhatsApp reutiliza BRAND.whatsappUrl", support.includes("BRAND.whatsappUrl") && brand.includes("whatsappUrl"));
check("mensagem da home inclui saudacao e marca dinamica", support.includes("Olá! 👋 Preciso de ajuda com a minha compra na") && support.includes("BRAND.officialName"));
check("mensagem do produto inclui nome e URL", support.includes("Tenho uma dúvida sobre este produto") && support.includes("productName") && support.includes("productUrl"));
check("WhatsApp aparece somente na home pelo root", root.includes('pathname === "/"') && root.includes("<FloatingWhatsAppSupport />"));
check("produto usa WhatsApp contextual", product.includes("<FloatingWhatsAppSupport") && product.includes("productName={product.name}") && product.includes("productUrl={productSeo.canonicalUrl}"));
check("botao respeita safe-area e fica acima do CTA movel", support.includes("env(safe-area-inset-bottom)") && support.includes("6.5rem") && product.includes("fixed inset-x-0 bottom-0 z-40"));
check("tooltip discreto esta presente", support.includes("Fale conosco") && support.includes("group-hover:opacity-100"));
check("compartilhamento aparece na pagina de produto", product.includes("<ProductShare") && product.includes("canonicalUrl={productSeo.canonicalUrl}"));
check("WhatsApp de compartilhamento leva nome e link", share.includes("wa.me/?text=") && share.includes("shareMessage") && share.includes("productName") && share.includes("canonicalUrl"));
check("copiar link usa toast e nao alert", share.includes('toast.success("Link copiado!")') && !share.includes("alert("));
check("Web Share API e condicional", share.includes('typeof navigator.share === "function"') && share.includes("await navigator.share"));
check("Telegram possui URL oficial de share", share.includes("https://t.me/share/url"));
check("URL compartilhada vem do canonical SEO", product.includes("buildProductSeoData") && seo.includes("canonicalUrl") && seo.includes("BRAND.siteUrl"));
check("Open Graph do produto preserva nome imagem descricao e URL", seo.includes('property: "og:title"') && seo.includes('property: "og:description"') && seo.includes('property: "og:url"') && seo.includes('property: "og:image"'));
check("nenhum localhost foi introduzido nos componentes", !support.includes("localhost") && !share.includes("localhost"));
check("admin nao recebe WhatsApp global", !root.includes('pathname.startsWith("/admin")') && !root.includes("showFloatingSupport"));

let failed = 0;
for (const [name, ok] of checks) {
  console.log((ok ? "PASS" : "FAIL") + " - " + name);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
console.log("\\n" + checks.length + "/" + checks.length + " validações de WhatsApp/compartilhamento aprovadas.");
`;

write("src/components/support/FloatingWhatsAppSupport.tsx", floatingSupport);
write("src/components/product/ProductShare.tsx", productShare);
write("scripts/validate-whatsapp-sharing.mjs", validator);

let rootRoute = read("src/routes/__root.tsx");
rootRoute = replaceOnce(
  rootRoute,
  'import { CookieConsent } from "@/components/privacy/CookieConsent";\n',
  'import { CookieConsent } from "@/components/privacy/CookieConsent";\nimport { FloatingWhatsAppSupport } from "@/components/support/FloatingWhatsAppSupport";\n',
  "import do suporte no root",
);
rootRoute = replaceOnce(
  rootRoute,
  "          <CursorFollower />\n",
  '          {storefrontHydrated && pathname === "/" ? <FloatingWhatsAppSupport /> : null}\n          <CursorFollower />\n',
  "suporte da homepage",
);
write("src/routes/__root.tsx", rootRoute);

let productRoute = read("src/routes/product/$id.tsx");
productRoute = replaceOnce(
  productRoute,
  'import { ProductPurchaseOptions } from "@/components/product/ProductPurchaseOptions";\nimport ProductSeo from "@/components/product/ProductSeo";\n',
  'import { ProductPurchaseOptions } from "@/components/product/ProductPurchaseOptions";\nimport { ProductShare } from "@/components/product/ProductShare";\nimport ProductSeo from "@/components/product/ProductSeo";\nimport { FloatingWhatsAppSupport } from "@/components/support/FloatingWhatsAppSupport";\n',
  "imports do produto",
);
productRoute = replaceOnce(
  productRoute,
  'import { buildProductHead } from "@/lib/product-seo";\n',
  'import { buildProductHead, buildProductSeoData } from "@/lib/product-seo";\n',
  "helper canonical do produto",
);
productRoute = replaceOnce(
  productRoute,
  "  const formattedOriginalPrice = hasPromotion ? currency.format(basePrice) : null;\n\n",
  "  const formattedOriginalPrice = hasPromotion ? currency.format(basePrice) : null;\n  const productSeo = buildProductSeoData(detail);\n\n",
  "dados SEO/canonical",
);
productRoute = replaceOnce(
  productRoute,
  '              {product.description ? (\n                <p className="max-w-2xl leading-relaxed text-gray-600">{product.description}</p>\n              ) : null}\n            </div>\n',
  '              {product.description ? (\n                <p className="max-w-2xl leading-relaxed text-gray-600">{product.description}</p>\n              ) : null}\n              <div className="mt-5">\n                <ProductShare productName={product.name} canonicalUrl={productSeo.canonicalUrl} />\n              </div>\n            </div>\n',
  "botao compartilhar",
);
productRoute = replaceOnce(
  productRoute,
  '      </main>\n\n      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">\n',
  '      </main>\n\n      <FloatingWhatsAppSupport\n        productName={product.name}\n        productUrl={productSeo.canonicalUrl}\n        productPage\n      />\n\n      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">\n',
  "WhatsApp contextual do produto",
);
write("src/routes/product/$id.tsx", productRoute);

console.log("Implementação de WhatsApp e compartilhamento aplicada com sucesso.");
