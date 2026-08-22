import React from "react";
import { Search, User, ShoppingCart, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import CategoryNav from "./CategoryNav";

const Header: React.FC = () => {
  return (
    <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
      {/* Desktop Header */}
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-5">
          <div className="flex items-center justify-between gap-12">
            {/* Logo */}
            <div className="flex-shrink-0 w-56 flex items-center">
              <div className="w-full h-14 bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center rounded-sm text-gray-400 font-black italic text-2xl tracking-tighter">
                <span className="text-red-600">BIG</span>ofertas
              </div>
            </div>

            {/* Search Bar - Elemento de maior destaque */}
            <div className="flex-1 max-w-2xl relative">
              <div className="relative group">
                <Input
                  type="text"
                  placeholder="O que você está procurando?"
                  className="w-full h-12 pl-5 pr-14 border-gray-300 focus:border-red-600 focus:ring-0 focus-visible:ring-0 rounded-md bg-white transition-all text-sm placeholder:text-gray-400"
                />
                <button className="absolute right-0 top-0 h-full w-14 flex items-center justify-center text-gray-500 group-focus-within:text-red-600 transition-colors">
                  <Search className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Actions (Right Group) */}
            <div className="flex items-center gap-10">
              <button className="flex items-center gap-3 group transition-colors">
                <User className="w-7 h-7 text-gray-900 group-hover:text-red-600 transition-colors" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[11px] text-gray-500 font-medium uppercase tracking-tight">Minha</span>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-red-600 transition-colors">Conta</span>
                </div>
              </button>
              
              <button className="flex items-center gap-3 group relative">
                <div className="relative">
                  <ShoppingCart className="w-8 h-8 text-gray-900 group-hover:text-red-600 transition-colors" />
                  {/* Espaço para futuro contador de itens, sem número fictício agora */}
                </div>
              </button>
            </div>
          </div>
        </div>
        <CategoryNav />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Hamburger Menu (Left) */}
          <button className="p-1 -ml-1 text-gray-900 active:text-red-600 transition-colors">
            <Menu className="w-8 h-8" />
          </button>
          
          {/* Logo (Center) */}
          <div className="flex-1 flex justify-center">
            <div className="w-36 h-10 bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center rounded-sm text-gray-400 font-black italic text-lg tracking-tighter">
              <span className="text-red-600">BIG</span>ofertas
            </div>
          </div>

          {/* Icons (Right) */}
          <div className="flex items-center gap-4 -mr-1">
            <button className="text-gray-900 active:text-red-600 p-1">
              <User className="w-7 h-7" />
            </button>
            <button className="text-gray-900 active:text-red-600 p-1">
              <ShoppingCart className="w-7 h-7" />
            </button>
          </div>
        </div>
        
        {/* Mobile Search Row (Below main line) */}
        <div className="px-4 pb-4">
          <div className="relative group">
            <Input
              type="text"
              placeholder="O que você está procurando?"
              className="w-full h-11 pl-4 pr-12 border-gray-300 focus:border-red-600 focus:ring-0 focus-visible:ring-0 rounded-md bg-white text-sm"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-red-600">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
