import { useQuery } from "@tanstack/react-query";

import { fetchStorefrontPersonalization } from "@/lib/site-personalization";

export function useStorefrontPersonalization() {
  return useQuery({
    queryKey: ["storefront-personalization"],
    queryFn: fetchStorefrontPersonalization,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
