import { BRAND } from "@/config/brand";
import "@/brand.css";

const DROPBOX_WORDMARK_SRC = "/assets/branding/dropbox-wordmark-footer.png";

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1100 190"
      role="img"
      aria-label={BRAND.officialName}
      className={`dropbox-wordmark ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{BRAND.officialName}</title>
      <defs>
        <filter id="dropboxLightSurfaceWordmark" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1 -0.933 0 0 0  0 0.094 0 0 0  0 0 0.153 0 0  0 0 0 1 0"
          />
        </filter>
      </defs>
      <image
        href={DROPBOX_WORDMARK_SRC}
        x="0"
        y="0"
        width="1100"
        height="190"
        preserveAspectRatio="xMidYMid meet"
        filter="url(#dropboxLightSurfaceWordmark)"
      />
    </svg>
  );
}
