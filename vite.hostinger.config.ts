import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Build paralelo e independente para hospedagem estática na Hostinger.
// Não usa o preset Nitro/Cloudflare da configuração principal do staging.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: "/index.html",
          crawlLinks: false,
          retryCount: 0,
        },
      },
      prerender: {
        failOnError: true,
      },
    }),
    viteReact(),
  ],
});
