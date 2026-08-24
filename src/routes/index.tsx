/**
 * Contexto: BIGofertas é uma plataforma de e-commerce de loja única. Estamos criando a rota de listagem de produtos com filtros.
 * 
 * Tarefa: Criar a rota `/products` que lista produtos com filtros aplicáveis via query params.
 * 
 * Requisitos Parte 1 (Estrutura Base):
 * 
 * 1. **Rota:**
 *    - Criar rota `/products` usando TanStack Router
 *    - Suportar query params: `?campeonato=x&liga=y&time=z`
 *    - Ler query params da URL usando `useSearch()` do TanStack Router
 * 
 * 2. **Layout:**
 *    - Usar `__root.tsx` como base (Header + Footer)
 *    - Layout em 2 colunas:
 *      - **Esquerda (sidebar):** filtros (será detalhado em próximo prompt)
 *      - **Direita:** grid de produtos
 * 
 * 3. **Busca de Dados:**
 *    - Buscar todos os produtos da tabela `products` no Supabase
 *    - Estrutura esperada: `{ id, name, price, image_url, category, campeonato, liga, time, stock, ... }`
 *    - Se houver query params, **filtrar localmente em JavaScript** (não fazer query no Supabase com WHERE dinâmico por agora)
 *    - Lógica de filtro: 
 *      - Se `?campeonato=brasileirao`, mostrar só produtos onde `campeonato === 'brasileirao'`
 *      - Se `?campeonato=brasileirao&liga=serie-a`, filtrar ambos
 *      - Se `?campeonato=brasileirao&liga=serie-a&time=flamengo`, filtrar os três
 *      - Se nenhum filtro, mostrar todos
 * 
 * 4. **Grid de Produtos:**
 *    - Mostrar produtos em grid responsivo (4 colunas desktop, 2 tablet, 1 mobile)
 *    - Cada card:
 *      - Imagem do produto
 *      - Nome
 *      - Preço (em BRL)
 *      - Link clicável que leva pra `/product/:id`
 *    - Se lista vazia, mostrar "Nenhum produto encontrado"
 * 
 * 5. **Tratamento de Erros:**
 *    - Se erro ao carregar produtos, mostrar mensagem de erro
 * 
 * Não modifique arquivos protegidos.
 * Crie: `src/routes/products.tsx` e componentes auxiliares conforme necessário.
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
import bannerSuperiorAsset from "@/assets/promos/banner-promo-superior.png.asset.json";

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

    </div>
  );
}
