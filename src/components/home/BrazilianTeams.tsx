import React from "react";

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
      <div className="w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center bg-gray-50 rounded-full overflow-hidden p-2 group-hover:opacity-90 transition-opacity">
        {team.logoUrl ? (
          <img
            src={team.logoUrl}
            alt={team.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 rounded-full border-2 border-dashed border-gray-300">
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
  { id: "flamengo", name: "Flamengo", slug: "flamengo", href: "/times/flamengo" },
  { id: "atletico-mg", name: "Atlético-MG", slug: "atletico-mg", href: "/times/atletico-mg" },
  { id: "cruzeiro", name: "Cruzeiro", slug: "cruzeiro", href: "/times/cruzeiro" },
  { id: "sao-paulo", name: "São Paulo", slug: "sao-paulo", href: "/times/sao-paulo" },
  { id: "corinthians", name: "Corinthians", slug: "corinthians", href: "/times/corinthians" },
  { id: "palmeiras", name: "Palmeiras", slug: "palmeiras", href: "/times/palmeiras" },
  { id: "santos", name: "Santos", slug: "santos", href: "/times/santos" },
  { id: "botafogo", name: "Botafogo", slug: "botafogo", href: "/times/botafogo" },
  { id: "fluminense", name: "Fluminense", slug: "fluminense", href: "/times/fluminense" },
  { id: "gremio", name: "Grêmio", slug: "gremio", href: "/times/gremio" },
  { id: "internacional", name: "Internacional", slug: "internacional", href: "/times/internacional" },
];

const BrazilianTeams: React.FC = () => {
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

        {/* Desktop: Centered distribution / Mobile: Horizontal swipe */}
        <div className="relative group/scroll">
          <div className="flex overflow-x-auto pb-6 no-scrollbar custom-scrollbar-mobile gap-6 sm:gap-8 md:gap-10 scroll-smooth snap-x md:justify-center items-center">
            {teams.map((team) => (
              <div key={team.id} className="snap-center">
                <TeamLogo team={team} />
              </div>
            ))}
          </div>
          
          {/* Mobile Discrete Progress Bar Indicator (managed by CSS scrollbar) */}
          <div className="md:hidden mt-2 h-[2px] w-24 mx-auto bg-gray-100 rounded-full overflow-hidden">
             {/* This is a visual anchor, the actual progress is handled by the custom-scrollbar utility in styles.css applied to the container */}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BrazilianTeams;
