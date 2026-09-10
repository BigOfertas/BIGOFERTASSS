# Implantação de lote em um único comando — BIGofertas

A BIGofertas possui um fluxo permanente para que um grupo de produtos seja implantado de ponta a ponta sem criar workflows temporários nem exigir prompts intermediários.

## Regra operacional

Quando o usuário autorizar **implantar completamente**, **subir o grupo** ou equivalente, a execução do lote deve continuar até o resultado final, sem parar entre coleta, escrita, ativação, publicação e validação.

O ponto de entrada persistente é:

- workflow: `.github/workflows/catalog-batch-deploy.yml`;
- pedido automatizado: `catalog-jobs/batch-deploy/job.json`;
- guarda de banco: `scripts/catalog-batch-guard.mjs`;
- E2E público: `scripts/catalog-batch-public-verify.mjs`.

Para uma execução iniciada pelo assistente, atualize apenas o `job.json` permanente com um `request_id` novo, `enabled: true`, URL do álbum e parâmetros do lote. Não crie workflow `*-once.yml`. O próprio push do pedido dispara a implantação.

## Fluxo automático

1. valida o pedido e bloqueia URLs que não sejam Google Photos HTTPS;
2. garante as migrations/pré-requisitos atuais do catálogo;
3. tira snapshot de pedidos, itens, perfis e afiliados;
4. coleta o álbum completo com Chromium;
5. gera assimilação/contact sheets e exige imagens válidas;
6. normaliza produto-base, variantes, imagens e regras comerciais;
7. valida todas as URLs do Google Photos;
8. grava o lote no Supabase e ativa os produtos;
9. mantém a numeração `P000XXX` contínua pelo importador transacional;
10. confere exatamente produtos, variantes, imagens prontas, códigos e source keys do plano;
11. exige que pedidos, itens, perfis e afiliados permaneçam com as mesmas contagens;
12. opcionalmente chama o workflow oficial da Hostinger quando `deploy_frontend: true`;
13. executa E2E público em navegador real na homepage, categorias e amostras do começo/meio/fim do lote;
14. preserva a regra de 10 produtos na área de Lançamentos;
15. salva evidências por 30 dias e só termina com `CATALOG_BATCH_DEPLOY_PUBLIC_OK`.

## Segurança contra destruição acidental

`reset_catalog` é `false` por padrão. Mesmo que seja alterado para `true`, a execução é bloqueada a menos que o pedido também contenha exatamente:

`RESET-CATALOGO-AUTORIZADO`

Assim, a operação normal sempre acrescenta/reprocessa somente o lote identificado pela origem e preserva o catálogo já publicado.

## Modelo do pedido

```json
{
  "enabled": true,
  "request_id": "kids-20260909-001",
  "album_url": "https://photos.google.com/share/...",
  "label": "CONJUNTOS INFANTIS KIDS",
  "expected_min_images": 1,
  "max_scrolls": 350,
  "default_stock": 999,
  "deploy_frontend": false,
  "reset_catalog": false,
  "reset_authorization": "",
  "public_base_url": "https://bigofertas.net",
  "launch_count": 10
}
```

Depois da execução, o arquivo pode permanecer com os dados do último pedido; para não disparar novamente, basta não modificá-lo. O `request_id` deve ser diferente em cada novo lote.

## Uso por prompt único

Exemplo de instrução suficiente:

> Implante completamente CAMISAS RETRÔ do PDF. Faça tudo até estar publicado e validado em produção.

O assistente deve localizar a fonte, preencher o pedido permanente, acompanhar a execução, corrigir falhas recuperáveis e somente retornar como concluído depois das guardas de banco e do E2E público.
