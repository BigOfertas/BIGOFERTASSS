import React, { useState } from "react";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";

interface League {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  position: number;
}

const LEAGUES: League[] = [
  { id: 'la-liga', name: 'LA LIGA', slug: 'la-liga', active: true, position: 1 },
  { id: 'premier-league', name: 'PREMIER LEAGUE', slug: 'premier-league', active: true, position: 2 },
  { id: 'serie-a', name: 'SERIE A', slug: 'serie-a', active: true, position: 3 },
  { id: 'bundesliga', name: 'BUNDESLIGA', slug: 'bundesliga', active: true, position: 4 },
  { id: 'ligue-1', name: 'LIGUE 1', slug: 'ligue-1', active: true, position: 5 },
];

// Helper to generate mock products for a specific league
const generateMockProducts = (leagueId: string) => {
  const league = LEAGUES.find(l => l.id === leagueId);
  const leagueName = league ? league.name : 'Liga';
  return Array.from({ length: 15 }, (_, i) => ({
    id: `${leagueId}-prod-${i + 1}`,
    name: `Camisa ${leagueName} Mod. ${i + 1}`,
    price: 289.90 + (i * 10),
  }));
};

const ShopByLeague: React.FC = () => {
  const [activeLeagueId, setActiveLeagueId] = useState(LEAGUES[0].id);

  const activeProducts = generateMockProducts(activeLeagueId);

  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <h2 className="mb-8 text-center text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none text-gray-900">
          COMPRE POR <span className="text-red-600">LIGA</span>
        </h2>

        {/* League Tabs Navigation */}
        <div className="flex justify-start md:justify-center overflow-x-auto no-scrollbar gap-6 md:gap-10 mb-12 pb-2">
          {LEAGUES.map((league) => (
            <button
              key={league.id}
              onClick={() => setActiveLeagueId(league.id)}
              className={`whitespace-nowrap text-sm md:text-base font-bold tracking-tight uppercase transition-all relative pb-2 ${
                activeLeagueId === league.id 
                  ? "text-gray-900" 
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {league.name}
              {activeLeagueId === league.id && (
                <span className="absolute bottom-0 left-0 w-full h-[3px] bg-red-600 rounded-full"></span>
              )}
            </button>
          ))}
        </div>

        {/* Products Section with Crossfade */}
        <div className="relative">
          {LEAGUES.map((league) => (
            activeLeagueId === league.id && (
              <div 
                key={league.id} 
                className="animate-in fade-in duration-300"
              >
                <ProductCarousel itemCount={activeProducts.length}>
                  {activeProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      name={product.name}
                      price={product.price}
                    />
                  ))}
                </ProductCarousel>
              </div>
            )
          ))}
        </div>
      </div>
    </section>
  );
};

export default ShopByLeague;