# Cloudflare R2 — infraestrutura de imagens da BIGofertas

Esta pasta faz parte da **Fase 03**. Ela prepara a loja para receber imagens, mas nao carrega o acervo real.

## Arquitetura

- O bucket R2 guarda os arquivos.
- O Postgres guarda somente `product_images.storage_key` e metadados; a URL completa nao fica gravada por produto.
- O frontend monta a URL publica usando `VITE_R2_PUBLIC_BASE_URL`.
- Credenciais de escrita do R2 existem somente nas Supabase Edge Functions.
- Uploads futuros usam URL `PUT` pre-assinada e curta; o navegador nunca recebe `R2_SECRET_ACCESS_KEY`.
- Depois do `PUT`, `r2-image-complete` confirma o objeto no R2 com `HEAD` antes de marcar a imagem como `ready`.

## Convencao de chaves

Imagem geral do produto:

`products/<product_uuid>/<image_uuid>.<ext>`

Imagem vinculada a variante:

`products/<product_uuid>/variants/<variant_uuid>/<image_uuid>.<ext>`

O nome do produto/slug nao entra na chave para que renomear um produto nao quebre URLs.

## Formatos

A infraestrutura aceita `image/webp`, `image/avif`, `image/jpeg` e `image/png`.

**WebP e o formato preferencial para o acervo final.** A conversao/otimizacao em massa e a carga de todas as fotos nao pertencem a esta fase e ficarao para a etapa final de conteudo.

## Bucket e dominio

Para producao, use um dominio proprio conectado ao bucket (por exemplo `img.seudominio.com`) e configure esse endereco em `VITE_R2_PUBLIC_BASE_URL`.

O `r2.dev` pode ser usado somente em teste/desenvolvimento e nao deve ser tratado como URL final de producao.

## CORS

`r2-cors.example.json` e um modelo. Antes de aplicar:

1. substitua `https://SEU-DOMINIO-DE-PRODUCAO` pelo dominio real;
2. remova origens locais no ambiente de producao se nao forem necessarias;
3. aplique a policy no bucket R2;
4. mantenha `PUT` porque o upload futuro sera feito com URL pre-assinada.

## Segredos das Edge Functions

Copie `supabase/functions/.env.example` apenas para configuracao local/segura e preencha:

- `R2_ACCOUNT_ID`;
- `R2_ACCESS_KEY_ID`;
- `R2_SECRET_ACCESS_KEY`;
- `R2_BUCKET_NAME`;
- `APP_ALLOWED_ORIGINS`.

Nunca coloque essas variaveis em `.env` do frontend com prefixo `VITE_`.

## Fluxo preparado para a futura administracao

1. owner chama `r2-image-presign` com produto, variante opcional e MIME;
2. a funcao cria o registro `pending` em `product_images` e devolve URL PUT pre-assinada;
3. navegador envia o arquivo diretamente ao R2 com o `Content-Type` autorizado;
4. owner chama `r2-image-complete`;
5. a funcao faz `HEAD`, valida tipo/tamanho e muda a imagem para `ready`;
6. a leitura publica enxerga somente imagens `ready` de produtos ativos;
7. a primeira imagem pronta de cada escopo se torna principal automaticamente;
8. `set_primary_product_image(uuid)` permite trocar a imagem principal de forma atomica na futura tela administrativa.

## O que nao foi feito nesta fase

- nenhuma imagem real foi enviada;
- nenhum produto novo foi cadastrado;
- nenhuma conversao em massa para WebP foi executada;
- nenhum dominio R2 de producao foi presumido;
- nenhuma credencial R2 foi inventada;
- nenhuma galeria administrativa foi criada.
