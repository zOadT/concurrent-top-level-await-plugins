import { defineConfig } from "vite-plus";
import macros from "unplugin-macros/rolldown";

export default defineConfig({
	lint: {
		jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
		rules: { "vite-plus/prefer-vite-plus-imports": "error" },
		options: { typeAware: true, typeCheck: true },
		ignorePatterns: ["**/test/examples/**/*.js"],
	},
	fmt: {
		useTabs: true,
		printWidth: 80,
		sortPackageJson: false,
		ignorePatterns: [
			// this file includes invalid syntax
			"packages/shared/test/examples/import-attributes/a.js",
		],
		overrides: [
			{
				files: ["*.json"],
				options: {
					useTabs: false,
				},
			},
		],
	},
	pack: {
		plugins: [macros()],
	},
	test: {
		projects: ["packages/*"],
	},
});
