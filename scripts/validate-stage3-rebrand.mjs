import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS - ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL - ${label}`);
  }
}

const env = read(".env");
const brand = read("src/config/brand.ts");
const header = read("src/components/layout/Header.tsx");
const footer = read("src/components/layout/Footer.tsx");
const faq = read("src/components/home/FAQ.tsx");
const contact = read("src/routes/contato.tsx");
const privacy = read("src/routes/privacidade.tsx");
const root = read("src/routes/__root.tsx");
const favicon = read("public/favicon.svg");
const email2fa = read("src/lib/email-2fa-server.ts");
const notificationEmail = read("src/lib/notification-email-server.ts");
const server = read("src/server.ts");
const edgeEnv = read("supabase/functions/.env.example");
const edge2fa = read("supabase/functions/auth-email-2fa/index.ts");
const edgeNotifications = read("supabase/functions/notifications-process/index.ts");

const publicBrandSurfaces = [
  [".env", env],
  ["src/config/brand.ts", brand],
  ["src/components/layout/Header.tsx", header],
  ["src/lib/email-2fa-server.ts", email2fa],
  ["src/lib/notification-email-server.ts", notificationEmail],
  ["src/server.ts", server],
  ["supabase/functions/.env.example", edgeEnv],
  ["supabase/functions/auth-email-2fa/index.ts", edge2fa],
  ["supabase/functions/notifications-process/index.ts", edgeNotifications],
];

check(
  "nome público do ambiente foi trocado para DropBox",
  /VITE_BRAND_NAME="DropBox"/.test(env) && !/VITE_BRAND_NAME="BIGofertas"/.test(env),
);

check(
  "fallback central de marca usa DropBox",
  /VITE_BRAND_NAME, "DropBox"/.test(brand) && !/VITE_BRAND_NAME, "BIGofertas"/.test(brand),
);

check(
  "placeholder visual do cabeçalho usa a marca centralizada",
  header.includes("{BRAND.shortMark}") && !header.includes(">BIG</span>"),
);

check(
  "remetentes transacionais usam DropBox sem inventar novo domínio",
  notificationEmail.includes('"DropBox <contato@bigofertas.net>"') &&
    server.includes('"DropBox <contato@bigofertas.net>"') &&
    edgeEnv.includes("RESEND_FROM=DropBox <contato@bigofertas.net>") &&
    edge2fa.includes('"DropBox <contato@bigofertas.net>"') &&
    edgeNotifications.includes('"DropBox <contato@bigofertas.net>"'),
);

check(
  "mensagens de autenticação foram reescritas com a nova marca",
  email2fa.includes("link enviado pela DropBox") &&
    email2fa.includes("Confirme seu acesso à DropBox") &&
    edge2fa.includes("link enviado pela DropBox") &&
    edge2fa.includes("Confirme seu acesso à DropBox"),
);

const legacyWordmarkFailures = publicBrandSurfaces.flatMap(([file, source]) =>
  /BIGofertas|BigOfertas|BIGOFERTAS/g.test(source) ? [file] : [],
);
check(
  "nenhuma superfície pública auditada mantém o wordmark BIGofertas",
  legacyWordmarkFailures.length === 0,
);

const articleSources = [
  faq,
  privacy,
  read("src/routes/termos-de-compra.tsx"),
  read("src/lib/product-seo.ts"),
  read("src/components/product/ProductSeo.tsx"),
  read("src/components/orders/OrderStatusBadge.tsx"),
].join("\n");
check(
  "artigos femininos da loja permanecem coerentes com DropBox",
  articleSources.includes("na ${BRAND.officialName}") &&
    articleSources.includes("a ${BRAND.officialName}") &&
    !articleSources.includes("no ${BRAND.officialName}") &&
    !articleSources.includes("o ${BRAND.officialName}"),
);

check(
  "domínio legado do e-mail não é exibido como texto na interface pública",
  contact.includes("Enviar e-mail para a DropBox") &&
    privacy.includes("enviar mensagem para a DropBox") &&
    faq.includes("use a página de contato") &&
    footer.includes("Fale por e-mail") &&
    !contact.includes(">{BRAND.contactEmail}<") &&
    !privacy.includes(">{BRAND.contactEmail}<") &&
    !footer.includes("\n                {BRAND.contactEmail}\n"),
);

check(
  "mailto operacional continua preservado sem inventar endereço novo",
  contact.includes('href={`mailto:${BRAND.contactEmail}`}') &&
    privacy.includes('href={`mailto:${BRAND.contactEmail}`}') &&
    footer.includes('href={`mailto:${BRAND.contactEmail}`}'),
);

check(
  "favicon público foi substituído por identidade DropBox",
  root.includes('{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }') &&
    !root.includes('/favicon.ico') &&
    !fs.existsSync("public/favicon.ico") &&
    favicon.includes('aria-label="DropBox"') &&
    favicon.includes('fill="#dc2626"'),
);

console.log(`\nSTAGE3_REBRAND_VALIDATION passed=${passed} failed=${failed}`);
if (failed > 0) process.exit(1);
