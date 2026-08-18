import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // 手元の .env や実行時の環境変数に結果を左右されないよう固定する。
    // iron-session はパスワード32文字以上を要求するため長さも満たしておく。
    env: {
      SESSION_SECRET: "vitest-only-session-secret-0123456789abcdef",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
