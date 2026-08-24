import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ProductFiltersProps {
  products: any[];
  search: {
    campeonato?: string | undefined;
    liga?: string | undefined;
    time?: string | undefined;
    category?: string | undefined;
  };
}

const ProductFilters: React.FC<ProductFiltersProps> = ({ products, search }) => {
  const navigate = useNavigate();

  // Extrair valores únicos dinamicamente
  const campeonatos = Array.from(
    new Set(products.map((p) => p.campeonato).filter(Boolean))
  ).sort() as string[];

  const ligas = Array.from(
    new Set(
      products
        .filter((p) => !search.campeonato || p.campeonato === search.campeonato)
        .map((p) => p.liga)
        .filter(Boolean)
    )
  ).sort() as string[];

  const times = Array.from(
    new Set(
      products
        .filter((p) => !search.liga || p.liga === search.liga)
        .map((p) => p.time)
        .filter(Boolean)
    )
  ).sort() as string[];

  const handleFilterChange = (key: string, value: string) => {
    const newSearch = { ...search };
    
    if (newSearch[key as keyof typeof search] === value) {
      delete newSearch[key as keyof typeof search];
      
      // Se desmarcar campeonato, limpar liga e time dependentes
      if (key === "campeonato") {
        delete newSearch.liga;
        delete newSearch.time;
      }
      // Se desmarcar liga, limpar time dependente
      if (key === "liga") {
        delete newSearch.time;
      }
    } else {
      newSearch[key as keyof typeof search] = value;
      
      // Se trocar campeonato, limpar liga e time dependentes para nova seleção
      if (key === "campeonato") {
        delete newSearch.liga;
        delete newSearch.time;
      }
      // Se trocar liga, limpar time dependente
      if (key === "liga") {
        delete newSearch.time;
      }
    }

    navigate({ to: "/products", search: newSearch });
  };

  const clearFilters = () => {
    navigate({ to: "/products", search: {} });
  };

  const FilterSection = ({ 
    title, 
    items, 
    currentValue, 
    filterKey, 
    emptyMessage 
  }: { 
    title: string; 
    items: string[]; 
    currentValue: string | undefined; 
    filterKey: string;
    emptyMessage?: string;
  }) => (
    <div className="mb-8">
      <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 mb-4 flex items-center justify-between">
        {title}
        {currentValue && (
          <button 
            onClick={() => handleFilterChange(filterKey, currentValue)}
            className="text-[10px] text-red-600 hover:text-black transition-colors"
          >
            Limpar
          </button>
        )}
      </h3>
      
      {!items.length && emptyMessage ? (
        <p className="text-xs text-gray-500 italic bg-gray-50 p-3 rounded-sm border border-dashed border-gray-200">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div 
              key={item} 
              className="flex items-center space-x-3 group cursor-pointer" 
              onClick={(e) => {
                e.preventDefault();
                handleFilterChange(filterKey, item);
              }}
            >
              <div className="relative flex items-center justify-center">
                <Checkbox 
                  id={`${filterKey}-${item}`}
                  checked={currentValue === item}
                  onCheckedChange={(checked) => {
                    // Checkbox already triggers a state change, but our div click also does.
                    // Let's rely on one source.
                  }}
                  className="border-gray-300 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600 rounded-none w-4 h-4 transition-all pointer-events-none"
                />
              </div>
              <label 
                htmlFor={`${filterKey}-${item}`}
                className={`text-[13px] font-medium leading-none cursor-pointer transition-colors ${
                  currentValue === item ? "text-red-600 font-bold" : "text-gray-600 group-hover:text-gray-900"
                }`}
              >
                {item}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* Top Header with Clear All */}
      <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
        <h2 className="text-lg font-black uppercase tracking-tight text-gray-900">
          Filtros
        </h2>
        {(search.campeonato || search.liga || search.time || search.category) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="h-7 px-2 text-[10px] font-bold text-red-600 hover:text-white hover:bg-red-600 uppercase transition-all flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Limpar Tudo
          </Button>
        )}
      </div>

      {/* Sections */}
      <FilterSection 
        title="Campeonato" 
        items={campeonatos} 
        currentValue={search.campeonato} 
        filterKey="campeonato"
      />

      <FilterSection 
        title="Liga" 
        items={ligas} 
        currentValue={search.liga} 
        filterKey="liga"
        emptyMessage="Selecione um campeonato para filtrar por liga"
      />

      <FilterSection 
        title="Time" 
        items={times} 
        currentValue={search.time} 
        filterKey="time"
        emptyMessage="Selecione uma liga para filtrar por time"
      />
    </div>
  );
};

export default ProductFilters;
