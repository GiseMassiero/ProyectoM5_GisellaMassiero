import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // GITHUB_TOKEN "falso" para que los tests nunca dependan de tener
    // un .env real (ni de tu token de verdad): todas las llamadas a
    // Octokit están mockeadas, este valor solo evita que
    // src/config/env.ts tire error al cargarse.
    env: {
      GITHUB_TOKEN: "test-token-not-real",
    },
  },
});
