/**
 * PROMPT PARA LOVABLE — ETAPA BÔNUS
 * Adicionar PNG no Slot Inferior (PromoBanner) — Mobile com Scroll Horizontal
 * 
 * ================================================================================
 * 
 * CONTEXTO
 * 
 * Você vai receber 1 imagem PNG que deve ser colocada em um "slot" (espaço vazio)
 * que já existe na moldura do PromoBanner (faixa promocional).
 * 
 * Comportamento diferente por plataforma:
 * - MOBILE (< 768px): Imagem aparece DESLOCADA à esquerda (como se deslizasse)
 *   → Mostra APENAS a parte esquerda da imagem (resto fica fora da moldura)
 * - PC (≥ 768px): Imagem aparece INTEIRA dentro da moldura
 * 
 * Objetivo: Usar a mesma imagem, mas com posicionamento diferente em cada breakpoint
 * 
 * ================================================================================
 * 
 * OBJETIVO
 * 
 * 1. Integrar 1 imagem PNG no slot inferior do PromoBanner
 * 2. A imagem deve FIT dentro da moldura existente (não sair dos limites)
 * 3. Mobile: Mostrar apenas a PARTE ESQUERDA (como scrollado para direita)
 * 4. PC: Mostrar a imagem INTEIRA
 * 5. Manter estilo e responsividade existentes
 * 
 * ================================================================================
 * 
 * MUDANÇA ESPECÍFICA: ARQUIVO PromoBanner.tsx
 * 
 * Arquivo: src/components/layout/PromoBanner.tsx
 * 
 * Contexto:
 * - PromoBanner já existe com 1 slot para imagem (moldura vazia)
 * - Precisa integrar PNG neste slot
 * - Comportamento diferente mobile/desktop
 * 
 * Integração:
 * 
 * MOBILE (< 768px):
 * - Imagem posicionada à ESQUERDA
 * - Deslocamento: Como se o usuário deslizasse a imagem com mouse para DIREITA
 * - Resultado: Mostra apenas a PARTE ESQUERDA da imagem
 * - Resto da imagem fica FORA da moldura (oculto)
 * - CSS: object-position: left center (ou ajustado)
 * - overflow: hidden (para não sair da moldura)
 * 
 * PC (≥ 768px):
 * - Imagem posicionada no CENTRO
 * - Mostra a imagem INTEIRA dentro da moldura
 * - CSS: object-position: center center
 * - overflow: hidden (para respeitar limites da moldura)
 * 
 * Implementação com object-fit e object-position:
 * 
 * <img
 *   src="[IMAGEM ANEXADA]"
 *   alt="Promoção"
 *   className={`w-full h-full object-cover
 *     md:object-position-center
 *     object-position-left
 *   `}
 * />
 * 
 * Ou com Tailwind (se suporte custom):
 * 
 * Mobile: object-left (ou com style inline)
 * Desktop: object-center
 * 
 * ================================================================================
 * 
 * ESPECIFICAÇÕES TÉCNICAS
 * 
 * Imagem:
 * - Formato: PNG
 * - Localização: Slot inferior do PromoBanner (moldura existente)
 * - Tamanho container: [verificar em PromoBanner.tsx]
 * - Deve preencher o espaço (object-cover)
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

import bannerInferiorAsset from "@/assets/promos/banner-promo-inferior.png.asset.json";

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
