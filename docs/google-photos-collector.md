# Coletor Google Photos - BIGofertas

O coletor percorre um album publico do Google Photos em navegador real (Chromium/Playwright), rola a pagina ate estabilizar, captura as imagens do catalogo em ordem visual e registra os URLs diretos `googleusercontent.com`.

## Saidas

- `collector.json`: relatorio completo, ordem das imagens, candidatos de titulo e agrupamento automatico.
- `direct-image-urls.txt`: URLs diretos exatamente observados no navegador.
- `high-quality-image-urls.txt`: mesmas imagens com parametro de alta resolucao para uso no catalogo.
- `page-text-observations.json`: textos observados durante a rolagem, usados para auditoria e associacao com os prints.
- `page-final.html` e `page-final.png`: diagnostico da ultima tela carregada.

## Regra de operacao

Os prints enviados pelo usuario continuam sendo o gabarito humano para produto-base e variacoes. O coletor nao inventa agrupamentos quando os titulos do Google Photos estiverem ambiguos. O JSON preserva a ordem e permite associar os URLs capturados aos grupos dos prints.

## GitHub Actions

O workflow `Google Photos Catalog Collector` pode ser disparado manualmente informando:

- URL publica do album;
- rotulo do lote;
- minimo esperado de imagens;
- limite de rolagens.

O resultado e publicado como artifact da execucao. Nenhum login do Google e necessario para albuns publicos e nenhuma credencial do Google e armazenada no repositorio.

## Execucao local

```bash
npm install --no-save playwright
npx playwright install chromium
node scripts/google-photos-collector.mjs --url "https://photos.google.com/share/..." --label "TOP 10 LANCAMENTOS" --expected-min-images 40
```

## Seguranca

O coletor aceita apenas URLs HTTPS de `photos.google.com` ou `photos.app.goo.gl`. URLs de imagens sao aceitas somente de hosts `googleusercontent.com`. O processo e somente leitura: ele nao apaga, altera ou envia arquivos ao Google Photos.
