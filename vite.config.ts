import * as path from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const projectRoot = __dirname;

export default defineConfig({
	root: path.resolve(projectRoot, "client"),
	plugins: [solid()],
	resolve: {
		alias: {
			"~": projectRoot,
		},
	},
	server: {
		port: 5173,
		proxy: {
			"/api": "http://127.0.0.1:3000",
			"/media": "http://127.0.0.1:3000",
		},
	},
	build: {
		outDir: path.resolve(projectRoot, "dist"),
		emptyOutDir: true,
	},
});
