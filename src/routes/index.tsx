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
    <div className="flex flex-col min-h-screen bg-white">
      <PromoBanner
        id="superior"
        style={{ aspectRatio: "1920/100" }}
        className="max-h-[100px] max-md:!aspect-[1920/300] max-md:max-h-none"
        images={[
          bannerSuperiorAsset.url,
          bannerSuperiorAsset.url,
          bannerSuperiorAsset.url,
        ]}
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
          style={{ aspectRatio: "1920/300" }}
          className="w-full max-h-[300px] max-md:!aspect-[1920/750] max-md:max-h-none bg-gray-100 overflow-hidden"
        >
          <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
            <span className="text-sm font-medium opacity-0">{BRAND.officialName}</span>
          </div>
        </div>

        <BrazilianTeams />
        <BrazilianProducts />
        <ShopByLeague />
        <FAQ />
      </main>
    </div>
  );
}
