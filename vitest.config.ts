import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		setupFiles: ["tests/setup-env.ts", "tests/setup.ts"],
		globalSetup: "tests/global-setup.ts",
		pool: "forks",
		testTimeout: 15000,
		include: ["tests/**/*.test.ts"],
	},
	resolve: {
		alias: {
			"~": path.resolve(__dirname),
		},
	},
});
