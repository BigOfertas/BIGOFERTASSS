# BIGofertas — Fase 04: Arquitetura escalável do catálogo

Data: 01/09/2026

## Situação

Implementação concluída no código local, de forma cumulativa sobre as Fases 01, 02 e 03.

A conexão com o novo projeto Supabase de staging foi deliberadamente adiada, conforme decisão do projeto. Nenhuma migration desta fase foi aplicada remotamente e nenhuma credencial nova fornecida para o staging foi gravada neste pacote.

## Objetivo da Fase 04

Preparar o catálogo para trabalhar com mais de 1.000 produtos sem baixar a base inteira para o navegador.

A carga definitiva dos produtos e das imagens permanece fora desta fase e continuará perto do final do cronograma.

## Problema encontrado na base anterior

O hook `useCatalogProducts` consultava todos os produtos ativos com `select("*")`, depois consultava todas as imagens dos produtos encontrados e finalmente executava busca e filtros no navegador.

Esse desenho funcionava para uma base pequena, mas escalava mal porque:

- o volume transferido crescia junto com a quantidade total de produtos;
- a página do catálogo precisava manter toda a base em memória;
- filtros eram calculados apenas a partir dos produtos já baixados;
- Home e vitrines reutilizavam a mesma consulta completa;
- cada imagem da coleção também precisava ser carregada como metadado antes da renderização.

## Implementação de banco preparada

Migration criada:

`supabase/migrations/20260901012000_phase_04_scalable_catalog.sql`

### Busca

Foi preparada busca indexada com:

- `catalog_search_text` normalizado;
- `catalog_search_vector` (`tsvector`);
- índice GIN de full-text;
- índice trigram como fallback para buscas parciais;
- normalização de acentos e caixa;
- pesquisa por nome, SKU, slug, descrição, especificações, categoria, campeonato, liga e time.

### Chaves canônicas de filtros

Produtos passam a manter chaves normalizadas para:

- campeonato;
- liga;
- time.

Categorias continuam usando o `slug` normalizado da tabela `categories`.

Isso permite URLs estáveis como:

- `?category=infantil`
- `?campeonato=copa-do-mundo`
- `?time=sao-paulo`
- `?liga=...`

sem depender de acentos ou variações de capitalização.

### Índices preparados

Foram criados índices específicos para:

- produtos ativos por data;
- produtos ativos por nome;
- preço efetivo (`promotional_price` ou `price`);
- campeonato;
- liga;
- time;
- combinação campeonato + liga + time;
- busca full-text;
- busca trigram.

### RPC `catalog_products_page`

A consulta principal do catálogo agora está preparada para ocorrer no PostgreSQL.

Ela recebe:

- texto de busca;
- categoria;
- campeonato;
- liga;
- time;
- preço mínimo;
- preço máximo;
- ordenação;
- página;
- tamanho da página.

Limite máximo definido: **48 produtos por página**.

Ordenações preparadas:

- mais recentes;
- menor preço;
- maior preço;
- nome A–Z;
- nome Z–A.

A resposta contém somente os campos necessários aos cards e apenas a imagem preferida do produto, em vez de enviar toda a galeria.

Também retorna:

- quantidade total;
- página atual;
- tamanho da página;
- quantidade total de páginas.

### RPC `catalog_filter_facets`

Os filtros não são mais derivados da página de resultados.

A RPC de facetas retorna valores globais válidos do catálogo ativo para:

- categorias;
- campeonatos;
- ligas;
- times;
- menor preço disponível;
- maior preço disponível.

Cada opção também possui contagem de produtos.

## Frontend

### `src/lib/catalog.ts`

Criado módulo dedicado ao contrato do catálogo com:

- schemas Zod das respostas;
- tipos de paginação;
- tipos de filtros;
- tipos de facetas;
- opções de ordenação;
- tamanhos de página permitidos;
- conversão da `storage_key` do R2 para URL pública;
- fallback para `image_url` legado.

### `src/hooks/useCatalogProducts.ts`

O hook deixou de executar `select("*")` da tabela de produtos.

Agora utiliza:

- `catalog_products_page` para os resultados;
- `catalog_filter_facets` para filtros.

Cache configurado:

- página do catálogo: 30 segundos;
- facetas: 5 minutos.

Durante troca de página/filtro, React Query mantém temporariamente os dados anteriores para reduzir piscar da interface.

### Página `/products`

A URL agora suporta:

- `q`;
- `category`;
- `campeonato`;
- `liga`;
- `time`;
- `minPrice`;
- `maxPrice`;
- `sort`;
- `page`;
- `pageSize`.

Foram adicionados:

- paginação real;
- tamanho de página 12/24/48;
- ordenação;
- contagem total de resultados;
- faixa de preço;
- indicador de atualização da consulta;
- tratamento de página vazia;
- carregamento independente das facetas.

### Filtros

`ProductFilters` não recebe mais a lista inteira de produtos.

Agora recebe facetas próprias do banco e mostra a quantidade de produtos por opção.

### Home

As vitrines também deixaram de depender de uma consulta completa do catálogo:

- Produtos recentes: consulta limitada;
- Produtos do Brasileirão: filtro executado no backend;
- Compre por liga: ligas vêm das facetas e cada seleção gera consulta limitada;
- Links de times/categorias usam chaves canônicas.

## Escopo deliberadamente não implementado

Esta fase não:

- importou produtos reais em massa;
- fez upload de imagens reais;
- aplicou migrations no Supabase remoto;
- conectou o novo projeto Supabase de staging;
- alterou R2 externo;
- implementou página final do produto;
- implementou carrinho definitivo;
- implementou admin;
- criou build específico para Hostinger.

## Validações

### Fase 02

20/20 validações estruturais aprovadas.

### Fase 03

21/21 validações aprovadas após adaptar o teste de regressão à nova arquitetura, onde a escolha da imagem do catálogo foi movida para a RPC paginada.

### Fase 04

33/33 validações aprovadas.

Incluem:

- busca indexada preparada;
- índices de filtros e ordenação;
- paginação máxima de 48;
- RPC de catálogo;
- RPC de facetas;
- ausência de `select("*")` no hook principal do catálogo;
- paginação na URL;
- ordenação;
- preço mínimo/máximo;
- facetas independentes da página;
- Home limitada;
- nenhuma inserção em massa de produtos;
- nenhuma inserção de imagens reais.

### TypeScript/TSX

93 arquivos TS/TSX passaram pela validação sintática via compilador TypeScript.

### Estrutura

- JSON válido;
- TOML válido;
- imports locais resolvidos;
- credenciais do novo Supabase de staging não gravadas no pacote.

## Limitação do ambiente

Foi tentado `npm install` para executar build/lint/typecheck completos, mas a instalação não concluiu antes do limite do ambiente e `node_modules` não foi criado.

Por isso não foi possível executar de forma confiável:

- `npm run build`;
- `npm run lint`;
- typecheck completo com todas as dependências reais.

A validação sintática e estrutural foi executada independentemente dessas dependências.

## Conexão com backend

A Fase 04 está preparada, mas ainda não aplicada.

Quando a conexão for feita após a Fase 06, deverão ser aplicadas cumulativamente as migrations das Fases anteriores e desta fase no projeto Supabase de staging. Só depois será possível medir o plano de execução real das consultas e fazer ajustes finos de índices com dados representativos.

## Próxima fase

**Fase 05 — Página final do produto**

A próxima fase deve construir a página final de produto sobre a modelagem de variantes e imagens já preparada, ainda sem exigir a carga definitiva dos mais de 1.000 produtos.
