import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,

    env: {
      GITHUB_TOKEN: "test-token-not-real",
    },
  },
});
