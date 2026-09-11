import { Link } from "@tanstack/react-router";
import { BadgePercent, MapPin, Package, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { BrandWordmark } from "@/components/brand/BrandWordmark";
import "@/auth.css";

type AuthSplitShellProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  mode: "signin" | "signup";
  footer?: ReactNode;
};

const benefits = [
  {
    icon: Package,
    title: "Acompanhe seus pedidos",
    description: "Consulte o andamento das suas compras em um só lugar.",
  },
  {
    icon: MapPin,
    title: "Endereços organizados",
    description: "Salve e gerencie os endereços usados nas suas entregas.",
  },
  {
    icon: BadgePercent,
    title: "Área de afiliados",
    description: "Acesse indicações, comissões e recursos do programa quando disponíveis na sua conta.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança da conta",
    description: "Proteções de acesso e verificação ficam reunidas na sua área do cliente.",
  },
] as const;

export function AuthSplitShell({
  eyebrow,
  title,
  description,
  children,
  mode,
  footer,
}: AuthSplitShellProps) {
  const sideTitle = mode === "signup" ? "Sua conta começa aqui." : "Bem-vindo de volta.";
  const sideDescription =
    mode === "signup"
      ? "Crie seu acesso para acompanhar compras e manter seus dados organizados na DropBox."
      : "Entre com o e-mail e a senha cadastrados para acessar sua área do cliente.";

  return (
    <main className="auth-split-page min-h-[100dvh] w-full bg-white text-gray-950 lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)]">
      <section className="flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="auth-enter w-full max-w-[470px]">
          <div className="mb-7 flex items-center justify-between gap-4">
            <Link
              to="/"
              className="brand-lockup h-11 w-40 px-3 text-lg sm:h-12 sm:w-44"
              aria-label="DropBox - Início"
            >
              <BrandWordmark />
            </Link>
            <Link
              to="/"
              className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 transition hover:text-red-600"
            >
              Voltar à loja
            </Link>
          </div>

          <div className="mb-7">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-600">{eyebrow}</p>
            <h1 className="mt-2 text-[2.15rem] font-black leading-[1.02] tracking-[-0.045em] text-gray-950 sm:text-[2.65rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-gray-500 sm:text-[15px]">{description}</p>
          </div>

          {children}
          {footer ? <div className="mt-5 text-center">{footer}</div> : null}
        </div>
      </section>

      <aside className="auth-side-panel relative hidden min-h-[100dvh] overflow-hidden p-5 lg:block">
        <div className="auth-side-surface relative flex h-full min-h-[calc(100dvh-40px)] flex-col overflow-hidden rounded-[2rem] border border-red-950/10 p-8 text-white xl:p-11">
          <div className="auth-orb auth-orb-one" aria-hidden="true" />
          <div className="auth-orb auth-orb-two" aria-hidden="true" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.17em] text-white/80 backdrop-blur-md">
              Área do cliente
            </span>
            <span className="text-xs font-semibold text-white/50">DropBox</span>
          </div>

          <div className="relative z-10 my-auto max-w-xl py-10">
            <p className="text-sm font-bold uppercase tracking-[0.13em] text-red-300">Conta DropBox</p>
            <h2 className="mt-4 max-w-lg text-5xl font-black leading-[0.97] tracking-[-0.055em] xl:text-6xl">
              {sideTitle}
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-white/65">{sideDescription}</p>

            <div className="mt-9 grid grid-cols-2 gap-3">
              {benefits.map(({ icon: Icon, title: benefitTitle, description: benefitDescription }) => (
                <div
                  key={benefitTitle}
                  className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-300">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-extrabold tracking-[-0.02em]">{benefitTitle}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-white/50">{benefitDescription}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 border-t border-white/10 pt-5 text-xs leading-5 text-white/45">
            Use apenas os dados cadastrados diretamente na DropBox. Não utilizamos login por Google ou outras redes sociais.
          </div>
        </div>
      </aside>
    </main>
  );
}
