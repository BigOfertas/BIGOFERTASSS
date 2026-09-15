import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = "https://bigofertas.net";
const SUPABASE_ORIGIN = "https://hootwcacnrtidfmqsvrn.supabase.co";
const AUTH_STORAGE_KEY = "sb-hootwcacnrtidfmqsvrn-auth-token";
const OUT = path.join(process.cwd(), "qa-checkout-address-dark");

const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  const userId = "11111111-2222-4333-8444-555555555555";
  const payload = {
    aud: "authenticated",
    exp: now + 86400,
    iat: now,
    sub: userId,
    email: "checkout-dark-qa@dropbox.local",
    role: "authenticated",
  };
  return {
    access_token: `${base64url({ alg: "none", typ: "JWT" })}.${base64url(payload)}.audit`,
    token_type: "bearer",
    expires_in: 86400,
    expires_at: now + 86400,
    refresh_token: "checkout-dark-qa-refresh",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "checkout-dark-qa@dropbox.local",
      email_confirmed_at: new Date().toISOString(),
      phone: "84999999999",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "Cliente QA" },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

function seededCart() {
  return {
    version: 2,
    items: [
      {
        lineId: "qa::variant::seed",
        productId: "11111111-1111-4111-8111-111111111111",
        productSlug: "produto-qa",
        variantId: "22222222-2222-4222-8222-222222222222",
        sku: "QA-G",
        name: "Produto QA",
        variantName: "Torcedor",
        unitPrice: 219.9,
        imageUrl: null,
        quantity: 2,
        availableStock: null,
        selectedOptions: [
          {
            optionId: "purchase-size",
            optionName: "Tamanho",
            optionKind: "size",
            valueId: "g",
            valueLabel: "G",
          },
        ],
        customization: {
          size: "G",
          personalization: null,
          phrase: null,
          patchCode: null,
          patchCodes: [],
        },
        status: "available",
      },
    ],
  };
}

const identity = {
  id: "11111111-2222-4333-8444-555555555555",
  email: "checkout-dark-qa@dropbox.local",
  full_name: "Cliente QA",
  person_type: "individual",
  phone: "84999999999",
  secondary_phone: null,
  cpf: "52998224725",
  cnpj: null,
  company_name: null,
  trade_name: null,
};

const profile = {
  id: identity.id,
  email: identity.email,
  full_name: identity.full_name,
  phone: identity.phone,
  cpf: identity.cpf,
};

const address = {
  id: "33333333-3333-4333-8333-333333333333",
  label: "Casa",
  recipient_name: "Cliente QA",
  postal_code: "59635000",
  street: "R. Maceió",
  number: "37",
  complement: null,
  neighborhood: "Nordeste",
  city: "Areia Branca",
  state: "RN",
  is_default: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

async function makeContext(browser, viewport) {
  const context = await browser.newContext({ viewport, colorScheme: "dark", locale: "pt-BR" });
  await context.addInitScript(
    ({ authKey, authValue, cartValue }) => {
      localStorage.setItem("dropbox-theme", "dark");
      localStorage.setItem("dropbox-locale", "pt");
      localStorage.setItem(authKey, JSON.stringify(authValue));
      localStorage.setItem("bigofertas_cart", JSON.stringify(cartValue));
    },
    { authKey: AUTH_STORAGE_KEY, authValue: fakeSession(), cartValue: seededCart() },
  );

  await context.route(`${SUPABASE_ORIGIN}/rest/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname.includes("/rpc/get_my_checkout_identity")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([identity]) });
      return;
    }
    if (pathname.includes("/rpc/get_my_customer_identity")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([profile]) });
      return;
    }
    if (pathname.includes("/rpc/list_my_customer_addresses")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([address]) });
      return;
    }
    if (pathname.includes("/rpc/validate_cart_items")) {
      let incoming = [];
      try {
        incoming = JSON.parse(request.postData() ?? "{}")?.p_items ?? [];
      } catch {
        incoming = [];
      }
      const rows = incoming.map((item) => ({
        line_id: item.line_id,
        product_id: item.product_id,
        product_slug: "produto-qa",
        product_name: "Produto QA",
        variant_id: item.variant_id,
        variant_sku: "QA-G",
        variant_name: "Torcedor",
        unit_price: 219.9,
        available_stock: null,
        customization: item.customization ?? {},
        status: "available",
      }));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows) });
      return;
    }
    if (pathname.includes("/user_roles")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }

    const accept = request.headers()["accept"] ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: accept.includes("object") ? "{}" : "[]",
    });
  });

  return context;
}

async function runViewport(browser, name, viewport) {
  const context = await makeContext(browser, viewport);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector("body", { timeout: 20_000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.querySelector("[data-initial-boot-splash]")?.remove();
    document.documentElement.classList.add("dark");
    document.body.style.overflow = "auto";
  });

  const useData = page.getByRole("button", { name: /Usar estes dados/i });
  await useData.waitFor({ state: "visible", timeout: 30_000 });
  await useData.click();
  await page.getByRole("heading", { name: /Endereço de entrega/i }).waitFor({ state: "visible", timeout: 15_000 });

  const card = page.locator("button.w-full.rounded-xl.border.p-4.text-left").filter({ hasText: "Casa" }).first();
  await card.waitFor({ state: "visible", timeout: 15_000 });
  const styles = await card.evaluate((el) => {
    const style = getComputedStyle(el);
    const strong = el.querySelector("strong");
    const paragraphs = [...el.querySelectorAll("p")];
    return {
      className: el.className,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderColor: style.borderColor,
      color: style.color,
      strongColor: strong ? getComputedStyle(strong).color : null,
      paragraphColors: paragraphs.map((p) => getComputedStyle(p).color),
    };
  });

  const expectedDarkGradient =
    styles.backgroundImage.includes("rgb(21, 17, 17)") &&
    styles.backgroundImage.includes("rgb(16, 16, 16)") &&
    styles.backgroundImage.includes("rgb(9, 9, 9)");
  const redBorder = styles.borderColor === "rgb(239, 68, 68)";
  const whiteTitle = styles.strongColor === "rgb(245, 245, 245)";
  const noPaleBackground = !styles.backgroundImage.includes("rgb(254, 242, 242)");
  const pass = expectedDarkGradient && redBorder && whiteTitle && noPaleBackground;

  await page.screenshot({ path: path.join(OUT, `checkout-address-${name}.png`), fullPage: true });
  await page.close();
  await context.close();
  return { viewport: name, pass, styles };
}

await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [name, viewport] of Object.entries(viewports)) {
    results.push(await runViewport(browser, name, viewport));
  }
} finally {
  await browser.close();
}

const summary = {
  production: BASE_URL,
  checks: results.length,
  passed: results.filter((result) => result.pass).length,
  failed: results.filter((result) => !result.pass).length,
};
await fs.writeFile(path.join(OUT, "report.json"), JSON.stringify({ summary, results }, null, 2) + "\n");
console.log(`CHECKOUT_ADDRESS_DARK_QA ${JSON.stringify(summary)}`);
for (const result of results) console.log(JSON.stringify(result));
if (summary.failed > 0) process.exitCode = 1;
