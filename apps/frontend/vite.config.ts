import { defineConfig } from "vitest/config";
import solidPlugin from "vite-plugin-solid";
import checker from "vite-plugin-checker";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    tailwindcss(),
    solidPlugin(),
    checker({
      enableBuild: true,
    }),
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./setupVitest.ts"],
    env: {
      VITE_BACKEND_BASE_URL: "http://127.0.0.1:8000",
    },
    coverage: {
      enabled: true,
      reporter: ["text", "html"],
    },
    server: {
      deps: {
        inline: [/@kobalte\/.*/],
      },
    },
    deps: {
      optimizer: {
        web: {
          include: ["solid-js", "@solidjs/router"],
        },
      },
    },
  },
});
