import React, { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import atleticoMGAsset from "@/assets/teams/atletico_mineiro.png.asset.json";
import botafogoAsset from "@/assets/teams/botafogo_final.png.asset.json";
import corinthiansAsset from "@/assets/teams/corinthians_v2.png.asset.json";
import cruzeiroAsset from "@/assets/teams/cruzeiro.png.asset.json";
import flamengoAsset from "@/assets/teams/flamengo.png.asset.json";
import fluminenseAsset from "@/assets/teams/fluminense_final.png.asset.json";
import gremioAsset from "@/assets/teams/gremio_final.png.asset.json";
import internacionalAsset from "@/assets/teams/internacional.png.asset.json";
import palmeirasAsset from "@/assets/teams/palmeiras.png.asset.json";
import santosAsset from "@/assets/teams/santos_final.png.asset.json";
import saoPauloAsset from "@/assets/teams/sao_paulo.png.asset.json";

interface Team {
  id: string;
  name: string;
  logoUrl: string;
}

const teams: Team[] = [
  { id: "flamengo", name: "Flamengo", logoUrl: flamengoAsset.url },
  { id: "atletico-mg", name: "Atlético-MG", logoUrl: atleticoMGAsset.url },
  { id: "cruzeiro", name: "Cruzeiro", logoUrl: cruzeiroAsset.url },
  { id: "sao-paulo", name: "São Paulo", logoUrl: saoPauloAsset.url },
  { id: "corinthians", name: "Corinthians", logoUrl: corinthiansAsset.url },
  { id: "palmeiras", name: "Palmeiras", logoUrl: palmeirasAsset.url },
  { id: "santos", name: "Santos", logoUrl: santosAsset.url },
  { id: "botafogo", name: "Botafogo", logoUrl: botafogoAsset.url },
  { id: "fluminense", name: "Fluminense", logoUrl: fluminenseAsset.url },
  { id: "gremio", name: "Grêmio", logoUrl: gremioAsset.url },
  {
    id: "internacional",
    name: "Internacional",
    logoUrl: internacionalAsset.url,
  },
];

const TeamLogo: React.FC<{ team: Team }> = ({ team }) => (
  <Link
    to="/products"
    search={{ time: team.id }}
    aria-label={`Ver produtos do ${team.name}`}
    className="group flex flex-shrink-0 flex-col items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
  >
    <div className="flex h-[110px] w-[110px] items-center justify-center overflow-hidden rounded-lg bg-gray-50 p-0 transition-opacity group-hover:opacity-90 md:h-[120px] md:w-[120px] lg:h-[140px] lg:w-[140px]">
      <img
        src={team.logoUrl}
        alt={team.name}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </div>
  </Link>
);

const BrazilianTeams: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = () => {
    if (!scrollRef.current) {
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    setScrollProgress(maxScroll > 0 ? scrollLeft / maxScroll : 0);
  };

  const dots = [0, 1, 2, 3, 4];
  const activeDotIndex = Math.round(scrollProgress * (dots.length - 1));

  return (
    <section className="overflow-hidden bg-white py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-6 text-center sm:mb-10">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 sm:text-xs">
            FUTEBOL É A PAIXÃO DO BRASILEIRO ⚽
          </p>
          <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 sm:text-3xl">
            TIMES BRASILEIROS
          </h2>
        </div>

        <div className="relative h-[140px] md:h-[160px] lg:h-[180px]">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex h-full snap-x items-center gap-3 overflow-x-auto scroll-smooth pb-6 no-scrollbar md:grid md:w-full md:grid-cols-11 md:gap-0 md:overflow-visible"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex flex-shrink-0 snap-center items-center justify-center"
              >
                <TeamLogo team={team} />
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-center gap-2 md:hidden">
            {dots.map((dot) => (
              <div
                key={dot}
                className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
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
