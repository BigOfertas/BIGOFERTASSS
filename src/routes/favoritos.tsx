import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

import Header from "@/components/layout/Header";
import ProductCard from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/context/FavoritesContext";

export const Route = createFileRoute("/favoritos")({
  component: FavoritesPage,
});

function FavoritesPage() {
  const { favorites } = useFavorites();

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-12 lg:px-8">
        <nav
          className="mb-6 flex items-center gap-2 text-xs font-medium text-gray-500"
          aria-label="Breadcrumb"
        >
          <Link to="/" className="hover:text-red-600">
            Início
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-gray-900" aria-current="page">
            Favoritos
          </span>
        </nav>

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Sua seleção</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-950">Favoritos</h1>
          <p className="mt-2 text-sm text-gray-500">
            Guarde produtos para comparar e voltar neles depois.
          </p>
        </div>

        {favorites.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
            {favorites.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                slug={product.slug}
                name={product.name}
                price={product.price}
                promotionalPrice={product.promotionalPrice}
                imageUrl={product.imageUrl}
                time={product.time}
                commercialType={product.commercialType}
              />
            ))}
          </div>
        ) : (
          <section className="mx-auto flex max-w-lg flex-col items-center py-20 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <Heart className="h-9 w-9 text-red-300" />
            </div>
            <h2 className="text-2xl font-black text-gray-950">Nenhum favorito ainda</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
              Toque no coração dos produtos que você quer guardar. Eles ficarão reunidos aqui neste
              aparelho.
            </p>
            <Button asChild className="mt-6 bg-red-600 px-6 font-black text-white hover:bg-black">
              <Link to="/products" search={{}}>
                Explorar produtos
              </Link>
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}
