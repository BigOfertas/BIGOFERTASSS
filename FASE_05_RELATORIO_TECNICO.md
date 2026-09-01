# BIGofertas — Fase 05: Página final do produto

Data técnica: 2026-09-01

## Escopo executado

A Fase 05 foi implementada sobre o pacote cumulativo das Fases 01–04. O objetivo desta etapa foi transformar a rota de detalhe em uma página de produto preparada para a modelagem definitiva criada na Fase 02 e para a infraestrutura de imagens/R2 criada na Fase 03, sem realizar carga massiva de produtos/imagens e sem conectar o novo projeto Supabase de staging.

## Implementações principais

### Identificação e URLs

- A rota existente `/product/$id` continua aceitando UUIDs antigos para compatibilidade.
- Os novos links de catálogo/Home usam `products.slug` como identificador da URL.
- A consulta resolve automaticamente UUID ou slug e exige `status = active`.

### Galeria preparada para R2

- Criado `ProductGallery` com imagem principal, miniaturas e fallback quando uma imagem falha.
- A galeria trabalha com zero, uma ou várias imagens.
- Imagens específicas da variante selecionada recebem prioridade.
- Imagens gerais do produto continuam disponíveis como complemento.
- `products.image_url` permanece apenas como fallback legado quando aplicável.
- Nenhuma imagem real foi adicionada nesta fase.

### Opções e variantes

- A página carrega `product_options`, `product_option_values`, `product_variants` e `product_variant_values`.
- Opções são renderizadas dinamicamente; não existem tamanhos hardcoded.
- A variante padrão inicializa a seleção quando existe.
- Mudanças de opção resolvem uma combinação comercial real.
- Quando a escolha exige alterar mais de uma opção, a página pode migrar para uma combinação compatível em vez de prender o usuário na combinação anterior.
- Combinações inexistentes não são apresentadas como válidas.

### Preço e estoque

- `price_override` da variante é respeitado.
- `promotional_price_override` é respeitado.
- Quando a variante não sobrescreve preço, os preços do produto continuam válidos.
- Estoque exibido e limite de quantidade usam `product_variants.stock_quantity` da combinação selecionada.
- Produtos/variantes sem estoque são sinalizados como indisponíveis.

### Especificações

A seção de especificações passa a combinar dados estruturados e o campo legado de especificações, incluindo quando disponíveis:

- SKU da variante/produto;
- categoria;
- time;
- liga;
- campeonato;
- peso;
- dimensões;
- especificações textuais existentes.

### Breadcrumbs

Foi criado breadcrumb semântico:

`Início → Produtos → Categoria → Produto`

Quando existe categoria normalizada, o breadcrumb direciona para o catálogo filtrado pela categoria correta.

### Produtos relacionados

- Produtos relacionados usam a RPC paginada da Fase 04.
- A busca de relacionados prioriza contexto de time; depois categoria, liga ou campeonato conforme os dados existentes.
- O próprio produto é removido da lista de relacionados.
- Não há carregamento integral do catálogo para montar relacionados.

### SEO preparado

A página passa a atualizar dinamicamente:

- `<title>`;
- meta description;
- Open Graph title/description/type/url/image;
- canonical apontando para o slug;
- JSON-LD `Product` + `Offer`;
- SKU;
- preço efetivo;
- disponibilidade;
- imagens disponíveis.

As alterações de metadata são restauradas ao sair da página para não contaminar outras rotas. A auditoria/otimização SEO global definitiva permanece na Fase 19.

## Limite deliberado da Fase 05

A modelagem/seleção de variantes na página está pronta, mas o `CartContext` atual ainda não possui identidade de linha por variante, persistência de tamanho/opções, revalidação de estoque ou recuperação de dados corrompidos. Esses itens pertencem à Fase 06 — Carrinho definitivo.

Por segurança, quando um produto possui opções ou múltiplas variantes, a Fase 05 não grava a escolha no carrinho legado de forma incorreta. Produtos de variante única continuam compatíveis com o carrinho atual.

## Banco de dados

Nenhuma migration nova foi necessária nesta fase. A página usa as estruturas já criadas:

- Fase 02: opções, valores, variantes, combinações, estoque e preço por variante;
- Fase 03: `product_images` e estrutura R2;
- Fase 04: RPC paginada para produtos relacionados.

Nenhuma migration foi aplicada ao novo projeto Supabase remoto e a conexão de staging continua adiada conforme decisão do projeto.

## Arquivos principais adicionados

- `src/lib/product-detail.ts`
- `src/components/product/ProductGallery.tsx`
- `src/components/product/ProductSeo.tsx`
- `scripts/validate-phase-05.mjs`

## Arquivos principais alterados

- `src/routes/product/$id.tsx`
- `src/lib/product-images.ts`
- `src/components/product/ProductCard.tsx`
- `src/routes/products.tsx`
- `src/components/home/BestSellers.tsx`
- `src/components/home/BrazilianProducts.tsx`
- `src/components/home/ShopByLeague.tsx`
- `package.json`

## Validação

Regressão cumulativa executada:

- Fase 02: 20/20 validações estruturais.
- Fase 03: 21/21 validações.
- Fase 04: 33/33 validações.
- Fase 05: 33/33 validações.
- 96 arquivos TypeScript/TSX verificados sem erro sintático pelo transpiler TypeScript.
- JSON válido.
- TOML válido.
- 0 imports locais quebrados na varredura estrutural.
- Nenhum literal da nova conta Supabase de staging foi incorporado ao projeto.

### Limitação de build/lint

Foi tentado `npm install --ignore-scripts --no-audit --no-fund`, mas a instalação expirou antes de criar `node_modules`. Assim, `vite build` e ESLint completos não puderam ser executados neste ambiente. Não ficou instalação parcial no pacote.

## Próxima fase

Fase 06 — Carrinho definitivo:

- identidade de item por produto + variante;
- persistência de tamanho/opções;
- preço da variante;
- estoque da variante;
- quantidades máximas;
- recuperação/limpeza de carrinho antigo ou corrompido;
- revalidação antes de operações futuras;
- valores ainda estimados enquanto frete real/pedidos não estiverem implementados.

A conexão com o novo Supabase continua adiada neste ponto, conforme decisão do projeto.
