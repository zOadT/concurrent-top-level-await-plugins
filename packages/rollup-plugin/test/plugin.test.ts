import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { CustomPluginOptions, rollup, RollupBuild } from "rollup";
import concurrentTopLevelAwait from "../src/index.js";
import { randomUUID } from "node:crypto";

async function runBundle(bundle: RollupBuild) {
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

	const exports = await import(
		path.join(__dirname, "dist", uuid, output[0].fileName)
	);

	await fs.rm(path.join(__dirname, "dist", uuid), {
		recursive: true,
		force: true,
	});

	process.off("trace", onTrace);

	return { exports, traces };
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
			"a after",
			"b after",
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

	it("respects isEntry in cycle", async () => {
		const bundle = await rollup({
			input: path.join(__dirname, "examples", "cyclic-entry", "index.js"),
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
			"index before",
			"index after",
		]);
	});
});
