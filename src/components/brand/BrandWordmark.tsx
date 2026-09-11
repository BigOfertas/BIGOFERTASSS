import { BRAND } from "@/config/brand";
import "@/brand.css";

const DROPBOX_WORDMARK_SRC = "/assets/branding/dropbox-wordmark.png";

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <img
      src={DROPBOX_WORDMARK_SRC}
      alt={BRAND.officialName}
      width={1100}
      height={190}
      decoding="async"
      className={`dropbox-wordmark ${className}`}
    />
  );
}
