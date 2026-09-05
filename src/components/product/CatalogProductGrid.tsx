import { useEffect, useRef, useState } from "react";

import type { CatalogListItem } from "@/lib/catalog";
import ProductCard from "@/components/product/ProductCard";

type DesktopColumns = 2 | 3 | 4 | 5;
type MobileColumns = 1 | 2;

const DESKTOP_STORAGE_KEY = "bigofertas.catalog.desktopColumns";
const MOBILE_STORAGE_KEY = "bigofertas.catalog.mobileColumns";

const desktopGridClass: Record<DesktopColumns, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

function readStoredDesktopColumns(): DesktopColumns {
  if (typeof window === "undefined") return 4;
  const value = Number(window.localStorage.getItem(DESKTOP_STORAGE_KEY));
  return value === 2 || value === 3 || value === 4 || value === 5 ? value : 4;
}

function readStoredMobileColumns(): MobileColumns {
  if (typeof window === "undefined") return 2;
  return window.localStorage.getItem(MOBILE_STORAGE_KEY) === "1" ? 1 : 2;
}

function DensityIcon({ columns }: { columns: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-4 w-5 gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: columns }).map((_, index) => (
        <span key={index} className="rounded-[1px] bg-current" />
      ))}
    </span>
  );
}

function DensityButton({
  columns,
  active,
  onClick,
}: {
  columns: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${columns} produto${columns > 1 ? "s" : ""} por linha`}
      title={`${columns} por linha`}
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 transition-colors ${
        active
          ? "border-red-600 bg-red-50 text-red-600"
          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-900"
      }`}
    >
      <DensityIcon columns={columns} />
    </button>
  );
}

export function CatalogProductGrid({
  products,
  isLoading,
}: {
  products: CatalogListItem[];
  isLoading: boolean;
}) {
  const [desktopColumns, setDesktopColumns] = useState<DesktopColumns>(() => readStoredDesktopColumns());
  const [mobileColumns, setMobileColumns] = useState<MobileColumns>(() => readStoredMobileColumns());
  const [fading, setFading] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  function changeDensity(kind: "desktop" | "mobile", value: DesktopColumns | MobileColumns) {
    const current = kind === "desktop" ? desktopColumns : mobileColumns;
    if (current === value) return;

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setFading(true);
    timerRef.current = window.setTimeout(() => {
      if (kind === "desktop") {
        const next = value as DesktopColumns;
        setDesktopColumns(next);
        window.localStorage.setItem(DESKTOP_STORAGE_KEY, String(next));
      } else {
        const next = value as MobileColumns;
        setMobileColumns(next);
        window.localStorage.setItem(MOBILE_STORAGE_KEY, String(next));
      }
      setFading(false);
      timerRef.current = null;
    }, 120);
  }

  const mobileGridClass = mobileColumns === 1 ? "grid-cols-1" : "grid-cols-2";
  const gridClass = `${mobileGridClass} md:grid-cols-3 ${desktopGridClass[desktopColumns]}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2" aria-label="Modo de visualização do catálogo">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">Visualização</span>
        <div className="flex gap-1.5 lg:hidden">
          {([1, 2] as const).map((columns) => (
            <DensityButton
              key={columns}
              columns={columns}
              active={mobileColumns === columns}
              onClick={() => changeDensity("mobile", columns)}
            />
          ))}
        </div>
        <div className="hidden gap-1.5 lg:flex">
          {([2, 3, 4, 5] as const).map((columns) => (
            <DensityButton
              key={columns}
              columns={columns}
              active={desktopColumns === columns}
              onClick={() => changeDensity("desktop", columns)}
            />
          ))}
        </div>
      </div>

      <div className={`transition-opacity duration-200 ease-out ${fading ? "opacity-0" : "opacity-100"}`}>
        {isLoading ? (
          <div className={`grid ${gridClass} gap-4 md:gap-6`}>
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[4/5] animate-pulse rounded-md bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <div className={`grid ${gridClass} gap-4 md:gap-6`}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                slug={product.slug}
                name={product.name}
                price={product.price}
                promotionalPrice={product.promotional_price}
                imageUrl={product.displayImageUrl}
                time={product.time}
                commercialType={product.commercial_type}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
