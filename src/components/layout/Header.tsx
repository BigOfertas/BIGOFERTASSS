import React from "react";
import { Search, User, ShoppingCart, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import CategoryNav from "./CategoryNav";

const Header: React.FC = () => {
  return (
    <header className="bg-white sticky top-0 z-50">
      {/* Desktop Header */}
      <div className="hidden md:block border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-8">
            {/* Logo */}
            <div className="flex-shrink-0 w-48 h-10 bg-gray-100 flex items-center justify-center rounded text-gray-400 font-bold italic">
              BIGofertas
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-2xl relative">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="O que você está procurando?"
                  className="w-full pl-4 pr-10 py-2 border-gray-200 focus:border-red-600 focus:ring-red-600 rounded-md"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-6">
              <button className="flex items-center gap-2 text-sm font-medium hover:text-red-600 transition-colors">
                <User className="w-5 h-5" />
                <span>Minha conta</span>
              </button>
              <button className="relative text-black hover:text-red-600 transition-colors">
                <ShoppingCart className="w-6 h-6" />
                {/* Visual indicator for cart could go here */}
              </button>
            </div>
          </div>
        </div>
        <CategoryNav />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden border-b border-gray-100">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="p-1">
              <Menu className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex-shrink-0 w-32 h-8 bg-gray-100 flex items-center justify-center rounded text-gray-400 font-bold italic text-sm">
            BIGofertas
          </div>

          <div className="flex items-center gap-4">
            <button className="text-black">
              <User className="w-6 h-6" />
            </button>
            <button className="text-black">
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
              className="w-full pl-4 pr-10 py-2 border-gray-200 focus:border-red-600 focus:ring-red-600 rounded-md text-sm"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
