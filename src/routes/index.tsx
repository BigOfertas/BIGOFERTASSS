import { createFileRoute } from "@tanstack/react-router";

import bannerInferiorAsset from "@/assets/promos/banner-promo-inferior.png.asset.json";
import bannerSuperiorAsset from "@/assets/promos/banner-promo-superior.png.asset.json";
import BestSellers from "@/components/home/BestSellers";
import BrazilianProducts from "@/components/home/BrazilianProducts";
import BrazilianTeams from "@/components/home/BrazilianTeams";
import FAQ from "@/components/home/FAQ";
import ShopByLeague from "@/components/home/ShopByLeague";
import VisualCategories from "@/components/home/VisualCategories";
import Header from "@/components/layout/Header";
import PromoBanner from "@/components/layout/PromoBanner";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="app-shell flex min-h-screen flex-col">
      <PromoBanner
        id="superior"
        style={{ aspectRatio: "1920/100" }}
        className="max-h-[100px] max-md:!aspect-[1920/300] max-md:max-h-none"
        images={[bannerSuperiorAsset.url, bannerSuperiorAsset.url, bannerSuperiorAsset.url]}
        altText={`Ofertas ${BRAND.officialName}`}
      />

      <Header />

      <PromoBanner
        id="inferior"
        style={{ aspectRatio: "1920/550" }}
        className="max-h-[550px] max-md:!aspect-[1920/1897] max-md:max-h-none"
        images={[bannerInferiorAsset.url]}
        altText={`Campanha ${BRAND.officialName}`}
      />

      <main className="flex-grow overflow-x-hidden">
        <BestSellers />
        <VisualCategories />

        <div
          aria-hidden="true"
          className="ambient-band mx-auto my-2 flex min-h-40 w-full items-center justify-center overflow-hidden py-12 sm:min-h-44 sm:py-14 lg:min-h-52"
        >
          <span className="select-none font-black tracking-[-0.08em] text-gray-900/[0.035] text-[clamp(3.5rem,12vw,10rem)]">
            {BRAND.shortMark}
          </span>
        </div>

        <BrazilianTeams />
        <BrazilianProducts />
        <ShopByLeague />
        <FAQ />
      </main>
    </div>
  );
}
