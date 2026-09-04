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
    className={`flex h-full flex-col rounded-md border border-gray-100 bg-white p-2 sm:p-3 ${
      loading ? "animate-pulse" : ""
    }`}
  >
    <div className="relative mb-3 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-sm bg-gray-50">
      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-300">
        <span className="text-lg font-bold italic uppercase tracking-tighter text-red-500/20">
          {BRAND.shortMark}
        </span>
      </div>
    </div>

    <div className="flex flex-1 flex-col">
      <div className="mb-1 h-[28px] space-y-1.5 sm:mb-2 sm:h-[32px]">
        <div className="h-2.5 w-5/6 rounded bg-gray-100" />
        <div className="h-2.5 w-3/5 rounded bg-gray-100" />
      </div>

      <div className="mb-2 mt-auto sm:mb-3">
        <div className="h-4 w-20 rounded bg-gray-100 sm:h-5 sm:w-24" />
      </div>

      <div className="h-8 w-full rounded-sm bg-[#E60000]/15 sm:h-10" />
    </div>
  </div>
);

export default ProductCardPlaceholder;
