# Plan - Etapa 4: Seção "Mais vendidos" da Home

Implementação da seção "Mais vendidos" com carrossel responsivo (5 produtos no desktop, swipe no mobile), seguindo a identidade visual BIGofertas (Vermelho/Branco/Preto).

## Componentes a criar

### 1. `src/components/product/ProductCard.tsx`
* Card profissional de produto.
* Imagem (object-contain/cover) com proporção fixa.
* Nome do produto (limite de linhas para alinhamento).
* Preço com destaque.
* Botão "ADICIONAR AO CARRINHO" (Vermelho BIGofertas).
* Preparado para "Favoritar" (coração) e "Visualização Rápida".

### 2. `src/components/product/ProductCarousel.tsx`
* Carrossel reutilizável para seções de produtos.
* Desktop: Exibe exatamente 5 produtos. Setas de navegação lateral (Anterior/Próxima).
* Mobile: Swipe horizontal nativo (overflow-x-auto).
* Integração com botões de navegação estilizados.

### 3. `src/components/home/BestSellers.tsx`
* Componente de seção para a Home.
* Título "Mais vendidos" com tipografia e espaçamento consistente.
* Mock de dados para os produtos (conforme instrução de não mexer no banco agora).

## Alterações na Home

### `src/routes/index.tsx`
* Importar e adicionar `<BestSellers />` na posição planejada: após o banner inferior.

## Detalhes Técnicos
* **Cores**: Vermelho (#E60000 ou similar da marca), Branco, Preto.
* **Layout Desktop**: `max-w-7xl mx-auto` para alinhamento com o Header.
* **Mobile**: `no-scrollbar` e `snap-x` para uma experiência de swipe suave.
* **Reutilização**: Estrutura preparada para a futura seção "Lançamentos".

## Restrições
* Nenhuma alteração em Banners, Header ou CategoryNav.
* Nenhuma alteração em Supabase, Auth ou Banco de Dados.
* Sem instalação de bibliotecas externas pesadas (usar Tailwind + Lucide-react).
