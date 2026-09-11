import { Link } from "@tanstack/react-router";
import { ArrowLeft, BadgePercent, Package, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { useStorefrontPersonalization } from "@/hooks/useStorefrontPersonalization";
import "@/auth.css";

type AuthSplitShellProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  mode: "signin" | "signup";
  footer?: ReactNode;
};

const AUTH_SLIDES = [
  {
    slot: "category_fifa",
    kicker: "Mundo FIFA",
    title: "Vista o seu time. Carregue a sua história.",
    description: "Uma seleção visual feita para quem vive futebol dentro e fora de campo.",
  },
  {
    slot: "category_retro",
    kicker: "Camisas retrô",
    title: "Clássicos que ainda entram em campo.",
    description: "Memória, identidade e peças que continuam fortes em qualquer geração.",
  },
  {
    slot: "category_training",
    kicker: "Kits de treino",
    title: "Performance com presença.",
    description: "Visual esportivo, direto e preparado para acompanhar sua rotina.",
  },
  {
    slot: "category_windbreaker",
    kicker: "Corta-vento",
    title: "O futebol também se veste fora do estádio.",
    description: "Peças marcantes para levar a identidade do clube para qualquer lugar.",
  },
] as const;

const fallbackHighlights = [
  { icon: Package, label: "Pedidos em um só lugar" },
  { icon: BadgePercent, label: "Área de afiliados" },
  { icon: ShieldCheck, label: "Acesso protegido" },
] as const;

export function AuthSplitShell({
  eyebrow,
  title,
  description,
  children,
  mode,
  footer,
}: AuthSplitShellProps) {
  const { data: personalization } = useStorefrontPersonalization();
  const [activeSlide, setActiveSlide] = useState(0);

  const slides = useMemo(
    () =>
      AUTH_SLIDES.map((slide) => ({
        ...slide,
        image: personalization?.[slide.slot]?.url ?? null,
      })).filter((slide) => Boolean(slide.image)),
    [personalization],
  );

  useEffect(() => {
    if (activeSlide < slides.length) return;
    setActiveSlide(0);
  }, [activeSlide, slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || typeof window === "undefined") return;
    const next = slides[(activeSlide + 1) % slides.length];
    if (!next?.image) return;

    const image = new Image();
    image.decoding = "async";
    image.src = next.image;
  }, [activeSlide, slides]);

  const currentSlide = slides[activeSlide] ?? null;
  const sideTitle = mode === "signup" ? "Entre para o jogo." : "Bem-vindo de volta.";

  return (
    <main className="auth-split-page min-h-[100dvh] w-full text-gray-950 lg:grid lg:grid-cols-[minmax(420px,0.86fr)_minmax(0,1.14fr)]">
      <section className="auth-form-column flex min-h-[100dvh] items-start justify-center px-4 py-4 sm:px-8 sm:py-6 lg:items-center lg:px-12 lg:py-10">
        <div className="auth-enter w-full max-w-[460px]">
          <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
            <Link
              to="/"
              className="auth-brand-link flex h-12 w-[138px] items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white px-3 shadow-sm sm:h-[52px] sm:w-[150px]"
              aria-label="DropBox - Início"
            >
              <BrandWordmark className="max-h-10" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 transition hover:text-red-600 sm:text-[11px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Voltar à loja
            </Link>
          </div>

          <div className="auth-mobile-showcase relative mb-5 h-[132px] overflow-hidden rounded-[1.25rem] bg-neutral-950 text-white shadow-sm lg:hidden sm:h-[150px]">
            {currentSlide?.image ? (
              <>
                <img
                  key={`mobile-${activeSlide}-${currentSlide.image}`}
                  src={currentSlide.image}
                  alt=""
                  width={920}
                  height={360}
                  decoding="async"
                  className="auth-mobile-showcase-image absolute inset-0 h-full w-full object-cover"
                />
                <div
                  className="auth-mobile-showcase-vignette absolute inset-0"
                  aria-hidden="true"
                />
                <div className="relative z-10 flex h-full flex-col justify-end p-4 sm:p-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-200">
                    {currentSlide.kicker}
                  </p>
                  <p className="sport-heading mt-1 max-w-[18ch] text-[1.6rem] leading-[0.9] text-white sm:text-[1.85rem]">
                    {currentSlide.title}
                  </p>
                </div>
              </>
            ) : (
              <div className="auth-mobile-showcase-fallback flex h-full items-end p-4 sm:p-5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-200">
                    Conta DropBox
                  </p>
                  <p className="sport-heading mt-1 text-[1.8rem] leading-none text-white">
                    {sideTitle}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mb-5 sm:mb-6 lg:mb-7">
            <p className="display-kicker">{eyebrow}</p>
            <h1 className="sport-heading mt-2 text-[2.55rem] leading-[0.9] text-gray-950 sm:text-[3.35rem] lg:text-[3.45rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-gray-500 sm:text-[15px]">
              {description}
            </p>
          </div>

          {children}
          {footer ? <div className="mt-5 text-center">{footer}</div> : null}
        </div>
      </section>

      <aside className="auth-side-panel relative hidden min-h-[100dvh] overflow-hidden p-3 lg:block xl:p-4">
        <div className="auth-showcase relative h-full min-h-[calc(100dvh-24px)] overflow-hidden rounded-[2rem] bg-neutral-950 text-white xl:min-h-[calc(100dvh-32px)]">
          {currentSlide?.image ? (
            <>
              <img
                key={`${activeSlide}-${currentSlide.image}`}
                src={currentSlide.image}
                alt=""
                width={800}
                height={1200}
                decoding="async"
                className="auth-showcase-image absolute inset-0 h-full w-full object-cover"
              />
              <div className="auth-showcase-vignette absolute inset-0" aria-hidden="true" />

              <div className="relative z-10 flex h-full min-h-[calc(100dvh-24px)] flex-col p-8 xl:min-h-[calc(100dvh-32px)] xl:p-11">
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
                    Conta DropBox
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">
                    {String(activeSlide + 1).padStart(2, "0")} /{" "}
                    {String(slides.length).padStart(2, "0")}
                  </span>
                </div>

                <div className="mt-auto max-w-2xl pb-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">
                    {currentSlide.kicker}
                  </p>
                  <h2 className="sport-heading mt-3 max-w-[12ch] text-5xl text-white xl:text-6xl 2xl:text-7xl">
                    {currentSlide.title}
                  </h2>
                  <p className="mt-5 max-w-lg text-sm leading-6 text-white/72 xl:text-[15px] xl:leading-7">
                    {currentSlide.description}
                  </p>

                  {slides.length > 1 ? (
                    <div
                      className="mt-7 flex items-center gap-2"
                      aria-label="Imagens da área de acesso"
                    >
                      {slides.map((slide, index) => (
                        <button
                          key={slide.slot}
                          type="button"
                          onClick={() => setActiveSlide(index)}
                          aria-label={`Mostrar imagem ${index + 1}`}
                          aria-current={index === activeSlide ? "true" : undefined}
                          className={`auth-showcase-dot ${index === activeSlide ? "is-active" : ""}`}
                        />
                      ))}
                    </div>
                  ) : null}

                  <div key={`progress-${activeSlide}`} className="auth-showcase-progress mt-4">
                    <span />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="auth-showcase-fallback flex h-full min-h-[calc(100dvh-24px)] flex-col p-8 xl:min-h-[calc(100dvh-32px)] xl:p-11">
              <span className="w-fit rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                Conta DropBox
              </span>
              <div className="my-auto max-w-xl py-10">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">
                  Área do cliente
                </p>
                <h2 className="sport-heading mt-4 max-w-[10ch] text-6xl text-white xl:text-7xl">
                  {sideTitle}
                </h2>
                <p className="mt-5 max-w-lg text-[15px] leading-7 text-white/62">
                  Acompanhe pedidos, mantenha seus dados organizados e acesse os recursos da sua
                  conta.
                </p>
                <div className="mt-8 flex flex-wrap gap-2.5">
                  {fallbackHighlights.map(({ icon: Icon, label }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-white/75"
                    >
                      <Icon className="h-4 w-4 text-red-300" aria-hidden="true" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}
