# BIGofertas — Fase 02 — Relatório técnico

Data do pacote: 31/08/2026

Status: **implementada como pacote candidato para teste local; ainda não formalmente aprovada**.

## Escopo executado

A Fase 02 implementa a modelagem definitiva dos produtos sem avançar para o sistema definitivo de imagens da Fase 03.

Foram implementados:

- SKU obrigatório e único no produto;
- SKU obrigatório e único por variante;
- slug obrigatório e único no produto;
- preço base e preço promocional com validação no banco;
- status de produto: `draft`, `active`, `inactive`, `archived`;
- status de variante: `active`, `inactive`, `archived`;
- categorias normalizadas e hierárquicas;
- relação produto ↔ categorias;
- categoria principal com cache textual de compatibilidade para o frontend atual;
- peso em gramas;
- comprimento, largura e altura em centímetros;
- opções de produto genéricas;
- tipos de opção `size`, `style`, `color` e `other`;
- valores de opções;
- variantes comerciais;
- associação de valores de opção às variantes;
- preço e preço promocional opcionais por variante;
- estoque por variante;
- `products.stock` transformado em cache agregado das variantes ativas;
- regras de consistência, índices, triggers e RLS.

## Decisão importante sobre imagens

As imagens ainda estão incompletas e **não foram fechadas nesta fase**.

A coluna antiga `products.image_url` foi tornada opcional para impedir que a falta de uma imagem bloqueie o cadastro/modelagem de um produto real. Ela permanece somente como compatibilidade temporária do frontend existente.

Não foi criada tabela `product_images` e não foi implementado Cloudflare R2, WebP, ordem de imagens, nomes definitivos ou galeria. Isso permanece integralmente reservado à **Fase 03 — Cloudflare R2 e sistema de imagens**.

## Migration principal

Arquivo:

`supabase/migrations/20260831233500_phase_02_definitive_product_model.sql`

A migration foi construída de forma incremental sobre a tabela `products` existente.

### Backfill da base atual

Para preservar dados existentes:

1. produtos existentes recebem SKU técnico estável derivado do UUID quando ainda não possuem SKU;
2. produtos existentes recebem slug derivado do nome, com tratamento de colisões;
3. produtos existentes recebem status `active` para preservar a visibilidade atual;
4. categorias textuais existentes são migradas para `categories`;
5. `primary_category_id` é preenchido quando uma categoria textual correspondente existe;
6. cada produto existente sem variante recebe uma variante padrão interna;
7. o estoque antigo de `products.stock` é migrado para essa variante;
8. depois disso, `products.stock` passa a ser recalculado pelas variantes ativas.

Nenhum produto fictício foi criado nesta migration.

## Estrutura de categorias

### `categories`

Contém:

- `id`;
- `name`;
- `slug`;
- `parent_id` para hierarquia;
- `is_active`;
- `sort_order`;
- timestamps.

### `product_categories`

Permite que um produto pertença a mais de uma categoria.

`products.primary_category_id` define a categoria principal. A coluna textual antiga `products.category` permanece apenas como cache temporário de compatibilidade até a evolução do catálogo na Fase 04.

## Estrutura de opções, tamanhos e variantes

A modelagem não fixa tamanho em uma coluna rígida. Foi adotado um modelo flexível de opções.

### `product_options`

Exemplos:

- Tamanho (`size`);
- Versão (`style`);
- Cor (`color`);
- outro atributo (`other`).

### `product_option_values`

Exemplos de valores:

- P, M, G, GG;
- Infantil 16;
- Torcedor;
- Jogador.

Esses exemplos são apenas ilustrativos; nenhum deles é inserido automaticamente no banco.

### `product_variants`

Cada combinação comercial possui:

- SKU próprio;
- status;
- marcação de variante padrão;
- ordem;
- preço opcional específico;
- preço promocional opcional específico;
- estoque próprio.

### `product_variant_values`

Relaciona uma variante aos valores das opções e impede que uma variante use uma opção pertencente a outro produto.

## Estoque

O estoque autoritativo da Fase 02 fica em:

`product_variants.stock_quantity`

`products.stock` permanece disponível para o frontend atual, porém agora funciona como cache agregado das variantes ativas.

O banco impede alteração direta normal de `products.stock`; o valor é atualizado pelas triggers de variante.

A lógica de **reserva/decremento transacional para compras simultâneas ainda não foi implementada**, pois permanece corretamente reservada à **Fase 11 — Estoque transacional**.

## Regras implementadas no banco

Entre as regras adicionadas estão:

- SKU não vazio;
- SKU normalizado e índice único case-insensitive;
- slug normalizado e único;
- nome do produto não vazio;
- preço não negativo;
- preço promocional menor que o preço normal;
- estoque nunca negativo;
- peso positivo quando informado;
- dimensões positivas quando informadas;
- dimensões devem ser informadas como conjunto completo (comprimento + largura + altura) ou permanecer todas vazias;
- uma única variante padrão por produto;
- opção e variante devem pertencer ao mesmo produto;
- produto ativo não pode perder sua última variante ativa;
- produto novo nasce em `draft` por padrão;
- produto somente pode mudar para `active` quando já possui variante ativa;
- timestamps são atualizados pelo banco.

## RLS

A leitura pública da tabela `products` foi endurecida:

- público e clientes autenticados enxergam somente produtos `active`;
- owner pode ler todos os status;
- somente owner pode criar, editar ou excluir produtos;
- as novas tabelas de categorias/opções/variantes seguem o mesmo princípio;
- valores/variantes públicos só ficam acessíveis quando o produto pai está ativo.

Isso ainda será reavaliado de ponta a ponta na **Fase 20 — Auditoria final de segurança**.

## Frontend atualizado

O frontend foi adaptado à nova modelagem sem antecipar as telas finais das fases posteriores.

Alterações principais:

- `src/integrations/supabase/types.ts` atualizado para a estrutura nova;
- `src/lib/products.ts` passou a reconhecer SKU, slug, status e preço promocional;
- pesquisa textual também considera SKU e slug;
- `useCatalogProducts` consulta explicitamente apenas produtos ativos;
- página de produto consulta somente produto ativo;
- preço promocional é respeitado no catálogo, Home e detalhe do produto;
- carrinho recebe o preço efetivo (promocional quando aplicável);
- `image_url` passou a ser nullable no TypeScript e o fallback “Imagem indisponível” continua funcionando.

A seleção final de tamanho/variante na página de produto permanece para a **Fase 05** e o armazenamento definitivo de variante/tamanho no carrinho permanece para a **Fase 06**.

## Arquivos alterados/adicionados

Principais arquivos:

- `supabase/migrations/20260831233500_phase_02_definitive_product_model.sql`;
- `src/integrations/supabase/types.ts`;
- `src/lib/products.ts`;
- `src/hooks/useCatalogProducts.ts`;
- `src/components/product/ProductCard.tsx`;
- `src/components/home/BestSellers.tsx`;
- `src/components/home/BrazilianProducts.tsx`;
- `src/components/home/ShopByLeague.tsx`;
- `src/routes/products.tsx`;
- `src/routes/product/$id.tsx`;
- `src/context/CartContext.tsx`;
- `scripts/validate-phase-02.mjs`;
- `package.json`;
- `README.md`.

## Validações executadas

### Aprovadas

- `npm run validate:phase2`: **20/20 validações estruturais aprovadas**;
- 86 arquivos `.ts/.tsx` processados pelo TypeScript em modo de transpile: **0 erros sintáticos**;
- type-check estrito do núcleo da modelagem (`types.ts` + `products.ts`): **aprovado**;
- imports locais: **0 quebrados**;
- JSON: **22 arquivos válidos**;
- TOML: **2 arquivos válidos**;
- migration: blocos `$$` balanceados;
- migration: 140 statements identificados pelo lexer estrutural;
- migration inicia com `BEGIN` e termina com `COMMIT`;
- migration não cria `product_images`;
- runtime sem reintrodução de frete grátis fictício ou cupom fictício.

O único `placehold.co` restante no código runtime está na função defensiva que reconhece o produto fictício histórico da Fase 01 para removê-lo de dados antigos.

### Build e lint

`npm run build` não pôde completar porque `vite` não está instalado no pacote extraído:

`sh: 1: vite: not found`

`npm run lint` não pôde completar porque `eslint` não está instalado no pacote extraído:

`sh: 1: eslint: not found`

Foram feitas duas tentativas de instalar as dependências, mas o ambiente não possui resolução de rede funcional. Portanto, o pacote não inclui `node_modules` e não houve modificação de lockfile causada por instalação parcial.

## Aplicação no Supabase

A migration da Fase 02 foi preparada, mas **não foi aplicada automaticamente ao projeto Supabase remoto** neste ambiente.

Para testar o frontend com essa Fase 02, a migration precisa estar aplicada no banco utilizado pelo ambiente de teste. O frontend atualizado pressupõe que as novas colunas (`sku`, `slug`, `status`, `promotional_price` etc.) já existam.

## Itens deliberadamente não implementados nesta fase

Permanecem para as fases planejadas:

- R2 e sistema definitivo de imagens — Fase 03;
- catálogo final, filtros/ordenação/paginação — Fase 04;
- UI final de tamanho/variante e página definitiva — Fase 05;
- variante e tamanho persistidos definitivamente no carrinho — Fase 06;
- administração completa de produtos — Fase 07;
- frete real — Fase 09;
- estoque transacional/reservas — Fase 11;
- build Hostinger — Fase 21.

## Conclusão

A estrutura de produto deixou de ser uma tabela simples baseada em nome/preço/imagem/estoque e passou a possuir identidade comercial, estados, categorias normalizadas e configuração flexível de variantes.

O pacote deve ser tratado como **candidato da Fase 02 para teste local**, e não como aprovação formal da fase nem como pacote de produção.
