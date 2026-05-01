import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["src/app/**", "src/tests/**", "src/mocks/**", "**/*.config.*"],
      thresholds: { lines: 50 },
    },
  },
});
