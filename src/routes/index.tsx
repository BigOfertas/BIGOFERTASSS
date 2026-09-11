import { createFileRoute } from "@tanstack/react-router";

import bannerInferiorAsset from "@/assets/promos/banner-promo-inferior.png.asset.json";
import BestSellers from "@/components/home/BestSellers";
import BrazilianTeams from "@/components/home/BrazilianTeams";
import FAQ from "@/components/home/FAQ";
import ShopByLeague from "@/components/home/ShopByLeague";
import VisualCategories from "@/components/home/VisualCategories";
import Header from "@/components/layout/Header";
import PromoBanner from "@/components/layout/PromoBanner";
import { BRAND } from "@/config/brand";
import homeLaunchesSnapshot from "@/generated/home-launches";
import { useStorefrontPersonalization } from "@/hooks/useStorefrontPersonalization";
import type { Json } from "@/integrations/supabase/types";
import { parseCatalogPage } from "@/lib/catalog";

const TOP_BANNER_DESKTOP = "/assets/promos/top-banner-desktop.webp";
const TOP_BANNER_MOBILE = "/assets/promos/top-banner-mobile.webp";
const STATIC_HOME_LAUNCHES = parseCatalogPage(homeLaunchesSnapshot as unknown as Json);

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { data: personalization } = useStorefrontPersonalization();

  const topDesktop = personalization?.top_banner_desktop?.url ?? TOP_BANNER_DESKTOP;
  const topMobile = personalization?.top_banner_mobile?.url ?? TOP_BANNER_MOBILE;
  const heroDesktop = personalization?.hero_desktop?.url ?? bannerInferiorAsset.url;
  const heroMobile = personalization?.hero_mobile?.url ?? heroDesktop;
  const ambientDesktop = personalization?.ambient_banner_desktop?.url;
  const ambientMobile = personalization?.ambient_banner_mobile?.url;

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <div className="hidden md:block">
        <PromoBanner
          id="superior"
          style={{ aspectRatio: "1920/100" }}
          images={[topDesktop, topDesktop, topDesktop]}
          altText={`Ofertas ${BRAND.officialName}`}
          priority
        />
      </div>

      <div className="md:hidden">
        <PromoBanner
          id="superior"
          style={{ aspectRatio: "1080/169" }}
          images={[topMobile, topMobile, topMobile]}
          altText={`Ofertas ${BRAND.officialName}`}
          priority
        />
      </div>

      <Header />

      <div className="hidden md:block">
        <PromoBanner
          id="inferior"
          style={{ aspectRatio: "1920/550" }}
          images={[heroDesktop]}
          altText={`Campanha ${BRAND.officialName}`}
          priority
        />
      </div>
      <div className="md:hidden">
        <PromoBanner
          id="inferior"
          style={{ aspectRatio: "1080/1067" }}
          images={[heroMobile]}
          altText={`Campanha ${BRAND.officialName}`}
          priority
        />
      </div>

      <main className="flex-grow overflow-x-hidden">
        <BestSellers initialData={STATIC_HOME_LAUNCHES} />
        <VisualCategories />

        {ambientDesktop || ambientMobile ? (
          <div className="mx-auto my-2 w-full max-w-[1920px] overflow-hidden bg-gray-100">
            <picture>
              {ambientMobile ? <source media="(max-width: 767px)" srcSet={ambientMobile} /> : null}
              <img
                src={ambientDesktop ?? ambientMobile ?? undefined}
                alt={`Arte promocional ${BRAND.officialName}`}
                loading="lazy"
                decoding="async"
                width={1920}
                height={208}
                className="hidden h-auto w-full object-cover md:block"
              />
              {ambientMobile ? (
                <img
                  src={ambientMobile}
                  alt={`Arte promocional ${BRAND.officialName}`}
                  loading="lazy"
                  decoding="async"
                  width={1080}
                  height={443}
                  className="h-auto w-full object-cover md:hidden"
                />
              ) : null}
            </picture>
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="ambient-band mx-auto my-2 flex min-h-28 w-full items-center justify-center overflow-hidden py-7 max-md:min-h-32 max-md:py-9 md:min-h-36 md:py-10 lg:min-h-40"
          >
            <span className="select-none font-black tracking-[-0.08em] text-gray-900/[0.035] text-[clamp(3.5rem,12vw,10rem)]">
              {BRAND.shortMark}
            </span>
          </div>
        )}

        <BrazilianTeams />
        <ShopByLeague />
        <FAQ />
      </main>
    </div>
  );
}
