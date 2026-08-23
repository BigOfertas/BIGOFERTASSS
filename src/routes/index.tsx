/**
 * # ETAPA 9 — Criar seção “COMPRE POR LIGA” na Home
 * 
 * Considere o **estado ATUAL do projeto BIGofertas** como fonte de verdade.
 * 
 * Faça SOMENTE a criação da seção:
 * 
 * **COMPRE POR LIGA**
 * 
 * Ela deverá ficar imediatamente abaixo da seção:
 * 
 * **PRODUTOS DO BRASILEIRÃO**
 * 
 * Não avance ainda para FAQ, rodapé ou banners promocionais posteriores.
 * 
 * ---
 * 
 * # 1. ESTRUTURA DA SEÇÃO
 * 
 * Criar o título centralizado:
 * 
 * ## **COMPRE POR LIGA**
 * 
 * Logo abaixo, criar exatamente estas 5 opções:
 * 
 * * **LA LIGA**
 * * **PREMIER LEAGUE**
 * * **SERIE A**
 * * **BUNDESLIGA**
 * * **LIGUE 1**
 * 
 * Essas opções funcionarão como abas/filtros.
 * 
 * Não adicionar outras ligas nesta etapa.
 * 
 * ---
 * 
 * # 2. FUNCIONAMENTO DAS ABAS
 * 
 * Ao clicar em uma liga, os produtos exibidos abaixo devem corresponder somente àquela liga.
 * 
 * Exemplo:
 * 
 * **LA LIGA selecionada**
 * → produtos da La Liga
 * 
 * **PREMIER LEAGUE selecionada**
 * → produtos da Premier League
 * 
 * **BUNDESLIGA selecionada**
 * → produtos da Bundesliga
 * 
 * etc.
 * 
 * Por enquanto, se ainda não existirem dados reais, utilizar somente os mocks/placeholders já existentes no projeto.
 * 
 * Não inventar produtos.
 * 
 * Não buscar imagens externas.
 * 
 * Não gerar imagens.
 * 
 * ---
 * 
 * # 3. VISUAL DAS ABAS — DESKTOP
 * 
 * No desktop, as 5 ligas devem ficar:
 * 
 * * na mesma linha;
 * * centralizadas;
 * * bem espaçadas;
 * * visualmente equilibradas;
 * * sem ocupar largura exagerada.
 * 
 * A liga selecionada precisa ter estado ativo claramente perceptível.
 * 
 * Pode utilizar o padrão visual já existente no projeto, por exemplo:
 * 
 * * texto mais escuro/negrito;
 * * pequeno underline;
 * * detalhe na cor vermelha da BIGofertas.
 * 
 * Não criar botões enormes.
 * 
 * A aparência deve ser semelhante a navegação por categoria de um e-commerce profissional.
 * 
 * ---
 * 
 * # 4. TRANSIÇÃO ENTRE LIGAS
 * 
 * Ao selecionar outra liga, quero uma transição discreta nos produtos.
 * 
 * Utilizar:
 * 
 * **fade out + fade in somente por opacidade.**
 * 
 * Não utilizar:
 * 
 * * slide;
 * * movimento lateral;
 * * zoom;
 * * scale;
 * * animação vertical.
 * 
 * A troca deve parecer suave e rápida.
 * 
 * Referência:
 * 
 * **250–350ms**
 * 
 * O grupo atual desaparece enquanto o novo aparece.
 * 
 * ---
 * 
 * # 5. DESKTOP — PRODUTOS
 * 
 * No DESKTOP, utilizar exatamente o mesmo padrão já aprovado para:
 * 
 * **Mais Vendidos / Lançamentos / Produtos do Brasileirão.**
 * 
 * Mostrar:
 * 
 * **5 produtos por vez.**
 * 
 * Estrutura:
 * 
 * * imagem;
 * * nome;
 * * preço;
 * * botão **ADICIONAR AO CARRINHO**.
 * 
 * Não criar um estilo novo de ProductCard.
 * 
 * Reutilizar o componente existente.
 * 
 * ---
 * 
 * # 6. DESKTOP — 3 BOLINHAS
 * 
 * Cada liga deve comportar até:
 * 
 * **15 produtos**
 * 
 * divididos em:
 * 
 * * bolinha 1 → produtos 1–5
 * * bolinha 2 → produtos 6–10
 * * bolinha 3 → produtos 11–15
 * 
 * Mostrar exatamente:
 * 
 * **3 bolinhas abaixo dos produtos.**
 * 
 * As bolinhas devem seguir o padrão já aprovado:
 * 
 * ### Ativa
 * 
 * * preenchida em preto/escuro;
 * * contorno visível.
 * 
 * ### Inativas
 * 
 * * fundo claro;
 * * contorno preto/cinza;
 * * claramente perceptíveis.
 * 
 * As 3 devem ficar centralizadas.
 * 
 * ---
 * 
 * # 7. DESKTOP — PAGINAÇÃO COM CROSSFADE
 * 
 * Ao clicar em uma das 3 bolinhas:
 * 
 * * os 5 produtos atuais fazem fade out;
 * * os próximos 5 fazem fade in simultaneamente.
 * 
 * Somente opacidade.
 * 
 * Não deslizar os produtos lateralmente.
 * 
 * Manter exatamente a mesma mecânica já utilizada nas demais seções de produto do desktop.
 * 
 * ---
 * 
 * # 8. ESTADO INDEPENDENTE POR LIGA
 * 
 * Cada liga deve controlar corretamente seus próprios produtos.
 * 
 * Exemplo:
 * 
 * Se estiver em:
 * 
 * **Premier League → página 2**
 * 
 * e depois selecionar:
 * 
 * **La Liga**
 * 
 * a seção deve mostrar corretamente os produtos da La Liga.
 * 
 * Não misturar produtos entre ligas.
 * 
 * Não manter itens de uma liga anterior durante a troca.
 * 
 * ---
 * 
 * # 9. MOBILE — ABAS DAS LIGAS
 * 
 * No MOBILE, as 5 ligas podem ficar em uma linha horizontal rolável.
 * 
 * Quero:
 * 
 * * nomes das ligas lado a lado;
 * * swipe/scroll horizontal caso não caibam;
 * * aba ativa claramente destacada;
 * * sem quebrar nomes em várias linhas desnecessariamente;
 * * sem scrollbar feia visível.
 * 
 * Não comprimir os textos até ficarem ilegíveis apenas para colocar todas as ligas simultaneamente na tela.
 * 
 * ---
 * 
 * # 10. MOBILE — PRODUTOS
 * 
 * No mobile, seguir EXATAMENTE a mecânica que já definimos para produtos:
 * 
 * * SEM bolinhas;
 * * SEM paginação em grupos;
 * * SEM fade durante o swipe;
 * * produtos em sequência horizontal;
 * * usuário desliza com o dedo;
 * * uma barra horizontal discreta abaixo indicando a posição.
 * 
 * Não alterar o tamanho dos cards mobile já aprovado.
 * 
 * ---
 * 
 * # 11. MOBILE — BARRA DE ROLAGEM
 * 
 * A barra deve:
 * 
 * * ficar abaixo dos produtos;
 * * ser fina;
 * * discreta;
 * * acompanhar a posição horizontal;
 * * não gerar overflow na página inteira.
 * 
 * O scroll horizontal deve existir somente dentro da seção.
 * 
 * ---
 * 
 * # 12. NÃO CRIAR LOGOS DE LIGAS AGORA
 * 
 * Nesta etapa, utilizar apenas os nomes:
 * 
 * **LA LIGA**
 * **PREMIER LEAGUE**
 * **SERIE A**
 * **BUNDESLIGA**
 * **LIGUE 1**
 * 
 * Não pesquisar logos.
 * 
 * Não gerar logos.
 * 
 * Não usar imagens externas.
 * 
 * Futuramente poderemos associar artes/logos vindos do Cloudflare R2.
 * 
 * ---
 * 
 * # 13. PREPARAÇÃO PARA SUPABASE
 * 
 * Não integrar o banco ainda.
 * 
 * Porém, deixar a estrutura preparada para futuramente receber dados semelhantes a:
 * 
 * ```tsx
 * {
 *   id: 'premier-league',
 *   name: 'Premier League',
 *   slug: 'premier-league',
 *   active: true,
 *   position: 2
 * }
 * ```
 * 
 * e produtos relacionados por `league_id` ou estrutura equivalente definida posteriormente.
 * 
 * Não criar migrations agora.
 * 
 * ---
 * 
 * # 14. REUTILIZAÇÃO DE COMPONENTES
 * 
 * Antes de criar componentes novos, verificar os existentes.
 * 
 * Reutilizar:
 * 
 * * ProductCard;
 * * estrutura de ProductSection;
 * * paginação desktop;
 * * scroll mobile;
 * * fade/crossfade;
 * 
 * quando já existirem.
 * 
 * Não duplicar a mesma lógica para cada liga.
 * 
 * A troca de liga deve mudar apenas os dados exibidos.
 * 
 * ---
 * 
 * # 15. POSIÇÃO FINAL NA HOME
 * 
 * A ordem deverá ficar:
 * 
 * **Banner Brasileirão**
 * 
 * ↓
 * 
 * **Times Brasileiros**
 * 
 * ↓
 * 
 * **Produtos do Brasileirão**
 * 
 * ↓
 * 
 * ## **COMPRE POR LIGA**
 * 
 * `LA LIGA | PREMIER LEAGUE | SERIE A | BUNDESLIGA | LIGUE 1`
 * 
 * ↓
 * 
 * **Produtos da liga selecionada**
 * 
 * ↓
 * 
 * **próximas seções da Home**
 * 
 * ---
 * 
 * # 16. NÃO ALTERAR
 * 
 * Não modificar:
 * 
 * * Header;
 * * busca;
 * * menus;
 * * PNG Slot Superior;
 * * PNG Slot Inferior;
 * * Mais Vendidos;
 * * Lançamentos;
 * * Diversifique seu pedido;
 * * carrossel infinito desktop de Diversifique;
 * * Banner Brasileirão;
 * * tamanho mobile do Banner Brasileirão;
 * * Times Brasileiros;
 * * distribuição dos 11 times;
 * * Produtos do Brasileirão;
 * * tamanho dos ProductCards;
 * * Supabase;
 * * Auth;
 * * RLS;
 * * migrations;
 * * TanStack Router;
 * * `.lovable`;
 * * rodapé.
 * 
 * Não fazer refatorações extras.
 * 
 * ---
 * 
 * # 17. VALIDAÇÃO FINAL
 * 
 * Antes de finalizar, confirmar:
 * 
 * 1. Existe o título **COMPRE POR LIGA**.
 * 2. Existem exatamente 5 ligas.
 * 3. As ligas funcionam como abas.
 * 4. Apenas uma liga fica ativa por vez.
 * 5. Desktop mostra 5 produtos por vez.
 * 6. Desktop possui 3 bolinhas com contorno.
 * 7. Paginação desktop utiliza apenas crossfade de opacidade.
 * 8. Mobile não possui bolinhas.
 * 9. Mobile possui scroll horizontal dos produtos.
 * 10. Mobile possui barra horizontal abaixo dos produtos.
 * 11. Tamanho dos ProductCards não mudou.
 * 12. Trocar de liga não mistura produtos.
 * 13. Nenhuma imagem externa foi adicionada.
 * 14. Nenhuma integração Supabase foi criada nesta etapa.
 * 15. Todas as seções anteriores permaneceram intactas.
 * 
 * **Faça exclusivamente a criação da seção “COMPRE POR LIGA”.**
 */
import { createFileRoute } from "@tanstack/react-router";
import PromoBanner from "@/components/layout/PromoBanner";
import Header from "@/components/layout/Header";
import BestSellers from "@/components/home/BestSellers";
import VisualCategories from "@/components/home/VisualCategories";
import BrazilianProducts from "@/components/home/BrazilianProducts";
import BrazilianTeams from "@/components/home/BrazilianTeams";
import ShopByLeague from "@/components/home/ShopByLeague";

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
      </main>
    </div>
  );
}