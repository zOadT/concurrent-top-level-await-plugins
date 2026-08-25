import { describe, expect, it } from "vite-plus/test";
import path from "node:path";

import { rollupPluginTestConfig } from "../../rollup-plugin/test/testConfig.js";
import { rolldownPluginTestConfig } from "../../rolldown-plugin/test/testConfig.js";

export type CallRecords = Record<
	string,
	{
		attributes: Record<string, string>;
		custom?: unknown;
		importerAttributes?: Record<string, string> | undefined;
		isEntry: boolean;
	}
>;

export type PluginTestConfig<TBundle, TPlugin> = {
	name: string;
	createBundle: (options: {
		input: string;
		include?: RegExp;
		exclude?: RegExp;
		external?: RegExp;
		plugins?: TPlugin[];
	}) => Promise<{ bundle: TBundle }>;
	runBundle: (
		bundle: TBundle,
		cooldown?: number,
	) => Promise<{ traces: string[]; error?: string }>;
	/** Records the options every `resolveId` call is made with. */
	attributesSpyPlugin: (
		pluginCalls: CallRecords,
		bundlerCalls: CallRecords,
	) => TPlugin;
	/**
	 * Simulates a module that cannot be loaded, either by throwing
	 * or by returning source that cannot be parsed.
	 */
	breakDependencyPlugin: (
		brokenModule: string,
		loadBrokenModule: () => string,
	) => TPlugin;
	flags: {
		skipImportAttributesTest?: boolean;
		ignoreOrderDynamicEntryCycleTest?: boolean;
		skipDynamicEntryCycleTest?: boolean;
	};
};

describe.each<PluginTestConfig<any, any>>([
	rollupPluginTestConfig,
	rolldownPluginTestConfig,
])(
	"$name",
	({
		createBundle,
		runBundle,
		attributesSpyPlugin,
		breakDependencyPlugin,
		flags: {
			ignoreOrderDynamicEntryCycleTest = false,
			skipDynamicEntryCycleTest = false,
			skipImportAttributesTest = false,
		},
	}) => {
		it("basic test", async () => {
			const { bundle } = await createBundle({
				input: path.join(__dirname, "examples", "basic", "index.js"),
			});

			const { traces } = await runBundle(bundle);

			expect(traces).toEqual([
				"a before",
				"b before",
				"c before",
				"d before",
				"a after",
				"b after",
				"ab before",
				"c after",
				"d after",
				"cd before",
				"ab after",
				"cd after",
				"index before",
				"index after",
			]);
		});

		it("import from exclude test", async () => {
			const { bundle } = await createBundle({
				input: path.join(__dirname, "examples", "basic", "index.js"),
				include: /\.js$/,
				exclude: /index\.js$/,
			});

			const { traces } = await runBundle(bundle);

			expect(traces).toEqual([
				"a before",
				"b before",
				"a after",
				"b after",
				"ab before",
				"ab after",
				"c before",
				"d before",
				"c after",
				"d after",
				"cd before",
				"cd after",
				"index before",
				"index after",
			]);
		});

		it.skipIf(skipImportAttributesTest)(
			"forwards import attributes to resolve",
			async () => {
				const pluginCalls: CallRecords = {};
				const bundlerCalls: CallRecords = {};

				const { bundle } = await createBundle({
					input: path.join(
						__dirname,
						"examples",
						"import-attributes",
						"index.js",
					),
					include: /\.js$/,
					plugins: [attributesSpyPlugin(pluginCalls, bundlerCalls)],
				});

				await runBundle(bundle);

				expect(Object.keys(pluginCalls).length).toBeGreaterThan(0);
				expect(pluginCalls).toStrictEqual(bundlerCalls);
			},
		);

		describe("dynamic imports", () => {
			it("handles dynamic imports", async () => {
				const { bundle } = await createBundle({
					input: path.join(
						__dirname,
						"examples",
						"dynamic-imports",
						"index.js",
					),
					include: /\.js$/,
				});

				const { traces } = await runBundle(bundle);

				expect(traces).toEqual([
					"index before",
					"a before",
					"b before",
					"b in between",
					"b after",
					"a after",
					"a",
					"b",
					"index after",
				]);
			});

			it.skipIf(skipDynamicEntryCycleTest)(
				"handles dynamic entry cycles",
				async () => {
					const { bundle: bundle1 } = await createBundle({
						input: path.join(
							__dirname,
							"examples",
							"dynamic-cycle-entry",
							"index.js",
						),
						include: /\.js$/,
					});
					// @ts-expect-error
					globalThis.path = 1;
					const { traces: traces1 } = await runBundle(bundle1);

					const { bundle: bundle2 } = await createBundle({
						input: path.join(
							__dirname,
							"examples",
							"dynamic-cycle-entry",
							"index.js",
						),
					});
					// @ts-expect-error
					globalThis.path = 2;
					const { traces: traces2 } = await runBundle(bundle2);

					function sortIfFlagged(traces: string[]) {
						return ignoreOrderDynamicEntryCycleTest ? traces.sort() : traces;
					}

					// order does not align with V8's module evaluation order
					expect(sortIfFlagged(traces1)).toEqual(
						sortIfFlagged([
							"index before",
							"d before",
							"d in between",
							"d after",
							"c before",
							"c in between",
							"c after",
							"b before",
							"b in between",
							"b after",
							"a before",
							"a in between",
							"a after",
							"index after",
						]),
					);
					expect(sortIfFlagged(traces2)).toEqual(
						sortIfFlagged([
							"index before",
							"b before",
							"b in between",
							"b after",
							"a before",
							"a in between",
							"a after",
							"d before",
							"d in between",
							"d after",
							"c before",
							"c in between",
							"c after",
							"index after",
						]),
					);
				},
			);
		});

		describe("external modules", () => {
			it("correctly handles unresolved modules", async () => {
				const { bundle } = await createBundle({
					input: path.join(
						__dirname,
						"examples",
						"external-module",
						"index.js",
					),
					include: /\.js$/,
				});

				await runBundle(bundle);
			});

			it("correctly handles external modules", async () => {
				const { bundle } = await createBundle({
					input: path.join(
						__dirname,
						"examples",
						"external-module",
						"index.js",
					),
					include: /\.js$/,
					external: /external/,
				});

				await runBundle(bundle);
			});
		});

		it("correctly handles sync siblings", async () => {
			const { bundle } = await createBundle({
				input: path.join(__dirname, "examples", "sync-siblings", "index.js"),
				include: /\.js$/,
			});

			const { traces } = await runBundle(bundle);

			expect(traces).toEqual([
				"a before",
				"b before",
				"c before",
				"a after",
				"b in between",
				"c after",
				"b after",
				"index before",
				"index after",
			]);
		});

		describe("cycles", () => {
			it("handles cycles", async () => {
				const { bundle } = await createBundle({
					input: path.join(__dirname, "examples", "cyclic", "index.js"),
					include: /\.js$/,
				});

				const { traces } = await runBundle(bundle);

				expect(traces).toEqual([
					"c before",
					"c after",
					"b before",
					"b after",
					"a before",
					"a after",
					"index before",
					"index after",
				]);
			});

			it("respects isEntry in cycle", async () => {
				const { bundle } = await createBundle({
					input: path.join(__dirname, "examples", "cyclic", "c.js"),
					include: /\.js$/,
				});

				const { traces } = await runBundle(bundle);

				expect(traces).toEqual([
					"b before",
					"b after",
					"a before",
					"a after",
					"c before",
					"c after",
				]);
			});
		});

		describe("error handling", () => {
			describe("executes modules after a sibling throws", () => {
				it("handles sync modules", async () => {
					const { bundle } = await createBundle({
						input: path.join(
							__dirname,
							"examples",
							"error-handling",
							"noAwaitThrow.js",
						),
						include: /\.js$/,
					});

					const { error, traces } = await runBundle(bundle, 200);

					expect(error).toBe("no await error");

					expect(traces).toEqual([
						"sync1",
						"sync2",
						"sync3",
						"noAwait1",
						"noAwaitThrow",
						"noAwait2",
						"noAwait3",
						"Caught error: no await error",
					]);
				});

				it("handles async modules", async () => {
					const { bundle } = await createBundle({
						input: path.join(
							__dirname,
							"examples",
							"error-handling",
							"directThrow.js",
						),
						include: /\.js$/,
					});

					const { error, traces } = await runBundle(bundle, 200);

					expect(error).toBe("direct error");

					expect(traces).toEqual([
						"sync1",
						"directThrow",
						"sync2",
						"sync3",
						"noAwait1",
						"noAwait2",
						"noAwait3",
						"Caught error: direct error",
					]);
				});
			});

			it("sync throw stops module evaluation", async () => {
				const { bundle } = await createBundle({
					input: path.join(
						__dirname,
						"examples",
						"error-handling",
						"syncThrow.js",
					),
					include: /\.js$/,
				});

				const { error, traces } = await runBundle(bundle, 200);

				expect(error).toBe("sync error");

				expect(traces).toEqual([
					"sync1",
					"delayedThrow",
					"sync2",
					"directThrow",
					"syncThrow",
					"noAwait1",
					"noAwait2",
					"Caught error: sync error",
				]);
			});

			it("respects order of thrown errors", async () => {
				const { bundle } = await createBundle({
					input: path.join(
						__dirname,
						"examples",
						"error-handling",
						"multipleThrows.js",
					),
					include: /\.js$/,
				});

				const { error, traces } = await runBundle(bundle, 200);

				expect(error).toBe("direct error");

				expect(traces).toEqual([
					"delayedThrow",
					"directThrow",
					"noAwait1",
					"noAwait2",
					"noAwait3",
					"Caught error: direct error",
				]);
			});

			it("Does not abort subtrees", async () => {
				const { bundle } = await createBundle({
					input: path.join(
						__dirname,
						"examples",
						"error-handling",
						"subtree.js",
					),
					include: /\.js$/,
				});

				const { error, traces } = await runBundle(bundle, 200);

				expect(error).toBe("delayed error");

				expect(traces).toEqual([
					"delayedThrow",
					"before subtree grandchildren",
					"after subtree grandchildren",
					"before subtree child",
					"Caught error: delayed error",
					"after subtree child",
					"before subtree",
					"after subtree",
				]);
			});
		});

		describe("unloadable dependencies", () => {
			const input = path.join(
				__dirname,
				"examples",
				"unloadable-module",
				"index.js",
			);

			const LOAD_FAILURE_MESSAGE = "simulated load failure";

			async function buildAndCollectUnhandledRejections(
				loadBrokenModule: () => string,
			) {
				const unhandledRejections: string[] = [];
				const onUnhandledRejection = (reason: unknown) => {
					unhandledRejections.push(String(reason));
				};
				process.on("unhandledRejection", onUnhandledRejection);

				try {
					let error: string | undefined;
					try {
						// rollup reports the failure when building the module graph,
						// rolldown only once the bundle is generated
						const { bundle } = await createBundle({
							input,
							include: /\.js$/,
							plugins: [breakDependencyPlugin("mod.js", loadBrokenModule)],
						});
						({ error } = await runBundle(bundle));
					} catch (err) {
						error = String((err as Error).message ?? err);
					}

					// give a floating rejection a chance to surface
					await new Promise((resolve) => setTimeout(resolve, 50));

					return { error, unhandledRejections };
				} finally {
					process.off("unhandledRejection", onUnhandledRejection);
				}
			}

			it("reports a dependency whose load hook throws", async () => {
				const { error, unhandledRejections } =
					await buildAndCollectUnhandledRejections(() => {
						throw new Error(LOAD_FAILURE_MESSAGE);
					});

				expect(unhandledRejections).toEqual([]);
				expect(error).toBeDefined();
				expect(error).toContain(LOAD_FAILURE_MESSAGE);
				expect(error).not.toContain("Unexpected early exit");
			});

			it("reports a dependency that cannot be parsed", async () => {
				const { error, unhandledRejections } =
					await buildAndCollectUnhandledRejections(
						() => "export const x = await ((((;",
					);

				expect(unhandledRejections).toEqual([]);
				expect(error).toBeDefined();
				expect(error).not.toContain("Unexpected early exit");
			});
		});
	},
);
