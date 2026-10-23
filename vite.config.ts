import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()], test: { include: ["src/**/*.{test,spec}.{ts,tsx}", "packages/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.test.mjs"], environment: "jsdom", setupFiles: ["./src/test-setup.ts"], clearMocks: true } });
