import { createFileRoute } from "@tanstack/react-router";
import PromoBanner from "@/components/layout/PromoBanner";
import Header from "@/components/layout/Header";
import BestSellers from "@/components/home/BestSellers";
import VisualCategories from "@/components/home/VisualCategories";
import BrazilianProducts from "@/components/home/BrazilianProducts";
import BrazilianTeams from "@/components/home/BrazilianTeams";
import ShopByLeague from "@/components/home/ShopByLeague";
import FAQ from "@/components/home/FAQ";

import bannerInferiorAsset from "@/assets/promos/banner-promo-inferior.png.asset.json";
import bannerSuperiorAsset from "@/assets/promos/banner-promo-superior.png.asset.json";

/**
 * PROMPT PARA LOVABLE — ETAPA BÔNUS 2
 * Adicionar PNG no Slot Superior do PromoBanner (1774x300)
 * 
 * ================================================================================
 * 
 * CONTEXTO
 * 
 * Você vai receber 1 imagem PNG com resolução específica 1774x300px que deve ser
 * colocada em um "slot superior" (espaço vazio) na moldura do PromoBanner.
 * 
 * Dimensões da imagem:
 * - Largura: 1774px
 * - Altura: 300px
 * - Proporção: 5.9:1 (muito larga, pouco alta)
 * - Formato: PNG
 * 
 * Objetivo: Integrar esta imagem no slot superior respeitando sua proporção
 * e garantindo que apareça corretamente em todos os breakpoints (mobile/tablet/desktop)
 * 
 * ================================================================================
 * 
 * OBJETIVO
 * 
 * 1. Integrar 1 imagem PNG (1774x300) no slot superior do PromoBanner
 * 2. A imagem deve FIT dentro da moldura existente (não sair dos limites)
 * 3. Respeitar a proporção 1774x300 (não distorcer)
 * 4. Responsividade: Mobile/Tablet/Desktop OK
 * 5. Manter estilo e layout existentes
 * 6. Imagem deve ser visível e legível em todos os breakpoints
 * 
 * ================================================================================
 * 
 * MUDANÇA ESPECÍFICA: ARQUIVO PromoBanner.tsx
 * 
 * Arquivo: src/components/layout/PromoBanner.tsx
 * 
 * Contexto:
 * - PromoBanner já existe com moldura
 * - Há um slot superior vazio (acima ou antes do slot inferior)
 * - Precisa integrar PNG (1774x300) neste espaço
 * - Manter proporção original
 * 
 * Integração:
 * 
 * Container do slot superior (moldura existente):
 * - Deve acomodar imagem 1774x300
 * - Aspect ratio: 5.9:1
 * 
 * Imagem:
 * - src: [IMAGEM ANEXADA]
 * - alt: "Promoção" ou "Banner Superior"
 * - width: 1774
 * - height: 300
 * - Ou usar CSS: aspect-ratio: 1774 / 300
 * 
 * Renderização esperada:
 * 
 * <div className="slot-superior-container">
 *   {/* Moldura para 1774x300 */}
 *   <img
 *     src="[IMAGEM ANEXADA]"
 *     alt="Banner Superior"
 *     className="w-full h-auto object-cover"
 *     style={{
 *       aspectRatio: '1774 / 300'
 *     }}
 *   />
 * </div>
 * 
 * Ou com Tailwind (se suportar aspect-ratio):
 * 
 * <img
 *   src="[IMAGEM ANEXADA]"
 *   alt="Banner Superior"
 *   className="w-full h-auto object-cover aspect-[1774/300]"
 * />
 * 
 * ================================================================================
 * 
 * ESPECIFICAÇÕES TÉCNICAS
 * 
 * Imagem PNG:
 * - Resolução: 1774px × 300px
 * - Formato: PNG
 * - Proporção: 1774:300 (5.9:1)
 * - Localização: Slot superior do PromoBanner
 * - Não distorcer
 */
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
          bannerSuperiorAsset.url, // Slot 1
          bannerSuperiorAsset.url, // Slot 2
          bannerSuperiorAsset.url, // Slot 3
        ]}
      />

      {/* 2. HEADER PRINCIPAL (Includes CategoryNav in desktop) */}
      <Header />

      {/* 3. ARTE PROMOCIONAL INFERIOR - BANNER GRANDE (1920x550) */}
      <PromoBanner 
        id="inferior" 
        style={{ aspectRatio: '1920/550' }}
        className="max-h-[550px] max-md:!aspect-[1920/1897] max-md:max-h-none"
        images={[
          bannerInferiorAsset.url, // Slot 1
        ]}
      />

      <main className="flex-grow overflow-x-hidden">
        {/* Mais Vendidos / Lançamentos */}
        <BestSellers />

        {/* Diversifique seu Pedido (Categorias Visuais) */}
        <VisualCategories />

        {/* BANNER CLICÁVEL BRASILEIRÃO */}
        <PromoBanner 
          id="brasileirao" 
          style={{ aspectRatio: '1920/300' }}
          className="max-h-[300px] max-md:!aspect-[1920/750] max-md:max-h-none"
          href="/brasileirao"
          images={[
            "", // PNG Slot: Brasileirão
          ]}
        />

        {/* TIMES BRASILEIROS */}
        <BrazilianTeams />

        {/* PRODUTOS DO BRASILEIRÃO */}
        <BrazilianProducts />

        {/* COMPRE POR LIGA */}
        <ShopByLeague />

        {/* FAQ */}
        <FAQ />
      </main>

      {/* Footer Placeholder */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400">© 2026 BIGofertas. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
