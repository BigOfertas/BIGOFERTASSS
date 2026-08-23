/**
 * # PROMPT CORRETIVO — TAMANHO DOS CARDS DE CATEGORIA EM 115%
 * 
 * Considere o **estado ATUAL do projeto BIGofertas** como fonte de verdade.
 * 
 * Faça SOMENTE o ajuste de escala dos cards da seção de categorias / **“Diversifique seu pedido”**.
 * 
 * ## REGRA PRINCIPAL
 * 
 * Os cards das categorias devem ter exatamente:
 * 
 * **115% do tamanho visual dos cards normais de produto usados em “MAIS VENDIDOS” e “LANÇAMENTOS”.**
 * 
 * Ou seja:
 * 
 * **Card de produto normal = 100%**
 * **Card de categoria = 115%**
 * 
 * Use os próprios cards atuais de **Mais Vendidos/Lançamentos** como referência real de tamanho.
 * 
 * Não utilize valores arbitrários de prompts antigos.
 * 
 * ---
 * 
 * ## IMPORTANTE
 * 
 * O aumento de 15% deve ser proporcional.
 * 
 * Considere principalmente:
 * 
 * * largura do card;
 * * altura proporcional;
 * * área visual ocupada;
 * * espaçamento necessário entre cards.
 * 
 * Não aumentar somente a imagem interna deixando o container igual.
 * 
 * O **card inteiro de categoria** deve aparentar aproximadamente 15% maior que um card de produto comum.
 * 
 * ---
 * 
 * ## PROPORÇÃO DA ARTE
 * 
 * As futuras artes das categorias terão proporção vertical:
 * 
 * **2:3**
 * 
 * Referência de arquivo:
 * 
 * `1000 × 1500 px`
 * 
 * O componente deve preservar essa proporção.
 * 
 * Não deformar.
 * 
 * Não esticar.
 * 
 * Não cortar desnecessariamente.
 * 
 * ---
 * 
 * ## MOBILE
 * 
 * No mobile:
 * 
 * * usar como referência o tamanho MOBILE atual dos cards de Mais Vendidos/Lançamentos;
 * * aplicar aproximadamente **115% dessa largura** aos cards de categoria;
 * * preservar proporção 2:3;
 * * manter carrossel horizontal;
 * * permitir swipe;
 * * mostrar parte do próximo card quando possível;
 * * não criar scrollbar horizontal visível;
 * * não criar overflow na página inteira.
 * 
 * Exemplo conceitual:
 * 
 * Se um card normal tiver:
 * 
 * `100px`
 * 
 * o card de categoria deverá ter:
 * 
 * `115px`
 * 
 * Se tiver:
 * 
 * `140px`
 * 
 * o card de categoria deverá ter:
 * 
 * `161px`
 * 
 * A lógica deve ser proporcional ao layout atual.
 * 
 * ---
 * 
 * ## DESKTOP
 * 
 * No desktop, aplicar a mesma relação visual:
 * 
 * **card de categoria = 115% do card normal de produto.**
 * 
 * Não transformar os cards em banners gigantes.
 * 
 * Eles devem permanecer compactos, verticais e organizados.
 * 
 * Caso os 6 cards não caibam corretamente na largura disponível após o aumento, preserve:
 * 
 * * proporção;
 * * espaçamento;
 * * alinhamento;
 * 
 * e permita uma distribuição/carrossel adequada.
 * 
 * Não comprimir artificialmente os cards apenas para forçar todos na mesma linha.
 * 
 * ---
 * 
 * ## CONTEÚDO TEMPORÁRIO
 * 
 * Neste momento, manter apenas os textos/placeholders existentes nas categorias.
 * 
 * NÃO gerar imagens.
 * 
 * NÃO criar artes temporárias.
 * 
 * Futuramente cada card receberá uma **arte PNG/WebP completa e clicável**.
 * 
 * As categorias continuam sendo:
 * 
 * * Camisas de Times
 * * Conjuntos Infantis / Kids
 * * Shorts
 * * Conjuntos / Kit de Treino
 * * Basquete
 * * Corta-Ventos
 * 
 * ---
 * 
 * ## NÃO ALTERAR OS CARDS DE PRODUTO
 * 
 * Muito importante:
 * 
 * **NÃO aumente nem reduza os cards de Mais Vendidos/Lançamentos.**
 * 
 * Eles são apenas a REFERÊNCIA de tamanho.
 * 
 * Somente os cards de categoria devem mudar.
 * 
 * ---
 * 
 * ## NÃO ALTERAR
 * 
 * Não modificar:
 * 
 * * Mais Vendidos;
 * * Lançamentos;
 * * produtos;
 * * bolinhas de navegação;
 * * PNG Slot Superior;
 * * PNG Slot Inferior;
 * * Header;
 * * busca;
 * * menu;
 * * banners;
 * * Supabase;
 * * Auth;
 * * RLS;
 * * migrations;
 * * TanStack Router;
 * * `.lovable`;
 * * demais seções da Home.
 * 
 * Não realizar refatorações extras.
 * 
 * ---
 * 
 * ## VALIDAÇÃO FINAL
 * 
 * Confirme visualmente:
 * 
 * 1. Card de produto normal continua em **100%**.
 * 2. Card de categoria está aproximadamente em **115%**.
 * 3. A diferença é perceptível, mas discreta.
 * 4. Cards de categoria não ficaram exageradamente grandes.
 * 5. Proporção vertical 2:3 foi preservada.
 * 6. Mobile continua com carrossel horizontal funcional.
 * 7. Desktop permanece organizado.
 * 8. Não existe scrollbar horizontal visível.
 * 9. Não existe overflow horizontal da página.
 * 10. Mais Vendidos/Lançamentos permanecem totalmente intactos.
 * 
 * **Faça exclusivamente essa alteração de escala dos cards de categoria.**
 */
import { createFileRoute } from "@tanstack/react-router";
import PromoBanner from "@/components/layout/PromoBanner";
import Header from "@/components/layout/Header";
import BestSellers from "@/components/home/BestSellers";
import VisualCategories from "@/components/home/VisualCategories";

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
      <main className="flex-1">
        <BestSellers />
        <VisualCategories />
      </main>
    </div>
  );
}
