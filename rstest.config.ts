import { defineToolchainConfig } from "@a11ign/toolchain/rstest-config";

const config: ReturnType<typeof defineToolchainConfig> = defineToolchainConfig({
  root: import.meta.dirname,
  include: ["src/**/*.test.ts", "test/**/*.test.ts"],
});

export default config;
