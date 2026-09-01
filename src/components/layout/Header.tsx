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
    <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-5">
          <div className="flex items-center justify-between gap-12">
            <Link
              to="/"
              className="flex-shrink-0 w-56 flex items-center"
              aria-label="BIGofertas - Início"
            >
              <div className="w-full h-14 bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center rounded-sm text-gray-400 font-black italic text-2xl tracking-tighter">
                <span className="text-red-600">BIG</span>ofertas
              </div>
            </Link>

            <div className="flex-1 max-w-2xl relative">
              <form onSubmit={handleSearch} className="relative group" role="search">
                <Input
                  type="search"
                  aria-label="Buscar produtos"
                  placeholder="O que você está procurando?"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full h-12 pl-5 pr-14 border-gray-300 focus:border-red-600 focus:ring-0 focus-visible:ring-0 rounded-md bg-white transition-all text-sm placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  aria-label="Buscar"
                  className="absolute right-0 top-0 h-full w-14 flex items-center justify-center text-gray-500 group-focus-within:text-red-600 transition-colors"
                >
                  <Search className="w-6 h-6" />
                </button>
              </form>
            </div>

            <div className="flex items-center gap-10">
              <Link
                to="/login"
                className="flex items-center gap-3 group transition-colors"
              >
                <User className="w-7 h-7 text-gray-900 group-hover:text-red-600 transition-colors" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[11px] text-gray-500 font-medium uppercase tracking-tight">
                    Acessar
                  </span>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-red-600 transition-colors">
                    Conta
                  </span>
                </div>
              </Link>

              <Link
                to="/cart"
                aria-label={`Carrinho com ${totalItems} item(ns)`}
                className="flex items-center gap-3 group relative"
              >
                <div className="relative">
                  <ShoppingCart className="w-8 h-8 text-gray-900 group-hover:text-red-600 transition-colors" />
                  {totalItems > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
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
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            className="p-1 -ml-1 text-gray-900 active:text-red-600 transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="w-8 h-8" />
            ) : (
              <Menu className="w-8 h-8" />
            )}
          </button>

          <Link
            to="/"
            className="flex-1 flex justify-center"
            aria-label="BIGofertas - Início"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="w-36 h-10 bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center rounded-sm text-gray-400 font-black italic text-lg tracking-tighter">
              <span className="text-red-600">BIG</span>ofertas
            </div>
          </Link>

          <div className="flex items-center gap-4 -mr-1">
            <Link
              to="/login"
              aria-label="Acessar conta"
              className="text-gray-900 active:text-red-600 p-1"
            >
              <User className="w-7 h-7" />
            </Link>
            <Link
              to="/cart"
              aria-label={`Carrinho com ${totalItems} item(ns)`}
              className="text-gray-900 active:text-red-600 p-1 relative"
            >
              <ShoppingCart className="w-7 h-7" />
              {totalItems > 0 ? (
                <span className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-bold min-w-3.5 h-3.5 px-0.5 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        <div className="px-4 pb-4">
          <form onSubmit={handleSearch} className="relative group" role="search">
            <Input
              type="search"
              aria-label="Buscar produtos"
              placeholder="O que você está procurando?"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full h-11 pl-4 pr-12 border-gray-300 focus:border-red-600 focus:ring-0 focus-visible:ring-0 rounded-md bg-white text-sm"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-red-600"
            >
              <Search className="w-5 h-5" />
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
