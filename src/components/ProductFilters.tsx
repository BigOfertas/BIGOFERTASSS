import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type {
  CatalogFacetOption,
  CatalogFacets,
  CatalogQuery,
} from "@/lib/catalog";

type FilterKey = "campeonato" | "liga" | "time" | "category";

interface ProductFiltersProps {
  facets: CatalogFacets;
  search: CatalogQuery;
}

const ProductFilters: React.FC<ProductFiltersProps> = ({ facets, search }) => {
  const navigate = useNavigate();
  const [minPrice, setMinPrice] = React.useState(
    search.minPrice?.toString() ?? "",
  );
  const [maxPrice, setMaxPrice] = React.useState(
    search.maxPrice?.toString() ?? "",
  );

  React.useEffect(() => {
    setMinPrice(search.minPrice?.toString() ?? "");
    setMaxPrice(search.maxPrice?.toString() ?? "");
  }, [search.minPrice, search.maxPrice]);

  const handleFilterChange = (key: FilterKey, value: string) => {
    const newSearch: CatalogQuery = { ...search };
    delete newSearch.page;

    if (newSearch[key] === value) {
      delete newSearch[key];

      if (key === "campeonato") {
        delete newSearch.liga;
        delete newSearch.time;
      }

      if (key === "liga") {
        delete newSearch.time;
      }
    } else {
      newSearch[key] = value;

      if (key === "campeonato") {
        delete newSearch.liga;
        delete newSearch.time;
      }

      if (key === "liga") {
        delete newSearch.time;
      }
    }

    void navigate({ to: "/products", search: newSearch });
  };

  const clearFilters = () => {
    const next: CatalogQuery = {};

    if (search.q) next.q = search.q;
    if (search.sort) next.sort = search.sort;
    if (search.pageSize) next.pageSize = search.pageSize;

    void navigate({ to: "/products", search: next });
  };

  const applyPrice = () => {
    const parsedMin = minPrice.trim() ? Number(minPrice) : null;
    const parsedMax = maxPrice.trim() ? Number(maxPrice) : null;
    const next: CatalogQuery = { ...search };
    delete next.page;

    const validMin =
      parsedMin !== null && Number.isFinite(parsedMin) && parsedMin >= 0
        ? parsedMin
        : null;
    const validMax =
      parsedMax !== null && Number.isFinite(parsedMax) && parsedMax >= 0
        ? parsedMax
        : null;

    if (validMin === null) delete next.minPrice;
    else next.minPrice = Math.min(validMin, validMax ?? validMin);

    if (validMax === null) delete next.maxPrice;
    else next.maxPrice = Math.max(validMax, validMin ?? validMax);

    void navigate({ to: "/products", search: next });
  };

  const clearPrice = () => {
    const next: CatalogQuery = { ...search };
    delete next.minPrice;
    delete next.maxPrice;
    delete next.page;
    setMinPrice("");
    setMaxPrice("");
    void navigate({ to: "/products", search: next });
  };

  const FilterSection = ({
    title,
    items,
    currentValue,
    filterKey,
    emptyMessage,
  }: {
    title: string;
    items: CatalogFacetOption[];
    currentValue: string | undefined;
    filterKey: FilterKey;
    emptyMessage?: string;
  }) => (
    <div className="mb-8">
      <h3 className="mb-4 flex items-center justify-between text-sm font-black uppercase tracking-wider text-gray-900">
        {title}
        {currentValue ? (
          <button
            type="button"
            onClick={() => handleFilterChange(filterKey, currentValue)}
            className="text-[10px] text-red-600 transition-colors hover:text-black"
          >
            Limpar
          </button>
        ) : null}
      </h3>

      {!items.length && emptyMessage ? (
        <p className="rounded-sm border border-dashed border-gray-200 bg-gray-50 p-3 text-xs italic text-gray-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
          {items.map((item) => {
            const id = `${filterKey}-${item.value}`;
            const checked = currentValue === item.value;

            return (
              <div key={item.value} className="flex items-center space-x-3">
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={() =>
                    handleFilterChange(filterKey, item.value)
                  }
                  className="h-4 w-4 rounded-none border-gray-300 transition-all data-[state=checked]:border-red-600 data-[state=checked]:bg-red-600"
                />
                <label
                  htmlFor={id}
                  className={`flex flex-1 cursor-pointer items-center justify-between gap-2 text-[13px] font-medium leading-none transition-colors hover:text-gray-900 ${
                    checked ? "font-bold text-red-600" : "text-gray-600"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] font-normal text-gray-400">
                    {item.count}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const hasFilters = Boolean(
    search.campeonato ||
      search.liga ||
      search.time ||
      search.category ||
      search.minPrice !== undefined ||
      search.maxPrice !== undefined,
  );

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="text-lg font-black uppercase tracking-tight text-gray-900">
          Filtros
        </h2>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="flex h-7 items-center gap-1 px-2 text-[10px] font-bold uppercase text-red-600 transition-all hover:bg-red-600 hover:text-white"
          >
            <X className="h-3 w-3" />
            Limpar Tudo
          </Button>
        ) : null}
      </div>

      <FilterSection
        title="Categoria"
        items={facets.categories}
        currentValue={search.category}
        filterKey="category"
      />

      <FilterSection
        title="Campeonato"
        items={facets.campeonatos}
        currentValue={search.campeonato}
        filterKey="campeonato"
      />

      <FilterSection
        title="Liga"
        items={facets.ligas}
        currentValue={search.liga}
        filterKey="liga"
        emptyMessage="Nenhuma liga disponível"
      />

      <FilterSection
        title="Time"
        items={facets.times}
        currentValue={search.time}
        filterKey="time"
        emptyMessage="Nenhum time disponível"
      />

      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
            Preço
          </h3>
          {search.minPrice !== undefined || search.maxPrice !== undefined ? (
            <button
              type="button"
              onClick={clearPrice}
              className="text-[10px] text-red-600 transition-colors hover:text-black"
            >
              Limpar
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            inputMode="decimal"
            aria-label="Preço mínimo"
            placeholder={`Mín. ${Math.floor(facets.priceMin)}`}
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            className="h-9 text-xs"
          />
          <Input
            inputMode="decimal"
            aria-label="Preço máximo"
            placeholder={`Máx. ${Math.ceil(facets.priceMax)}`}
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            className="h-9 text-xs"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={applyPrice}
          className="mt-2 w-full text-[10px] font-bold uppercase"
        >
          Aplicar preço
        </Button>
      </div>
    </div>
  );
};

export default ProductFilters;
