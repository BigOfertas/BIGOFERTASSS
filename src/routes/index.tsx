import { createFileRoute } from "@tanstack/react-router";
import PromoBanner from "@/components/layout/PromoBanner";
import Header from "@/components/layout/Header";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 1. ARTE PROMOCIONAL SUPERIOR - FAIXA FINA (1920x300) */}
      <PromoBanner 
        id="superior" 
        style={{ aspectRatio: '1920/300' }}
        className="max-h-[300px]"
      />

      {/* 2. HEADER PRINCIPAL (Includes CategoryNav in desktop) */}
      <Header />

      {/* 3. ARTE PROMOCIONAL INFERIOR - BANNER GRANDE (1920x1265) */}
      <PromoBanner 
        id="inferior" 
        style={{ aspectRatio: '1920/1265' }}
        className="min-h-[460px] md:min-h-[920px]"
      />

      {/* Espaço neutro da página */}
      <main className="flex-1">
        {/* Placeholder for future content */}
      </main>
    </div>
  );
}
