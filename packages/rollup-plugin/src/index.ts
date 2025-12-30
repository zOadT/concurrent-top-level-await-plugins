import type { Plugin } from "rollup";
import { createFilter, type FilterPattern } from "@rollup/pluginutils";
import MagicString from "magic-string";
import hasTopLevelAwait from "./hasTopLevelAwait.js";
import { AsyncModuleTracker } from "./AsyncModuleTracker.js";
import transform from "./transform.js";

export default function concurrentTopLevelAwait(
	options: {
		include?: FilterPattern;
		exclude?: FilterPattern;
		sourceMap?: boolean;
	} = {},
) {
	const filter = createFilter(options.include, options.exclude);

	const asyncTracker = new AsyncModuleTracker<string>();

	return {
		name: "rollup-plugin-concurrent-tla-plugin",
		// @ts-expect-error vite specific properties
		// vite serves modules as ES modules during dev and thus TLA gets handled natively
		apply: "build" as const,

		transform: {
			// filter: {
			// 	id: {
			// 		include: options.include ?? undefined,
			// 		exclude: options.exclude ?? undefined,
			// 	},
			// },
			async handler(code, id) {
				if (!filter(id)) return;

				const ast = this.parse(code);

				const importDeclarations = ast.body.filter(
					(a) => a.type === "ImportDeclaration",
				);

				const hasAwait = hasTopLevelAwait(ast);
				asyncTracker.setEntryAsync(id, hasAwait);
				if (hasAwait) {
					// we can skip adding dependencies here, as we know that the module is async anyway
					asyncTracker.setDependencies(id, []);
				} else {
					const childrenIds = (
						await Promise.all(
							importDeclarations.map(async (declaration) => {
								const importId = await this.resolve(
									declaration.source.value as string,
									id,
								);
								if (!importId || !filter(importId.id)) return null;
								return importId.id;
							}),
						)
					).filter((a) => a != null);

					asyncTracker.setDependencies(id, childrenIds);
				}

				const asyncImports = (
					await Promise.all(
						importDeclarations.map(async (declaration) => {
							// TODO avoid infinite recursion
							const importId = await this.resolve(
								declaration.source.value as string,
								id,
							);
							if (!importId || !filter(importId.id)) return null;
							// don't await load to not run into deadlock
							this.load(importId);
							if (!(await asyncTracker.isAsync(importId.id))) return null;
							return declaration;
						}),
					)
				).filter(Boolean);

				const isAsyncModule = asyncImports.length > 0 || hasAwait;
				if (!isAsyncModule) return;

				let s = new MagicString(code);

				s = transform(s, ast, asyncImports, hasAwait);

				return {
					code: s.toString(),
					map:
						options.sourceMap !== false ? s.generateMap({ hires: true }) : null,
				};
			},
		},
		resolveImportMeta(property, { moduleId }) {
			if (property !== "useTla") {
				return;
			}

			const moduleInfo = this.getModuleInfo(moduleId);
			const importers = moduleInfo?.importers;

			// TODO isEntry check required? check with rollup
			if (moduleInfo?.isEntry || !importers?.length) {
				return "true";
			}

			// module has to behave like an ordinary async module for modules not handled by the plugin
			if (importers.some((id) => !filter(id))) {
				return "true";
			}

			return "false";
		},
	} satisfies Plugin;
}
