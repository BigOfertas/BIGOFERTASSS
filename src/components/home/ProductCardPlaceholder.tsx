import React from "react";

import { BRAND } from "@/config/brand";

interface ProductCardPlaceholderProps {
  loading?: boolean;
}

const ProductCardPlaceholder: React.FC<ProductCardPlaceholderProps> = ({
  loading = false,
}) => (
  <div
    aria-hidden="true"
    className={`glass-card flex h-full flex-col rounded-[1.35rem] p-2.5 sm:p-3.5 ${
      loading ? "animate-pulse" : ""
    }`}
  >
    <div className="glass-media relative mb-3 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[1rem] sm:mb-4">
      <div className="flex h-full w-full items-center justify-center text-gray-300">
        <span className="text-lg font-black uppercase tracking-[-0.06em] text-red-500/20">
          {BRAND.shortMark}
        </span>
      </div>
    </div>

    <div className="flex flex-1 flex-col px-0.5 pb-0.5">
      <div className="mb-2 h-[30px] space-y-2 sm:h-[38px]">
        <div className="h-2.5 w-5/6 rounded-full bg-gray-200/70" />
        <div className="h-2.5 w-3/5 rounded-full bg-gray-200/60" />
      </div>

      <div className="mb-3 mt-auto sm:mb-4">
        <div className="h-5 w-20 rounded-full bg-gray-200/70 sm:w-24" />
      </div>

      <div className="h-9 w-full rounded-xl bg-red-600/12 sm:h-10" />
    </div>
  </div>
);

export default ProductCardPlaceholder;
