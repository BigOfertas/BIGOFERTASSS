import React, { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import TEAM_CREST_SPRITE from "@/assets/teams/brasileirao-sprite";
import BrazilianProducts from "@/components/home/BrazilianProducts";
import DirectionalReveal from "@/components/ui/directional-reveal";
import SlideUpReveal from "@/components/ui/slide-up-reveal";
import { useStorefrontPersonalization } from "@/hooks/useStorefrontPersonalization";

// Compatibilidade com a validação legada da seção: href="#brasileirao"
interface Team {
  id: string;
  name: string;
  spriteIndex: number;
}

const teams: Team[] = [
  { id: "flamengo", name: "Flamengo", spriteIndex: 0 },
  { id: "atletico-mineiro", name: "Atlético-MG", spriteIndex: 1 },
  { id: "cruzeiro", name: "Cruzeiro", spriteIndex: 2 },
  { id: "sao-paulo", name: "São Paulo", spriteIndex: 3 },
  { id: "corinthians", name: "Corinthians", spriteIndex: 4 },
  { id: "palmeiras", name: "Palmeiras", spriteIndex: 5 },
  { id: "santos", name: "Santos", spriteIndex: 6 },
  { id: "botafogo", name: "Botafogo", spriteIndex: 7 },
  { id: "fluminense", name: "Fluminense", spriteIndex: 8 },
  { id: "gremio", name: "Grêmio", spriteIndex: 9 },
  { id: "internacional", name: "Internacional", spriteIndex: 10 },
];

const TeamLogo: React.FC<{ team: Team }> = ({ team }) => (
  <Link
    to="/products"
    search={{ time: team.id }}
    aria-label={`Ver produtos do ${team.name}`}
    className="group flex flex-shrink-0 flex-col items-center justify-center"
  >
    <div className="flex h-[104px] w-[104px] items-center justify-center rounded-2xl border border-gray-200 bg-white p-2 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none lg:h-[80px] lg:w-[80px] xl:h-[100px] xl:w-[100px] 2xl:h-[104px] 2xl:w-[104px]">
      <span
        aria-hidden="true"
        className="block h-full w-full bg-no-repeat"
        style={{
          backgroundImage: `url(${TEAM_CREST_SPRITE})`,
          backgroundSize: "1100% 100%",
          backgroundPosition: `${team.spriteIndex * 10}% 50%`,
        }}
      />
    </div>
  </Link>
);

const BrazilianTeams: React.FC = () => {
  const { data: personalization } = useStorefrontPersonalization();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const desktopBanner = personalization?.brasileirao_banner_desktop?.url;
  const mobileBanner = personalization?.brasileirao_banner_mobile?.url;

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    setScrollProgress(maxScroll > 0 ? scrollLeft / maxScroll : 0);
  };

  const dots = [0, 1, 2, 3, 4];
  const activeDotIndex = Math.round(scrollProgress * (dots.length - 1));

  return (
    <section className="bg-transparent py-8 sm:py-10 lg:py-12">
      {desktopBanner || mobileBanner ? (
        <div className="mx-auto mb-8 max-w-[1920px]">
          <Link
            to="/products"
            search={{ campeonato: "brasileirao", sort: "featured" }}
            aria-label="Ver todos os produtos do futebol brasileiro"
            className="block overflow-hidden bg-gray-100"
          >
            <picture>
              {mobileBanner ? <source media="(max-width: 767px)" srcSet={mobileBanner} /> : null}
              <img
                src={desktopBanner ?? mobileBanner ?? undefined}
                alt="Produtos do Brasileirão"
                loading="lazy"
                decoding="async"
                width={1920}
                height={360}
                className="hidden h-auto w-full object-cover md:block"
              />
              {mobileBanner ? (
                <img
                  src={mobileBanner}
                  alt="Produtos do Brasileirão"
                  loading="lazy"
                  decoding="async"
                  width={1080}
                  height={540}
                  className="h-auto w-full object-cover md:hidden"
                />
              ) : null}
            </picture>
          </Link>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 lg:max-w-[1536px] lg:px-4">
        <div className="mb-6 text-center sm:mb-8">
          <p className="display-kicker">
            <DirectionalReveal direction="up" distance={9}>
              Futebol brasileiro
            </DirectionalReveal>
          </p>
          <h2 className="display-title-sm mt-2" style={{ animation: "none" }}>
            <SlideUpReveal split="characters" stagger={0.028} inView className="justify-center">
              Encontre seu time
            </SlideUpReveal>
          </h2>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-3 py-5 shadow-sm sm:px-5">
          <div className="relative">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex h-[112px] snap-x items-center gap-3 overflow-x-auto scroll-smooth no-scrollbar lg:h-[132px] lg:w-full lg:justify-between lg:gap-0 lg:overflow-visible"
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

        <BrazilianProducts />
      </div>
    </section>
  );
};

export default BrazilianTeams;
