import { createFileRoute } from "@tanstack/react-router";
import PromoBanner from "@/components/layout/PromoBanner";
import Header from "@/components/layout/Header";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 1. ARTE PROMOCIONAL SUPERIOR - CARROSSEL CONTÍNUO (1920x100) */}
      <PromoBanner 
        id="superior" 
        style={{ aspectRatio: '1920/100' }}
        className="max-h-[100px] max-md:!aspect-[1920/300] max-md:max-h-none"
        images={[
          "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1607082349566-187342175e2f?q=80&w=2070&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1544441893-675973e30605?q=80&w=2070&auto=format&fit=crop",
        ]}
      />

      {/* 2. HEADER PRINCIPAL (Includes CategoryNav in desktop) */}
      <Header />

      {/* 3. ARTE PROMOCIONAL INFERIOR - BANNER GRANDE (1920x550) */}
      <PromoBanner 
        id="inferior" 
        style={{ aspectRatio: '1920/550' }}
        className="min-h-[200px] md:min-h-[400px] max-md:!aspect-[1920/1265] max-md:min-h-none"
      />

      {/* Espaço neutro da página */}
      <main className="flex-1">
        {/* Placeholder for future content */}
      </main>
    </div>
  );
}
