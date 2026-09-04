import { BRAND } from "@/config/brand";

export function BrandWordmark({ className = "" }: { className?: string }) {
  return <span className={className}>{BRAND.officialName}</span>;
}
