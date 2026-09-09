import React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Menu, Search, ShoppingCart, User, X } from "lucide-react";

import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Input } from "@/components/ui/input";
import { BRAND } from "@/config/brand";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useCatalogSearchSuggestions } from "@/hooks/useCatalogSearchSuggestions";
import { useAuth } from "@/lib/auth";
import CategoryNav from "./CategoryNav";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function toFilterKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function SearchBox({
  query,
  onQueryChange,
  onSubmit,
  onNavigate,
  mobile = false,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onNavigate: () => void;
  mobile?: boolean;
}) {
  const [focused, setFocused] = React.useState(false);
  const suggestionsQuery = useCatalogSearchSuggestions(query);
  const suggestions = suggestionsQuery.data ?? [];
  const showSuggestions = focused && query.trim().length >= 2;
  const teams = Array.from(new Set(suggestions.map((product) => product.time).filter(Boolean))).slice(0, 4) as string[];
  const brands = Array.from(new Set(suggestions.map((product) => product.brand).filter(Boolean))).slice(0, 3) as string[];

  return (
    <div className="relative">
      <form onSubmit={onSubmit} className="relative group" role="search">
        <Input
          type="search"
          aria-label="Buscar produtos"
          placeholder="Busque por time, seleção, camisa, temporada..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 160)}
          className={`w-full rounded-xl border border-gray-200 bg-gray-50 text-sm placeholder:text-gray-400 focus:border-red-500 focus:bg-white focus:ring-0 focus-visible:ring-2 focus-visible:ring-red-100 ${
            mobile ? "h-11 pl-4 pr-12" : "h-12 pl-5 pr-14"
          }`}
        />
        <button
          type="submit"
          aria-label="Buscar"
          className={
            mobile
              ? "absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-red-600"
              : "absolute right-1.5 top-1.5 flex h-9 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors group-focus-within:bg-white group-focus-within:text-red-600"
          }
        >
          <Search className="h-5 w-5" />
        </button>
      </form>

      {showSuggestions ? (
        <div className="absolute left-0 right-0 top-full z-[70] mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          {suggestionsQuery.isLoading ? (
            <div className="space-y-3 p-4" aria-label="Buscando produtos">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex animate-pulse gap-3">
                  <div className="h-14 w-12 rounded-lg bg-gray-100" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 w-4/5 rounded bg-gray-100" />
                    <div className="h-2.5 w-2/5 rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : suggestions.length > 0 ? (
            <div className={mobile ? "" : "grid grid-cols-[minmax(0,1fr)_190px]"}>
              <div className={mobile ? "" : "border-r border-gray-100"}>
                <div className="flex items-center justify-between px-4 pb-1 pt-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Produtos</span>
                  <span className="text-[10px] font-semibold text-gray-400">Resultados rápidos</span>
                </div>
                <div className="max-h-[390px] overflow-y-auto py-1">
                  {suggestions.slice(0, mobile ? 5 : 6).map((product) => {
                    const effectivePrice = product.promotional_price ?? product.price;
                    return (
                      <Link
                        key={product.id}
                        to="/product/$id"
                        params={{ id: product.slug || product.id }}
                        onClick={onNavigate}
                        className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-gray-50"
                      >
                        <div className="flex h-14 w-12 flex-none items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                          {product.displayImageUrl ? (
                            <img
                              src={product.displayImageUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              width={96}
                              height={120}
                              className="h-full w-full object-contain p-1"
                            />
                          ) : (
                            <span className="text-[8px] font-black text-red-200">BIG</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-bold leading-4 text-gray-900">
                            {product.name}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-gray-400">
                            {[product.time, product.brand, product.season].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <strong className="flex-none text-xs text-gray-950">
                          {currency.format(effectivePrice)}
                        </strong>
                      </Link>
                    );
                  })}
                </div>
                <Link
                  to="/products"
                  search={{ q: query.trim() }}
                  onClick={onNavigate}
                  className="flex h-11 items-center justify-center border-t border-gray-100 px-4 text-xs font-black text-red-600 hover:bg-red-50"
                >
                  Ver todos os resultados para “{query.trim()}”
                </Link>
              </div>

              {!mobile ? (
                <div className="p-4">
                  {teams.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Times e seleções</p>
                      <div className="mt-2 space-y-1">
                        {teams.map((team) => (
                          <Link
                            key={team}
                            to="/products"
                            search={{ time: toFilterKey(team) }}
                            onClick={onNavigate}
                            className="block rounded-md px-2 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-red-600"
                          >
                            {team}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {brands.length > 0 ? (
                    <div className="mt-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Marcas</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {brands.map((brand) => (
                          <Link
                            key={brand}
                            to="/products"
                            search={{ brand: toFilterKey(brand) }}
                            onClick={onNavigate}
                            className="rounded-full border border-gray-200 px-2.5 py-1 text-[10px] font-bold text-gray-700 hover:border-red-200 hover:text-red-600"
                          >
                            {brand}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-5 text-[11px] leading-5 text-gray-400">
                    Pesquise também por temporada, modelo ou categoria.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="px-4 py-5">
              <p className="text-sm font-bold text-gray-900">Nenhum produto encontrado</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">Tente o nome do time, seleção, marca ou uma palavra mais curta.</p>
              <Link
                to="/products"
                search={{ q: query.trim() }}
                onClick={onNavigate}
                className="mt-3 inline-block text-xs font-black text-red-600"
              >
                Buscar no catálogo completo
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const Header: React.FC = () => {
  const { totalItems } = useCart();
  const { count: favoriteCount } = useFavorites();
  const { user, isOwner } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const accountDestination = isOwner ? "/admin" : user ? "/conta" : "/login";
  const accountTopLabel = isOwner ? "Painel" : user ? "Minha" : "Acessar";
  const accountBottomLabel = isOwner ? "Admin" : "Conta";

  const closeNavigation = () => setMobileMenuOpen(false);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    void navigate({ to: "/products", search: query ? { q: query } : {} });
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/98 supports-[backdrop-filter]:bg-white/95 supports-[backdrop-filter]:backdrop-blur-xl">
      <div className="hidden md:block">
        <div className="mx-auto max-w-7xl px-4 py-3.5 lg:px-8 lg:py-4">
          <div className="flex items-center gap-7 lg:gap-10">
            <Link
              to="/"
              className="flex w-48 flex-shrink-0 items-center lg:w-52"
              aria-label={`${BRAND.officialName} - Início`}
            >
              <div className="brand-lockup h-12 w-full px-4 text-2xl">
                <BrandWordmark />
              </div>
            </Link>

            <div className="min-w-0 flex-1">
              <SearchBox
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onSubmit={handleSearch}
                onNavigate={closeNavigation}
              />
            </div>

            <div className="flex flex-none items-center gap-1">
              <Link
                to={accountDestination}
                className="group flex h-12 items-center gap-2.5 rounded-xl px-2.5 transition-colors hover:bg-gray-50"
              >
                <User className="h-5.5 w-5.5 text-gray-900 transition-colors group-hover:text-red-600" />
                <div className="hidden flex-col items-start leading-tight lg:flex">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-400">{accountTopLabel}</span>
                  <span className="text-sm font-extrabold tracking-[-0.02em] text-gray-900 transition-colors group-hover:text-red-600">{accountBottomLabel}</span>
                </div>
              </Link>

              <Link
                to="/favoritos"
                aria-label={`Favoritos${favoriteCount ? `: ${favoriteCount}` : ""}`}
                className="group relative flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-gray-50"
              >
                <Heart className="h-5.5 w-5.5 text-gray-900 transition-colors group-hover:text-red-600" />
                {favoriteCount > 0 ? (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white">{favoriteCount}</span>
                ) : null}
              </Link>

              <Link
                to="/cart"
                aria-label={`Carrinho com ${totalItems} item(ns)`}
                className="group relative flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-gray-50"
              >
                <ShoppingCart className="h-5.5 w-5.5 text-gray-900 transition-colors group-hover:text-red-600" />
                {totalItems > 0 ? (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white">{totalItems}</span>
                ) : null}
              </Link>
            </div>
          </div>
        </div>
        <CategoryNav />
      </div>

      <div className="md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            className="-ml-1 flex h-10 w-10 items-center justify-center rounded-lg text-gray-900 active:text-red-600"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          <Link
            to="/"
            className="flex flex-1 justify-center px-3"
            aria-label={`${BRAND.officialName} - Início`}
            onClick={closeNavigation}
          >
            <div className="brand-lockup h-10 w-36 px-3 text-lg"><BrandWordmark /></div>
          </Link>

          <div className="-mr-1 flex items-center gap-1">
            <Link to="/favoritos" aria-label="Favoritos" className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-900 active:text-red-600">
              <Heart className="h-5.5 w-5.5" />
              {favoriteCount > 0 ? <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[8px] font-black text-white">{favoriteCount}</span> : null}
            </Link>
            <Link
              to="/cart"
              aria-label={`Carrinho com ${totalItems} item(ns)`}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-900 active:text-red-600"
            >
              <ShoppingCart className="h-5.5 w-5.5" />
              {totalItems > 0 ? <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[8px] font-black text-white">{totalItems}</span> : null}
            </Link>
          </div>
        </div>

        <div className="px-4 pb-3">
          <SearchBox query={searchQuery} onQueryChange={setSearchQuery} onSubmit={handleSearch} onNavigate={closeNavigation} mobile />
        </div>

        {mobileMenuOpen ? <CategoryNav mobile onNavigate={closeNavigation} /> : null}
      </div>
    </header>
  );
};

export default Header;
