import { MessageCircle, Phone } from "lucide-react";

import { BRAND } from "@/config/brand";
import { useI18n } from "@/i18n";

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
  const { t, translateText } = useI18n();
  const message =
    productName && productUrl
      ? t("whatsapp.product") + " " + productName + " — " + productUrl
      : t("whatsapp.home");
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
          ? translateText("Falar sobre") + " " + productName + " " + translateText("pelo WhatsApp")
          : translateText("Falar com a DropBox pelo WhatsApp")
      }
      className={
        "group fixed right-4 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-[#25D366] text-white shadow-[0_10px_28px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 motion-reduce:transform-none motion-reduce:transition-none md:bottom-6 md:right-6 " +
        bottomClass
      }
    >
      <span className="relative inline-flex h-8 w-8 items-center justify-center" aria-hidden="true">
        <MessageCircle className="absolute h-8 w-8" strokeWidth={2.25} />
        <Phone className="h-3.5 w-3.5 fill-current" strokeWidth={2.4} />
      </span>
      <span className="pointer-events-none absolute right-[calc(100%+0.75rem)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-950 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none md:block">
        {t("whatsapp.talk")}
      </span>
    </a>
  );
}
