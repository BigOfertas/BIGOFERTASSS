# Coletor Google Photos - BIGofertas

O coletor percorre um album publico do Google Photos em navegador real (Chromium/Playwright), identifica o container interno de rolagem, percorre o album ate estabilizar, captura as imagens do catalogo em ordem visual e registra os URLs diretos servidos pelo Google.

## Saidas

- `collector.json`: relatorio completo com imagens, titulos, grupos, ordem visual e dados de auditoria.
- `groups.json`: grupos `titulo -> imagens` prontos para o normalizador do catalogo.
- `direct-image-urls.txt`: URLs exatamente observadas no Google Photos.
- `high-quality-image-urls.txt`: os mesmos arquivos solicitados em alta resolucao (`w4096-h4096-s-no-gm`).
- `page-final.png`: captura de diagnostico da ultima tela carregada.

O coletor separa midias de interface/capa das imagens reais do catalogo usando posicao no album e dimensoes visuais. Titulos duplicados pelo DOM do Google Photos sao consolidados antes do agrupamento.

## Regra de operacao

Os prints enviados pelo usuario continuam sendo o gabarito humano para interpretar produto-base, versoes e variacoes. O coletor automatiza a parte mecanica: abrir album, rolar, identificar titulos, capturar URLs e associar as imagens ao titulo anterior.

Se alguma imagem ficar sem titulo, a execucao falha em vez de cadastrar silenciosamente um produto incorreto.

## GitHub Actions

O workflow `Google Photos Catalog Collector` e disparado manualmente informando URL publica do album, rotulo do lote, minimo esperado de imagens e limite de rolagens. O resultado e publicado como artifact da execucao. Nenhum login do Google e necessario para albuns publicos e nenhuma credencial do Google e armazenada no repositorio.

## Execucao local

```bash
npm install --no-save playwright
npx playwright install chromium
node scripts/google-photos-collector.mjs \
  --url "https://photos.google.com/share/..." \
  --label "TOP 10 LANCAMENTOS" \
  --expected-min-images 50
```

## Prova real - Top 10 Lançamentos

A versao final foi validada contra o album real `[26/27] TOP 10 LANÇAMENTOS DO ANO` no workflow run `34368646867`: 55 midias Google observadas, 5 midias de interface/capa descartadas, 50 imagens de produto mantidas, 10 titulos consolidados, 10 grupos, 5 imagens em cada grupo, 0 imagens sem titulo e workflow concluido com sucesso.

Os grupos validados foram Chelsea I, Chelsea II, Manchester City II, Bayern I, Bayern II, Barcelona II, PSG I, Lyon II, Milan II e Napoli I, todos com cinco imagens.

## Estado

Coletor concluido e pronto para uso nos lotes do catalogo. A proxima camada e o normalizador/cadastro: receber o gabarito dos prints, consumir `groups.json`, gerar produto-base/variacoes/descricao/P000XXX e gravar os produtos no Supabase.

## Seguranca

O coletor aceita apenas URLs HTTPS de `photos.google.com` ou `photos.app.goo.gl`. A coleta e somente leitura: nao apaga, altera ou envia arquivos ao Google Photos.
