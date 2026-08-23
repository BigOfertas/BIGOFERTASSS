/**
 * PROMPT PARA LOVABLE — ETAPA 10C (REVERTIR)
 * Remover Carrossel Infinito e Barra da Seção "Diversifique seu Pedido"
 * 
 * ================================================================================
 * 
 * CONTEXTO
 * 
 * A seção "Diversifique seu Pedido" (VisualCategories) foi modificada na
 * Etapa 10 para ser um carrossel infinito com barra animada no mobile.
 * 
 * Katninja solicitou REVERTER essa mudança.
 * 
 * Voltar ao estado anterior: Carrossel comum, como qualquer outro carrossel
 * do site (sem infinito, sem barra especial).
 * 
 * ================================================================================
 * 
 * OBJETIVO
 * 
 * Remover:
 * ❌ Carrossel infinito (loop contínuo)
 * ❌ Barra horizontal animada/destacada
 * ❌ Parallax leve
 * 
 * Voltar para:
 * ✅ Carrossel comum (parado no final)
 * ✅ Scroll comportamento padrão
 * ✅ Design simples e consistente com outros carrosséis
 * 
 * Manter:
 * ✅ Cards de categorias
 * ✅ Responsividade mobile/tablet/desktop
 * ✅ Scroll horizontal
 * ✅ Funcionalidade básica
 * 
 * ================================================================================
 * 
 * MUDANÇA ESPECÍFICA: ARQUIVO VisualCategories.tsx
 * 
 * Arquivo: src/components/home/VisualCategories.tsx
 * 
 * O que REMOVER:
 * 
 * 1. ❌ Lógica de carrossel infinito (se implementada)
 *    - Remover: Detecção de fim do scroll
 *    - Remover: Loop volta ao início
 *    - Remover: Duplicação de items
 * 
 * 2. ❌ Barra horizontal animada/destacada
 *    - Remover: Elemento <div> da barra
 *    - Remover: Gradiente (#dc2626 → #f97316)
 *    - Remover: Lógica de parallax
 *    - Remover: Transições da barra (300ms)
 *    - Remover: Indicadores de posição
 * 
 * 3. ❌ Classes Tailwind específicas para infinite scroll
 *    - Remover: scroll-snap-type customizado
 *    - Remover: Animações CSS relacionadas
 * 
 * O que MANTER:
 * 
 * ✅ Grid/Flex de categorias
 * ✅ Cards com imagem + nome
 * ✅ Scroll horizontal em mobile
 * ✅ Altura e tamanho dos cards (160px)
 * ✅ Gap entre cards (12px)
 * ✅ Responsividade
 * 
 * Como deve ficar:
 * 
 * - Desktop: Grid normal de categorias (não carrossel)
 * - Tablet: Carrossel horizontal comum
 * - Mobile: Carrossel horizontal comum (scroll até o final, para)
 * 
 * Padrão de referência:
 * - Comportar-se IGUAL a BrazilianProducts
 * - Comportar-se IGUAL a qualquer outro carrossel do site
 * - Sem animações especiais
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