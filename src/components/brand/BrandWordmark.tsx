import { useState } from "react";

import { BRAND } from "@/config/brand";
import "@/brand.css";

const DROPBOX_WORDMARK_SRC = "/assets/branding/dropbox-wordmark-header-v2.png";

export function BrandWordmark({ className = "" }: { className?: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed) {
    return (
      <span
        role="img"
        aria-label={BRAND.officialName}
        className={`dropbox-wordmark-fallback ${className}`}
      >
        <span>Drop</span>
        <strong>Box</strong>
      </span>
    );
  }

  return (
    <img
      src={DROPBOX_WORDMARK_SRC}
      alt={BRAND.officialName}
      width={440}
      height={76}
      decoding="async"
      onError={() => setImageFailed(true)}
      className={`dropbox-wordmark ${className}`}
    />
  );
}
