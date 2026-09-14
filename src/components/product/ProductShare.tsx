import { Copy, Link2, MessageCircle, Send, Share2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n";

interface ProductShareProps {
  productName: string;
  canonicalUrl: string;
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
  const { t, translateText } = useI18n();
  const [open, setOpen] = useState(false);
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false);
  const shareHeadline = t("share.found");
  const shareLook = t("share.look");
  const shareMessage = `${shareHeadline}\n${productName}\n${shareLook} ${canonicalUrl}`;
  const whatsAppUrl = "https://wa.me/?text=" + encodeURIComponent(shareMessage);
  const shareText = `${shareHeadline}\n${productName}\n${shareLook}`;
  const telegramUrl =
    "https://t.me/share/url?url=" +
    encodeURIComponent(canonicalUrl) +
    "&text=" +
    encodeURIComponent(shareText);

  useEffect(() => {
    setNativeShareAvailable(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  const handleCopy = async () => {
    try {
      await copyToClipboard(canonicalUrl);
      setOpen(false);
      toast.success(t("share.copySuccess"));
    } catch {
      toast.error(t("share.copyError"));
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: productName,
        text: shareText,
        url: canonicalUrl,
      });
      setOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(t("share.nativeError"));
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
          aria-label={translateText("Compartilhar") + " " + productName}
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
