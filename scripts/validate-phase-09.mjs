import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const server = read("src/server.ts");
const serverRoute = read("src/routes/api.shipping.quote.ts");
const routeTree = read("src/routeTree.gen.ts");
const shippingServer = read("src/lib/shipping-server.ts");
const shippingClient = read("src/lib/shipping.ts");
const shippingUi = read("src/components/cart/ShippingCalculator.tsx");
const cart = read("src/routes/cart.tsx");

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check(
  "token SuperFrete fica exclusivamente no servidor",
  /SUPERFRETE_TOKEN/.test(shippingServer) &&
    /runtime\?\.cloudflare\?\.env/.test(shippingServer) &&
    /processEnvironment\.SUPERFRETE_TOKEN/.test(shippingServer) &&
    /process\.env\?\.\["SUPERFRETE_TOKEN"\]/.test(serverRoute) &&
    !/SUPERFRETE_TOKEN/.test(shippingClient) &&
    !/SUPERFRETE_TOKEN/.test(shippingUi) &&
    !/SUPERFRETE_TOKEN/.test(cart),
);

check(
  "endpoint de cotacao existe como server route e fallback do server entry",
  /createFileRoute\("\/api\/shipping\/quote"\)/.test(serverRoute) &&
    /POST:\s*async/.test(serverRoute) &&
    /handleShippingQuoteRequest/.test(serverRoute) &&
    /ApiShippingQuoteRouteImport/.test(routeTree) &&
    /\/api\/shipping\/quote/.test(server) &&
    /handleShippingQuoteRequest/.test(server) &&
    /cache-control.*no-store/i.test(shippingServer),
);

check(
  "SuperFrete usa endpoint real de producao e Bearer",
  /https:\/\/api\.superfrete\.com\/api\/v0\/calculator/.test(shippingServer) &&
    /authorization:\s*`Bearer \$\{input\.token\}`/.test(shippingServer) &&
    /user-agent/.test(shippingServer),
);

check(
  "origens comerciais estao congeladas por transportadora",
  /correiosOriginPostalCode:\s*"59655000"/.test(shippingServer) &&
    /loggiOriginPostalCode:\s*"59630508"/.test(shippingServer),
);

check(
  "somente PAC SEDEX e Loggi sao aceitos",
  /pacServiceId:\s*1/.test(shippingServer) &&
    /sedexServiceId:\s*2/.test(shippingServer) &&
    /loggiServiceId:\s*31/.test(shippingServer) &&
    !/Jadlog|Mini Envios|J&T/.test(shippingServer),
);

check(
  "adicionais fixos sao R$10 Correios e R$30 Loggi",
  /correiosFixedFee:\s*10/.test(shippingServer) &&
    /loggiFixedFee:\s*30/.test(shippingServer) &&
    /basePrice \+ additionalFee/.test(shippingServer),
);

check(
  "embalagem conservadora segue regra aprovada",
  /packageLengthCm:\s*40/.test(shippingServer) &&
    /packageWidthCm:\s*28/.test(shippingServer) &&
    /packageHeightCm:\s*5/.test(shippingServer) &&
    /packagingWeightGrams:\s*200/.test(shippingServer) &&
    /defaultShirtWeightGrams:\s*300/.test(shippingServer) &&
    /maxShirtsPerPackage:\s*3/.test(shippingServer) &&
    /Math\.ceil\(totalUnits \/ SHIPPING_CONFIG\.maxShirtsPerPackage\)/.test(shippingServer),
);

check(
  "peso enviado pelo cliente nao e confiado",
  /fetchTrustedProductWeights/.test(shippingServer) &&
    /select",\s*"id,weight_grams"/.test(shippingServer) &&
    /status",\s*"eq\.active"/.test(shippingServer) &&
    !/weightGrams/.test(shippingClient),
);

check(
  "cotacoes de Correios e Loggi usam origens independentes",
  /services:\s*`\$\{SHIPPING_CONFIG\.pacServiceId\},\$\{SHIPPING_CONFIG\.sedexServiceId\}`/.test(
    shippingServer,
  ) &&
    /services:\s*String\(SHIPPING_CONFIG\.loggiServiceId\)/.test(shippingServer) &&
    /Promise\.allSettled/.test(shippingServer),
);

check(
  "prazo de producao nao e misturado ao prazo da transportadora",
  /productionBusinessDays:\s*5/.test(shippingServer) &&
    /transitBusinessDays/.test(shippingServer) &&
    /O prazo acima é apenas o transporte e começa depois da produção/.test(shippingUi),
);

check(
  "carrinho oferece CEP e opcoes reais sem habilitar checkout provisório",
  /ShippingCalculator/.test(cart) &&
    /requestShippingQuotes/.test(shippingUi) &&
    /PAC, SEDEX e Loggi com cotação real/.test(shippingUi) &&
    /Finalização de compra indisponível/.test(cart),
);

check(
  "cliente recebe erro HTTP diagnostico quando endpoint nao retorna JSON",
  /SHIPPING_ROUTE_NOT_REACHED/.test(shippingClient) &&
    /SHIPPING_ADAPTER_RESPONSE_INVALID/.test(shippingClient) &&
    /x-bigofertas-shipping-handler/.test(shippingClient),
);

check(
  "falhas do backend retornam diagnostico JSON seguro",
  /SHIPPING_ENV_MISSING/.test(shippingServer) &&
    /SHIPPING_SUPABASE_CONFIG_MISSING/.test(shippingServer) &&
    /SHIPPING_SUPABASE_HTTP_ERROR/.test(shippingServer) &&
    /SHIPPING_SUPERFRETE_HTTP_ERROR/.test(shippingServer) &&
    /SHIPPING_SUPERFRETE_PARSE_ERROR/.test(shippingServer) &&
    /SHIPPING_ADAPTER_ERROR/.test(shippingServer) &&
    /x-bigofertas-shipping-handler/.test(shippingServer),
);

check(
  "nao existem valores ficticios de frete no frontend",
  !/PAC[^\n]{0,80}R\$\s*\d|SEDEX[^\n]{0,80}R\$\s*\d|Loggi[^\n]{0,80}R\$\s*\d/.test(
    `${shippingUi}\n${cart}`,
  ),
);

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`\n${failed} validação(ões) da Fase 09 falharam.`);
  process.exit(1);
}

console.log(`\n${checks.length}/${checks.length} validações da Fase 09 aprovadas.`);
