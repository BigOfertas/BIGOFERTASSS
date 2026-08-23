import React, { useRef, useState } from "react";
import flamengoAsset from "@/assets/teams/flamengo.png.asset.json";
import atleticoMGAsset from "@/assets/teams/atletico_mineiro.png.asset.json";
import cruzeiroAsset from "@/assets/teams/cruzeiro.png.asset.json";
import corinthiansAsset from "@/assets/teams/corinthians.png.asset.json";
import santosAsset from "@/assets/teams/santos.png.asset.json";
import botafogoAsset from "@/assets/teams/botafogo.png.asset.json";
import fluminenseAsset from "@/assets/teams/fluminense.png.asset.json";
import gremioAsset from "@/assets/teams/gremio.png.asset.json";

interface Team {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  href: string;
}

interface TeamLogoProps {
  team: Team;
}

const TeamLogo: React.FC<TeamLogoProps> = ({ team }) => {
  return (
    <a
      href={team.href}
      className="flex flex-col items-center justify-center group transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
    >
      <div className="w-[110px] h-[110px] md:w-[120px] md:h-[120px] lg:w-[140px] lg:h-[140px] flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden p-0 group-hover:opacity-90 transition-opacity">
        {team.logoUrl ? (
          <img
            src={team.logoUrl}
            alt={team.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 rounded-lg border-2 border-dashed border-gray-300">
            <span className="text-xs sm:text-sm font-bold uppercase text-center px-1 leading-tight">
              {team.name}
            </span>
          </div>
        )}
      </div>
    </a>
  );
};

const teams: Team[] = [
  { id: "flamengo", name: "Flamengo", slug: "flamengo", href: "/times/flamengo", logoUrl: flamengoAsset.url },
  { id: "atletico-mg", name: "Atlético-MG", slug: "atletico-mg", href: "/times/atletico-mg", logoUrl: atleticoMGAsset.url },
  { id: "cruzeiro", name: "Cruzeiro", slug: "cruzeiro", href: "/times/cruzeiro", logoUrl: cruzeiroAsset.url },
  { id: "sao-paulo", name: "São Paulo", slug: "sao-paulo", href: "/times/sao-paulo" },
  { id: "corinthians", name: "Corinthians", slug: "corinthians", href: "/times/corinthians", logoUrl: corinthiansAsset.url },
  { id: "palmeiras", name: "Palmeiras", slug: "palmeiras", href: "/times/palmeiras" },
  { id: "santos", name: "Santos", slug: "santos", href: "/times/santos", logoUrl: santosAsset.url },
  { id: "botafogo", name: "Botafogo", slug: "botafogo", href: "/times/botafogo", logoUrl: botafogoAsset.url },
  { id: "fluminense", name: "Fluminense", slug: "fluminense", href: "/times/fluminense", logoUrl: fluminenseAsset.url },
  { id: "gremio", name: "Grêmio", slug: "gremio", href: "/times/gremio", logoUrl: gremioAsset.url },
  { id: "internacional", name: "Internacional", slug: "internacional", href: "/times/internacional" },
];

const BrazilianTeams: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const progress = scrollLeft / (scrollWidth - clientWidth);
    setScrollProgress(progress);
  };

  // 5 pips: 0%, 25%, 50%, 75%, 100%
  const dots = [0, 1, 2, 3, 4];
  const activeDotIndex = Math.round(scrollProgress * 4);

  return (
    <section className="py-8 sm:py-12 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center mb-6 sm:mb-10">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            FUTEBOL É A PAIXÃO DO BRASILEIRO, VENDA CERTA! ⚽
          </p>
          <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tight text-gray-900">
            TIMES BRASILEIROS
          </h2>
        </div>

        <div className="relative group/scroll h-[140px] md:h-[160px] lg:h-[180px]">
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto md:overflow-visible pb-6 no-scrollbar gap-3 md:gap-0 scroll-smooth snap-x mandatory md:grid md:grid-cols-11 md:w-full h-full items-center"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {teams.map((team) => (
              <div key={team.id} className="snap-center md:snap-align-none flex justify-center items-center shrink-0">
                <TeamLogo team={team} />
              </div>
            ))}
          </div>
          
          {/* Mobile Discrete Dots Indicator */}
          <div className="md:hidden flex justify-center gap-2 mt-4">
            {dots.map((dot) => (
              <div 
                key={dot}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  activeDotIndex === dot ? "bg-red-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BrazilianTeams;
