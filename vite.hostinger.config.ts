import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Build paralelo para hospedagem estática na Hostinger.
// A build padrão continua intacta enquanto o Cloudflare Worker é usado no staging.
export default defineConfig({
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/index.html",
        crawlLinks: false,
        retryCount: 0,
      },
    },
  },
});
