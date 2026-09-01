import React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, ShoppingCart, User, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useCart } from "@/context/CartContext";
import CategoryNav from "./CategoryNav";

const Header: React.FC = () => {
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();

    void navigate({
      to: "/products",
      search: query ? { q: query } : {},
    });

    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
      <div className="hidden md:block">
        <div className="mx-auto max-w-7xl px-4 py-5 lg:px-8">
          <div className="flex items-center justify-between gap-12">
            <Link
              to="/"
              className="flex w-56 flex-shrink-0 items-center text-3xl font-black italic tracking-tighter text-gray-900"
              aria-label="BIGofertas - Início"
            >
              <span className="text-red-600">BIG</span>ofertas
            </Link>

            <div className="relative max-w-2xl flex-1">
              <form onSubmit={handleSearch} className="group relative" role="search">
                <Input
                  type="search"
                  aria-label="Buscar produtos"
                  placeholder="O que você está procurando?"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-12 w-full rounded-md border-gray-300 bg-white pl-5 pr-14 text-sm transition-all placeholder:text-gray-400 focus:border-red-600 focus:ring-0 focus-visible:ring-0"
                />
                <button
                  type="submit"
                  aria-label="Buscar"
                  className="absolute right-0 top-0 flex h-full w-14 items-center justify-center text-gray-500 transition-colors group-focus-within:text-red-600"
                >
                  <Search className="h-6 w-6" />
                </button>
              </form>
            </div>

            <div className="flex items-center gap-8">
              <Link
                to="/login"
                className="group flex items-center gap-3 transition-colors"
              >
                <User className="h-7 w-7 text-gray-900 transition-colors group-hover:text-red-600" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[11px] font-medium uppercase tracking-tight text-gray-500">
                    Acessar
                  </span>
                  <span className="text-sm font-bold text-gray-900 transition-colors group-hover:text-red-600">
                    Conta
                  </span>
                </div>
              </Link>

              <Link
                to="/cart"
                aria-label={`Carrinho com ${totalItems} item(ns)`}
                className="group relative flex items-center gap-3"
              >
                <div className="relative">
                  <ShoppingCart className="h-8 w-8 text-gray-900 transition-colors group-hover:text-red-600" />
                  {totalItems > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {totalItems}
                    </span>
                  ) : null}
                </div>
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
            className="-ml-1 p-1 text-gray-900 transition-colors active:text-red-600"
          >
            {mobileMenuOpen ? (
              <X className="h-8 w-8" />
            ) : (
              <Menu className="h-8 w-8" />
            )}
          </button>

          <Link
            to="/"
            className="flex flex-1 justify-center text-2xl font-black italic tracking-tighter text-gray-900"
            aria-label="BIGofertas - Início"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="text-red-600">BIG</span>ofertas
          </Link>

          <div className="-mr-1 flex items-center gap-3">
            <Link
              to="/login"
              aria-label="Acessar conta"
              className="p-1 text-gray-900 active:text-red-600"
            >
              <User className="h-7 w-7" />
            </Link>
            <Link
              to="/cart"
              aria-label={`Carrinho com ${totalItems} item(ns)`}
              className="relative p-1 text-gray-900 active:text-red-600"
            >
              <ShoppingCart className="h-7 w-7" />
              {totalItems > 0 ? (
                <span className="absolute right-0 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-600 px-0.5 text-[8px] font-bold text-white">
                  {totalItems}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        <div className="px-4 pb-4">
          <form onSubmit={handleSearch} className="group relative" role="search">
            <Input
              type="search"
              aria-label="Buscar produtos"
              placeholder="O que você está procurando?"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-11 w-full rounded-md border-gray-300 bg-white pl-4 pr-12 text-sm focus:border-red-600 focus:ring-0 focus-visible:ring-0"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-red-600"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>
        </div>

        {mobileMenuOpen ? (
          <CategoryNav mobile onNavigate={() => setMobileMenuOpen(false)} />
        ) : null}
      </div>
    </header>
  );
};

export default Header;
