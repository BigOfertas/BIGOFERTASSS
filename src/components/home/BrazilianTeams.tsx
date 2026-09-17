import React, { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

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

const reservedSlots = Array.from({ length: 19 }, (_, index) => index + 1);
const TOTAL_TEAM_SLOTS = teams.length + reservedSlots.length;

const TeamLogo: React.FC<{ team: Team }> = ({ team }) => (
  <Link
    to="/products"
    search={{ time: team.id }}
    aria-label={`Ver produtos do ${team.name}`}
    title={team.name}
    className="group flex flex-shrink-0 flex-col items-center justify-center"
  >
    <div className="flex h-[104px] w-[104px] items-center justify-center rounded-2xl border border-gray-200 bg-white p-2 shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-red-200 group-hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none lg:h-[100px] lg:w-[100px]">
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

const ReservedTeamSlot: React.FC<{ index: number }> = ({ index }) => (
  <Link
    to="/products"
    search={{ campeonato: "brasileirao", sort: "featured" }}
    aria-label={`Espaço reservado para novo time ${index}`}
    title="Mais times"
    className="group flex flex-shrink-0 flex-col items-center justify-center"
  >
    <div className="flex h-[104px] w-[104px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-red-300 group-hover:bg-red-50/60 group-hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none lg:h-[100px] lg:w-[100px]">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 transition-colors group-hover:border-red-200 group-hover:text-red-600">
        <Plus className="h-5 w-5" aria-hidden="true" />
      </div>
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

  const scrollTeams = (direction: -1 | 1) => {
    if (!scrollRef.current) return;
    const distance = Math.max(scrollRef.current.clientWidth * 0.72, 360);
    scrollRef.current.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  const dots = Array.from({ length: 8 }, (_, index) => index);
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

        <div
          className="rounded-2xl border border-gray-200 bg-white px-3 py-5 shadow-sm sm:px-5"
          data-team-slot-count={TOTAL_TEAM_SLOTS}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => scrollTeams(-1)}
              aria-label="Ver times anteriores"
              className="absolute -left-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-md transition hover:border-red-200 hover:text-red-600 lg:flex"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex h-[112px] snap-x snap-mandatory items-center gap-3 overflow-x-auto scroll-smooth no-scrollbar lg:h-[124px] lg:gap-4 lg:px-10"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="flex flex-shrink-0 snap-center items-center justify-center"
                  data-team-slot={team.id}
                >
                  <TeamLogo team={team} />
                </div>
              ))}

              {reservedSlots.map((slot) => (
                <div
                  key={`reserved-${slot}`}
                  className="flex flex-shrink-0 snap-center items-center justify-center"
                  data-team-slot={`reserved-${slot}`}
                >
                  <ReservedTeamSlot index={slot} />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollTeams(1)}
              aria-label="Ver próximos times"
              className="absolute -right-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-md transition hover:border-red-200 hover:text-red-600 lg:flex"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="mt-3 flex justify-center gap-2">
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
