import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const FAVORITES_STORAGE_KEY = "bigofertas:favorites:v1";

export type FavoriteProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  promotionalPrice?: number | null;
  imageUrl?: string | null;
  time?: string | null;
  commercialType?: string | null;
};

type FavoritesContextValue = {
  favorites: FavoriteProduct[];
  count: number;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (product: FavoriteProduct) => void;
  removeFavorite: (id: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

function readStoredFavorites() {
  if (typeof window === "undefined") return [] as FavoriteProduct[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is FavoriteProduct =>
        Boolean(item) &&
        typeof item.id === "string" &&
        typeof item.slug === "string" &&
        typeof item.name === "string",
    );
  } catch {
    return [];
  }
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFavorites(readStoredFavorites());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  const isFavorite = useCallback(
    (id: string) => favorites.some((item) => item.id === id),
    [favorites],
  );

  const toggleFavorite = useCallback((product: FavoriteProduct) => {
    setFavorites((current) =>
      current.some((item) => item.id === product.id)
        ? current.filter((item) => item.id !== product.id)
        : [product, ...current.filter((item) => item.id !== product.id)],
    );
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(
    () => ({ favorites, count: favorites.length, isFavorite, toggleFavorite, removeFavorite }),
    [favorites, isFavorite, removeFavorite, toggleFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used within a FavoritesProvider");
  return context;
}
