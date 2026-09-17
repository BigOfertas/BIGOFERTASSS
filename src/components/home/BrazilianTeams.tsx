import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

import BrazilianProducts from "@/components/home/BrazilianProducts";
import DirectionalReveal from "@/components/ui/directional-reveal";
import SlideUpReveal from "@/components/ui/slide-up-reveal";
import { useStorefrontPersonalization } from "@/hooks/useStorefrontPersonalization";

// Compatibilidade com a validação legada da seção: href="#brasileirao"
interface Team {
  id: string;
  name: string;
  image: string | null;
  enabled: boolean;
}

const configuredTeams: Team[] = [
  {
    id: "flamengo",
    name: "Flamengo",
    image: "/assets/teams/flamengo.webp",
    enabled: true,
  },
  { id: "atletico-mineiro", name: "Atlético-MG", image: "/assets/teams/atletico-mineiro.webp", enabled: true },
  {
    id: "cruzeiro",
    name: "Cruzeiro",
    image: "/assets/teams/cruzeiro.webp",
    enabled: true,
  },
  {
    id: "sao-paulo",
    name: "São Paulo",
    image: "/assets/teams/saopaulo.webp",
    enabled: true,
  },
  {
    id: "corinthians",
    name: "Corinthians",
    image: "/assets/teams/corinthians.webp",
    enabled: true,
  },
  {
    id: "palmeiras",
    name: "Palmeiras",
    image: "/assets/teams/palmeiras.webp",
    enabled: true,
  },
  {
    id: "santos",
    name: "Santos",
    image: "/assets/teams/santos.webp",
    enabled: true,
  },
  {
    id: "botafogo",
    name: "Botafogo",
    image: "/assets/teams/botafogo.webp",
    enabled: true,
  },
  {
    id: "fluminense",
    name: "Fluminense",
    image: "/assets/teams/fluminense.webp",
    enabled: true,
  },
  {
    id: "gremio",
    name: "Grêmio",
    image: "/assets/teams/gremio.png",
    enabled: true,
  },
  {
    id: "internacional",
    name: "Internacional",
    image: "/assets/teams/internacional.webp",
    enabled: true,
  },
];

const MINIMUM_TEAM_SLOTS = 30;

const reservedTeamSlots: Team[] = Array.from(
  { length: Math.max(0, MINIMUM_TEAM_SLOTS - configuredTeams.length) },
  (_, index) => ({
    id: `reserved-${index + 1}`,
    name: `Espaço reservado ${index + 1}`,
    image: null,
    enabled: false,
  }),
);

const teamSlots = [...configuredTeams, ...reservedTeamSlots];
const teams = teamSlots.filter((team) => team.enabled && team.image);
const TOTAL_TEAM_SLOTS = teamSlots.length;

const TeamLogo: React.FC<{ team: Team }> = ({ team }) => {
  if (!team.enabled || !team.image) return null;

  return (
    <Link
      to="/products"
      search={{ time: team.id }}
      aria-label={`Ver produtos do ${team.name}`}
      title={team.name}
      data-team-link={team.id}
      className="group flex flex-shrink-0 flex-col items-center justify-center"
    >
      <div
        data-team-card={team.id}
        className="flex h-[108px] w-[108px] items-center justify-center rounded-2xl border border-gray-200 bg-gray-50/90 p-2.5 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:border-red-200 group-hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none dark:border-white/10 dark:bg-[#111111] dark:group-hover:border-red-500/35 sm:h-[112px] sm:w-[112px]"
      >
        <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#e4e4e4] p-1.5 ring-1 ring-black/5 dark:bg-[#707070] dark:ring-white/10">
          <img
            src={team.image}
            alt={`Escudo do ${team.name}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full select-none object-contain"
          />
        </div>
      </div>
    </Link>
  );
};

interface CarouselState {
  pageCount: number;
  activePage: number;
  canScrollPrevious: boolean;
  canScrollNext: boolean;
}

const INITIAL_CAROUSEL_STATE: CarouselState = {
  pageCount: 1,
  activePage: 0,
  canScrollPrevious: false,
  canScrollNext: false,
};

const BrazilianTeams: React.FC = () => {
  const { data: personalization } = useStorefrontPersonalization();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [carouselState, setCarouselState] = useState<CarouselState>(INITIAL_CAROUSEL_STATE);

  const desktopBanner = personalization?.brasileirao_banner_desktop?.url;
  const mobileBanner = personalization?.brasileirao_banner_mobile?.url;

  const updateCarouselState = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;

    const maxScroll = Math.max(0, node.scrollWidth - node.clientWidth);
    const progress = maxScroll > 1 ? node.scrollLeft / maxScroll : 0;
    const pageCount = maxScroll > 1 ? Math.max(2, Math.ceil(node.scrollWidth / node.clientWidth)) : 1;
    const activePage = Math.min(
      pageCount - 1,
      Math.max(0, Math.round(progress * (pageCount - 1))),
    );
    const epsilon = 4;

    const nextState: CarouselState = {
      pageCount,
      activePage,
      canScrollPrevious: node.scrollLeft > epsilon,
      canScrollNext: node.scrollLeft < maxScroll - epsilon,
    };

    setCarouselState((current) =>
      current.pageCount === nextState.pageCount &&
      current.activePage === nextState.activePage &&
      current.canScrollPrevious === nextState.canScrollPrevious &&
      current.canScrollNext === nextState.canScrollNext
        ? current
        : nextState,
    );
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    updateCarouselState();

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateCarouselState);
    resizeObserver?.observe(node);
    window.addEventListener("resize", updateCarouselState);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateCarouselState);
    };
  }, [updateCarouselState]);

  const scrollTeams = (direction: -1 | 1) => {
    const node = scrollRef.current;
    if (!node) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const distance = Math.max(node.clientWidth * 0.78, 300);

    node.scrollBy({
      left: direction * distance,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

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
          className="rounded-2xl border border-gray-200 bg-white/85 px-3 py-5 shadow-sm dark:border-white/10 dark:bg-[#0d0d0d] sm:px-5"
          data-team-slot-count={TOTAL_TEAM_SLOTS}
          data-enabled-team-count={teams.length}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => scrollTeams(-1)}
              disabled={!carouselState.canScrollPrevious}
              aria-label="Ver times anteriores"
              className="category-carousel-arrow absolute -left-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-md transition hover:border-red-200 hover:text-red-600 disabled:pointer-events-none disabled:opacity-0 motion-reduce:transition-none lg:flex"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <div
              ref={scrollRef}
              onScroll={updateCarouselState}
              aria-label="Times do futebol brasileiro"
              className="flex h-[118px] snap-x snap-mandatory items-center gap-3 overflow-x-auto scroll-smooth no-scrollbar motion-reduce:scroll-auto sm:h-[122px] lg:h-[126px] lg:gap-4 lg:px-10"
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
            </div>

            <button
              type="button"
              onClick={() => scrollTeams(1)}
              disabled={!carouselState.canScrollNext}
              aria-label="Ver próximos times"
              className="category-carousel-arrow absolute -right-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-md transition hover:border-red-200 hover:text-red-600 disabled:pointer-events-none disabled:opacity-0 motion-reduce:transition-none lg:flex"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>

            {carouselState.pageCount > 1 ? (
              <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
                {Array.from({ length: carouselState.pageCount }, (_, dot) => (
                  <div
                    key={dot}
                    className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                      carouselState.activePage === dot
                        ? "w-5 bg-red-600"
                        : "w-1.5 bg-gray-300 dark:bg-white/20"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <BrazilianProducts />
      </div>
    </section>
  );
};

export default BrazilianTeams;
