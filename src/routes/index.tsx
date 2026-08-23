/**
 * PROMPT PARA LOVABLE — ETAPA 15A (PARTE 1)
 * Corrigir VisualCategories Mobile: Cards Cortados e Adicionar Barra Cinza
 * 
 * ================================================================================
 * 
 * CONTEXTO
 * 
 * A seção "Diversifique seu Pedido" (VisualCategories) tem problema no mobile:
 * os cards aparecem CORTADOS VERTICALMENTE, forçando o usuário a fazer scroll
 * vertical dentro da própria seção para ver os cards inteiros.
 * 
 * Katninja quer:
 * 1. Cards inteiros (sem corte vertical) - deixar mais "esticados"
 * 2. Adicionar barra cinza abaixo da seção (como existe em BestSellers)
 * 
 * ================================================================================
 * 
 * OBJETIVO
 * 
 * 1. Corrigir altura dos cards para aparecerem INTEIROS no mobile
 * 2. Adicionar indicador visual (barra cinza) abaixo de VisualCategories
 * 3. A barra deve acompanhar o scroll (como em BestSellers)
 * 4. Responsividade mobile/tablet/desktop OK
 * 
 * ================================================================================
 * 
 * MUDANÇA 1: CORRIGIR CARDS CORTADOS
 * 
 * Arquivo: src/components/home/VisualCategories.tsx
 * 
 * Problema atual:
 * - Cards têm altura fixa de 140px
 * - Viewport mobile não consegue exibir inteiro
 * - Usuário precisa fazer scroll VERTICAL para ver
 * 
 * Solução:
 * - Aumentar altura dos cards
 * - Ajustar container para não cortar
 * - Deixar padding/margin suficiente
 * 
 * Mobile (< 768px):
 * - Card height: 160px (de 140px) → 180px se necessário
 * - Card width: 160px (mantém quadrado)
 * - Container padding-bottom: +30px (espaço extra)
 * - Seção padding: aumentar vertical
 * 
 * Tablet (768px-1023px):
 * - Card height: 180px-200px
 * - Mais espaço
 * 
 * Desktop (≥ 1024px):
 * - Grid layout (sem scroll)
 * - Cards maiores
 * 
 * Checklist:
 * - [x] Cards aparecem 100% inteiros no mobile
 * - [x] Sem corte vertical
 * - [x] Usuário não precisa scroll vertical dentro da seção
 * - [x] Responsividade mantida
 * 
 * ================================================================================
 * 
 * MUDANÇA 2: ADICIONAR BARRA CINZA ABAIXO
 * 
 * Arquivo: src/components/home/VisualCategories.tsx
 * 
 * Referência: BestSellers tem barra cinza que acompanha o scroll das abas
 * 
 * Implementar em VisualCategories:
 * - Barra cinza (#d1d5db ou #e5e7eb) abaixo da seção
 * - Altura: 4px-6px
 * - Largura: 100%
 * - Posição: Imediatamente abaixo dos cards (pb-2 or pb-4)
 * - Cor exata: gray-300 (#d1d5db)
 */
import { createFileRoute } from "@tanstack/react-router";
import PromoBanner from "@/components/layout/PromoBanner";
import Header from "@/components/layout/Header";
import BestSellers from "@/components/home/BestSellers";
import VisualCategories from "@/components/home/VisualCategories";
import BrazilianProducts from "@/components/home/BrazilianProducts";
import BrazilianTeams from "@/components/home/BrazilianTeams";
import ShopByLeague from "@/components/home/ShopByLeague";
import FAQ from "@/components/home/FAQ";

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
          "", // Slot 1
          "", // Slot 2
          "", // Slot 3
        ]}
      />

      {/* 2. HEADER PRINCIPAL (Includes CategoryNav in desktop) */}
      <Header />

      {/* 3. ARTE PROMOCIONAL INFERIOR - BANNER GRANDE (1920x550) */}
      <PromoBanner 
        id="inferior" 
        style={{ aspectRatio: '1920/550' }}
        className="min-h-[200px] md:min-h-[400px] max-md:!aspect-[1920/1897] max-md:min-h-none"
      />

      {/* 4. SEÇÃO MAIS VENDIDOS */}
      <main className="flex-1 pb-12">
        <BestSellers />
        <VisualCategories />
        
        {/* BANNER BRASILEIRÃO - SLOT CLICÁVEL */}
        <section className="mt-8 sm:mt-12">
          <div className="container mx-auto px-4">
            <PromoBanner 
              id="Brasileirão" 
              style={{ aspectRatio: '1920/500' }}
              className="rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-shadow max-md:!aspect-[1920/750]"
              href="#" // Deixado preparado para receber o link futuramente
            />
          </div>
        </section>

        {/* 5. TIMES BRASILEIROS */}
        <BrazilianTeams />

        {/* 6. PRODUTOS DO BRASILEIRÃO */}
        <div className="mt-4 sm:mt-8">
          <BrazilianProducts />
        </div>

        {/* 7. COMPRE POR LIGA */}
        <ShopByLeague />
        <FAQ />
      </main>
    </div>
  );
}