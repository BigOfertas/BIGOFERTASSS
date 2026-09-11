import { BRAND } from "@/config/brand";

const DROPBOX_LOGO_SRC = "/assets/branding/dropbox-logo.png";

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <img
      src={DROPBOX_LOGO_SRC}
      alt={BRAND.officialName}
      width={190}
      height={64}
      decoding="async"
      className={`mx-auto block h-10 w-auto max-w-full object-contain ${className}`}
    />
  );
}
