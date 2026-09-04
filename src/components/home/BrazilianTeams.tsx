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
    className="group flex flex-shrink-0 flex-col items-center justify-center"
  >
    <div className="glass-card flex h-[104px] w-[104px] items-center justify-center rounded-[1.4rem] p-2 lg:h-[82px] lg:w-[82px] xl:h-[104px] xl:w-[104px]">
      <div className="glass-media h-full w-full overflow-hidden rounded-[1rem]">
        <img
          src={team.logoUrl}
          alt={team.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none"
        />
      </div>
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
    <section className="overflow-hidden bg-transparent py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-7 text-center sm:mb-9">
          <p className="display-kicker">Futebol brasileiro</p>
          <h2 className="display-title-sm mt-2">Encontre seu time</h2>
        </div>

        <div className="glass-panel teams-panel rounded-[1.75rem] px-3 py-5 sm:px-5">
          <div className="relative">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex h-[112px] snap-x items-center gap-3 overflow-x-auto scroll-smooth no-scrollbar lg:grid lg:h-[132px] lg:w-full lg:grid-cols-11 lg:gap-5 lg:overflow-visible"
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

            <div className="mt-3 flex justify-center gap-2 lg:hidden">
              {dots.map((dot) => (
                <div
                  key={dot}
                  className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                    activeDotIndex === dot ? "w-5 bg-red-600" : "w-1.5 bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BrazilianTeams;
