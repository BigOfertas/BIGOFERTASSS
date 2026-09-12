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
  build: {
    // Production hardening: never ship source maps and keep the browser bundle
    // aggressively minified without changing application/business behavior.
    sourcemap: false,
    rolldownOptions: {
      // Rolldown otherwise attaches lightweight module/chunk debug metadata.
      experimental: {
        attachDebugInfo: "none",
      },
      output: {
        minify: {
          compress: {
            dropConsole: true,
            dropDebugger: true,
          },
        },
      },
    },
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
