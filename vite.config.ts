import * as path from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const projectRoot = __dirname;
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3000";
const vitePort = Number(process.env.VITE_PORT ?? 5173);

export default defineConfig({
	root: path.resolve(projectRoot, "client"),
	plugins: [solid()],
	resolve: {
		alias: {
			"~": projectRoot,
		},
	},
	server: {
		host: process.env.VITE_HOST ?? "localhost",
		port: vitePort,
		strictPort: true,
		proxy: {
			"/api": apiTarget,
			"/media": apiTarget,
		},
	},
	build: {
		outDir: path.resolve(projectRoot, "dist"),
		emptyOutDir: true,
	},
});
