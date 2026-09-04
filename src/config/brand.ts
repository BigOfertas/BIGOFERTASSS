const readPublicBrandValue = (value: string | undefined, fallback: string) => {
  const normalized = value?.trim();
  return normalized || fallback;
};

const officialName = readPublicBrandValue(import.meta.env.VITE_BRAND_NAME, "BIGofertas");
const domain = readPublicBrandValue(import.meta.env.VITE_BRAND_DOMAIN, "bigofertas.net");
const siteUrl = readPublicBrandValue(
  import.meta.env.VITE_BRAND_SITE_URL,
  `https://${domain}`,
).replace(/\/+$/, "");
const contactEmail = readPublicBrandValue(
  import.meta.env.VITE_BRAND_CONTACT_EMAIL,
  `contato@${domain}`,
);
const whatsappDisplay = readPublicBrandValue(
  import.meta.env.VITE_BRAND_WHATSAPP_DISPLAY,
  "+55 (84) 9 8134-7939",
);
const whatsappUrl = readPublicBrandValue(
  import.meta.env.VITE_BRAND_WHATSAPP_URL,
  "https://wa.me/5584981347939",
);

const compactName = officialName.replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Identidade pública do storefront.
 *
 * Nunca espalhe nome, domínio ou contato da marca diretamente pelos componentes.
 * Toda UI pública deve consumir este objeto para que um rebranding seja feito em
 * um único ponto (ou por VITE_BRAND_* no ambiente de build).
 *
 * E-mails transacionais são configurados separadamente no backend/Resend e não
 * devem depender destas variáveis públicas do navegador.
 */
export const BRAND = Object.freeze({
  officialName,
  domain,
  siteUrl,
  contactEmail,
  whatsappDisplay,
  whatsappUrl,
  shortMark: (compactName.slice(0, 3) || officialName.slice(0, 3)).toUpperCase(),
  storeTitle: `${officialName} | Loja Esportiva`,
  storeDescription: `${officialName}: catálogo de artigos esportivos e produtos para torcedores.`,
});

export type BrandConfig = typeof BRAND;
