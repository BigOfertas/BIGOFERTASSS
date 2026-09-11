import { Link } from "@tanstack/react-router";
import { BadgePercent, Package, ShieldCheck } from "lucide-react";
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
      <section className="auth-form-column flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="auth-enter w-full max-w-[460px]">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link
              to="/"
              className="brand-lockup h-11 w-40 px-3 text-lg sm:h-12 sm:w-44"
              aria-label="DropBox - Início"
            >
              <BrandWordmark />
            </Link>
            <Link
              to="/"
              className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400 transition hover:text-red-600"
            >
              Voltar à loja
            </Link>
          </div>

          <div className="mb-7">
            <p className="display-kicker">{eyebrow}</p>
            <h1 className="sport-heading mt-2 text-[2.7rem] text-gray-950 sm:text-[3.45rem]">
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
