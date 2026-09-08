import type { ReactNode } from "react";

import Header from "@/components/layout/Header";

export function InstitutionalPage({
  eyebrow = "Informações da loja",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="border-b border-gray-200 pb-7">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-red-600">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-gray-950 sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base">{description}</p>
        </header>
        <div className="prose-store mt-8 space-y-8 text-sm leading-7 text-gray-600">{children}</div>
      </main>
    </div>
  );
}

export function InstitutionalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-black tracking-[-0.02em] text-gray-950">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
