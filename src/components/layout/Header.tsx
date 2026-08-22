import React from "react";
import { Search, User, ShoppingCart, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import CategoryNav from "./CategoryNav";

const Header: React.FC = () => {
  return (
    <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
      {/* Desktop Header */}
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between gap-10">
            {/* Logo */}
            <div className="flex-shrink-0 w-52 flex items-center">
              <div className="w-full h-12 bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center rounded-sm text-gray-400 font-black italic text-xl tracking-tighter">
                <span className="text-red-600">BIG</span>ofertas
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex-1 relative">
              <div className="relative group">
                <Input
                  type="text"
                  placeholder="O que você está procurando?"
                  className="w-full h-11 pl-4 pr-12 border-gray-200 focus:border-red-600 focus:ring-0 focus-visible:ring-0 rounded-md bg-white transition-all text-sm placeholder:text-gray-400"
                />
                <div className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-gray-400 group-focus-within:text-red-600 border-l border-transparent transition-colors">
                  <Search className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-8">
              <button className="flex items-center gap-2 group transition-colors">
                <User className="w-6 h-6 text-gray-800 group-hover:text-red-600 transition-colors" />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Minha</span>
                  <span className="text-sm font-bold text-gray-800 group-hover:text-red-600 transition-colors">Conta</span>
                </div>
              </button>
              
              <button className="flex items-center gap-2 group relative">
                <div className="relative">
                  <ShoppingCart className="w-7 h-7 text-gray-800 group-hover:text-red-600 transition-colors" />
                  {/* Space for future badge:
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">0</span>
                  */}
                </div>
              </button>
            </div>
          </div>
        </div>
        <CategoryNav />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <button className="p-1 -ml-1 text-gray-800 active:text-red-600">
            <Menu className="w-7 h-7" />
          </button>
          
          <div className="flex-1 flex justify-center">
            <div className="w-32 h-8 bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center rounded-sm text-gray-400 font-black italic text-sm tracking-tighter">
              <span className="text-red-600">BIG</span>ofertas
            </div>
          </div>

          <div className="flex items-center gap-4 -mr-1">
            <button className="text-gray-800 active:text-red-600">
              <User className="w-6 h-6" />
            </button>
            <button className="text-gray-800 active:text-red-600">
              <ShoppingCart className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        {/* Mobile Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Input
              type="text"
              placeholder="O que você está procurando?"
              className="w-full h-10 pl-4 pr-10 border-gray-200 focus:border-red-600 focus:ring-0 focus-visible:ring-0 rounded-md bg-white text-sm"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
