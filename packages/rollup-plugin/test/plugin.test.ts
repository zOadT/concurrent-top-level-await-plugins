import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { CustomPluginOptions, rollup, RollupBuild } from "rollup";
import concurrentTopLevelAwait from "../src/index.js";
import { randomUUID } from "node:crypto";

async function runBundle(bundle: RollupBuild, cooldown = 0) {
	const uuid = randomUUID();
	const traces: string[] = [];

	const onTrace = (data: { message: string; uuid: string }) => {
		if (data.uuid === uuid) {
			traces.push(data.message);
		}
	};
	process.on("trace", onTrace);

	const { output } = await bundle.write({
		dir: path.join(__dirname, "dist", uuid),
		intro: `function trace(message) {
    process.emit("trace", { message, uuid: "${uuid}" });
}`,
	});

	let exports, error;
	try {
		exports = await import(
			path.join(__dirname, "dist", uuid, output[0].fileName)
		);
	} catch (err) {
		traces.push(`Caught error: ${err}`);
		error = err;
	}

	await new Promise((resolve) => setTimeout(resolve, cooldown));

	await fs.rm(path.join(__dirname, "dist", uuid), {
		recursive: true,
		force: true,
	});

	process.off("trace", onTrace);

	return { exports, error, traces };
}

describe("rollup-plugin", () => {
	it("basic test", async () => {
		const bundle = await rollup({
			input: path.join(__dirname, "examples", "basic", "index.js"),
			plugins: [
				concurrentTopLevelAwait({
					include: "**/*.js",
				}),
			],
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
		const bundle = await rollup({
			input: path.join(__dirname, "examples", "basic", "index.js"),
			plugins: [
				concurrentTopLevelAwait({
					include: "**/*.js",
					exclude: "**/index.js",
				}),
			],
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

	it("forwards import attributes to resolve", async () => {
		type CallRecords = Record<
			string,
			{
				attributes: Record<string, string>;
				custom?: CustomPluginOptions;
				importerAttributes?: Record<string, string> | undefined;
				isEntry: boolean;
			}
		>;
		const pluginCalls: CallRecords = {};
		const rollupCalls: CallRecords = {};

		await rollup({
			input: path.join(__dirname, "examples", "import-attributes", "index.js"),
			plugins: [
				{
					name: "attributes-spy",
					resolveId(source, _importer, options) {
						if (source.startsWith("\0")) return null;
						if (source.endsWith("index.js")) return null;

						if (!(source in pluginCalls)) {
							pluginCalls[source] = options;
						} else if (!(source in rollupCalls)) {
							rollupCalls[source] = options;
						} else {
							throw new Error(`Unexpected multiple calls for ${source}`);
						}

						return null;
					},
				},
				concurrentTopLevelAwait({
					include: "**/*.js",
				}),
			],
		});

		expect(pluginCalls).toStrictEqual(rollupCalls);
	});

	describe("dynamic imports", () => {
		it("handles dynamic imports", async () => {
			const bundle = await rollup({
				input: path.join(__dirname, "examples", "dynamic-imports", "index.js"),
				plugins: [
					concurrentTopLevelAwait({
						include: "**/*.js",
					}),
				],
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

		it("handles dynamic entry cycles", async () => {
			const bundle1 = await rollup({
				input: path.join(
					__dirname,
					"examples",
					"dynamic-cycle-entry",
					"index.js",
				),
				plugins: [
					concurrentTopLevelAwait({
						include: "**/*.js",
					}),
				],
			});
			// @ts-expect-error
			globalThis.path = 1;
			const { traces: traces1 } = await runBundle(bundle1);

			const bundle2 = await rollup({
				input: path.join(
					__dirname,
					"examples",
					"dynamic-cycle-entry",
					"index.js",
				),
				plugins: [
					concurrentTopLevelAwait({
						include: "**/*.js",
					}),
				],
			});
			// @ts-expect-error
			globalThis.path = 2;
			const { traces: traces2 } = await runBundle(bundle2);

			// order does not align with V8's module evaluation order
			expect(traces1.sort()).toEqual(
				[
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
				].sort(),
			);
			expect(traces2.sort()).toEqual(
				[
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
				].sort(),
			);
		});
	});

	it("correctly handles sync siblings", async () => {
		const bundle = await rollup({
			input: path.join(__dirname, "examples", "sync-siblings", "index.js"),
			plugins: [
				concurrentTopLevelAwait({
					include: "**/*.js",
				}),
			],
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
			const bundle = await rollup({
				input: path.join(__dirname, "examples", "cyclic", "index.js"),
				plugins: [
					concurrentTopLevelAwait({
						include: "**/*.js",
					}),
				],
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
			const bundle = await rollup({
				input: path.join(__dirname, "examples", "cyclic", "c.js"),
				plugins: [
					concurrentTopLevelAwait({
						include: "**/*.js",
					}),
				],
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
				const bundle = await rollup({
					input: path.join(
						__dirname,
						"examples",
						"error-handling",
						"noAwaitThrow.js",
					),
					plugins: [
						concurrentTopLevelAwait({
							include: "**/*.js",
						}),
					],
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
				const bundle = await rollup({
					input: path.join(
						__dirname,
						"examples",
						"error-handling",
						"directThrow.js",
					),
					plugins: [
						concurrentTopLevelAwait({
							include: "**/*.js",
						}),
					],
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
			const bundle = await rollup({
				input: path.join(
					__dirname,
					"examples",
					"error-handling",
					"syncThrow.js",
				),
				plugins: [
					concurrentTopLevelAwait({
						include: "**/*.js",
					}),
				],
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
			const bundle = await rollup({
				input: path.join(
					__dirname,
					"examples",
					"error-handling",
					"multipleThrows.js",
				),
				plugins: [
					concurrentTopLevelAwait({
						include: "**/*.js",
					}),
				],
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
			const bundle = await rollup({
				input: path.join(__dirname, "examples", "error-handling", "subtree.js"),
				plugins: [
					concurrentTopLevelAwait({
						include: "**/*.js",
					}),
				],
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
});
