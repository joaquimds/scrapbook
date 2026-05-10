import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		setupFiles: ["tests/client/setup-env.ts", "tests/client/setup.ts"],
		globalSetup: "tests/client/global-setup.ts",
		pool: "forks",
		testTimeout: 15000,
		include: ["tests/client/**/*.test.ts"],
	},
	resolve: {
		alias: {
			"~": path.resolve(__dirname),
		},
	},
});
