# BIGofertas — Fase 03 — Relatório técnico

Data: 01/09/2026

Status: **implementada como infraestrutura candidata a teste; não formalmente aprovada**.

## Objetivo desta fase

Preparar o site inteiro para receber imagens no Cloudflare R2 sem fazer agora a carga pesada de produtos/fotos. A carga definitiva foi adiada para uma das últimas etapas do projeto.

## Implementado

- nova tabela `product_images`;
- múltiplas imagens por produto;
- vínculo opcional de imagem a variante;
- imagem principal por produto e por variante;
- ordenação por `sort_order`;
- estados `pending`, `ready`, `failed`, `archived`;
- metadados de MIME, dimensões, bytes, ETag, checksum, nome original e alt text;
- chave R2 (`storage_key`) separada da URL pública;
- RLS: público lê somente imagens `ready` de produtos ativos; owner administra;
- RPC `set_primary_product_image(uuid)` para troca atômica da principal;
- primeira imagem confirmada de um escopo torna-se principal quando ainda não há outra;
- `products.image_url` mantido somente como fallback legado durante a transição;
- frontend passa a preferir `product_images`/R2 e só depois usar `image_url` legado;
- carrinho recebe a URL de exibição resolvida quando a página já usa imagem R2;
- variável pública `VITE_R2_PUBLIC_BASE_URL`;
- modelo de CORS do bucket;
- Edge Function `r2-image-presign` para preparar upload PUT direto ao R2;
- Edge Function `r2-image-complete` para verificar o objeto por HEAD antes de marcar como `ready`;
- segredos R2 isolados nas Edge Functions.

## Decisões importantes

O banco não grava o domínio completo de cada imagem. Ele grava somente a chave do objeto. Isso permite trocar `r2.dev`, domínio de teste ou domínio CDN de produção alterando uma única configuração.

O padrão de chave usa UUIDs (`products/<product>/<imagem>...`) e não o slug/nome do produto, evitando quebrar URLs quando nomes mudarem.

WebP é o formato preferencial para o acervo final. A infraestrutura também aceita AVIF/JPEG/PNG para não engessar o fluxo futuro. Conversão em massa e otimização das imagens reais não foram executadas.

## Segurança

Credenciais `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` não aparecem em `src/` nem em variáveis `VITE_*`.

As URLs de upload são pré-assinadas, curtas e específicas para PUT. As Edge Functions exigem JWT e validam que o usuário possua papel `owner` antes de preparar ou concluir um upload.

## Cloudflare ainda precisa de configuração real

Nenhum bucket, domínio, token ou credencial foi inventado. Para ativação em ambiente real será necessário:

1. criar/selecionar o bucket R2;
2. configurar domínio público (produção) ou `r2.dev` apenas para teste;
3. aplicar CORS adequado às origens reais;
4. registrar os segredos R2 nas Supabase Edge Functions;
5. definir `VITE_R2_PUBLIC_BASE_URL` no ambiente do frontend;
6. aplicar a migration e publicar as Edge Functions.

## Itens propositalmente adiados

- carga de todas as imagens reais;
- cadastro em massa dos produtos reais;
- conversão/otimização em massa para WebP;
- revisão foto por foto;
- galeria administrativa;
- interface final da página de produto;
- seleção de variante/tamanho;
- remoção definitiva de `products.image_url`.

A carga completa de produtos + imagens ficará perto do final do projeto, depois de o site funcional estar praticamente concluído.

## Referências técnicas verificadas

A arquitetura segue o modelo atual do Cloudflare R2: bucket público por domínio customizado para produção, `r2.dev` apenas para desenvolvimento, API compatível com S3, CORS para PUT em navegador e URLs pré-assinadas que não expõem a credencial secreta. As Supabase Edge Functions mantêm segredos em variáveis de ambiente e exigem JWT por padrão/configuração.

## Validação

O pacote inclui `npm run validate:phase3`, que verifica estrutura da migration, RLS, separação de segredos, CORS, integração do frontend e sintaxe TS/TSX.

`npm run build` e `npm run lint` continuam dependendo de `node_modules`; o pacote não inclui dependências vendorizadas.

### Resultado local desta entrega

- `npm run validate:phase2`: 20 validações da Fase 02 continuam aprovadas;
- `npm run validate:phase3`: **21/21 validações aprovadas**;
- 92 arquivos TS/TSX (incluindo Edge Functions) passaram pela checagem sintática por transpile;
- JSON e TOML válidos;
- imports relativos: nenhum quebrado; o único caso especial é `../styles.css?url`, resolvido pelo Vite;
- `npm run build`: não executável neste ambiente porque `vite` não está instalado (`node_modules` ausente);
- `npm run lint`: não executável neste ambiente porque `eslint` não está instalado (`node_modules` ausente).

A migration e as Edge Functions foram preparadas, mas **não foram aplicadas/deployadas no Supabase remoto nem conectadas a um bucket R2 real**, porque nenhuma credencial/domínio/bucket definitivo foi fornecido e esta fase não deve inventar infraestrutura externa.
