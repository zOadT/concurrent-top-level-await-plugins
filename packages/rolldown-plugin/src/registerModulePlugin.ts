import type { Plugin } from "rolldown";
import tlaModule from "../../shared/src/registerSource.js";

export default function registerModulePlugin(options: {
	// TODO support filter function
	registerModuleSource: string;
}) {
	const registerModuleSource = options.registerModuleSource;

	return {
		name: "rolldown-plugin-concurrent-tla-plugin-register-module",
		// @ts-expect-error vite specific properties
		// vite serves modules as ES modules during dev and thus TLA gets handled natively
		apply: "build" as const,

		resolveId(source) {
			if (source === registerModuleSource) {
				return registerModuleSource;
			}
		},
		load(id) {
			if (id === registerModuleSource) {
				return tlaModule;
			}
		},
	} satisfies Plugin;
}
