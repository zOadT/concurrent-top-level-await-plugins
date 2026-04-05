import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { type Plugin, rollup, type RollupBuild } from "rollup";
import concurrentTopLevelAwait from "../src/index.js";
import {
	CallRecords,
	PluginTestConfig,
} from "../../shared/test/plugins.test.js";

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

	let exports, error: string | undefined;
	try {
		exports = await import(
			path.join(__dirname, "dist", uuid, output[0].fileName)
		);
	} catch (err) {
		traces.push(`Caught error: ${err}`);
		error = err as string;
	}

	await new Promise((resolve) => setTimeout(resolve, cooldown));

	await fs.rm(path.join(__dirname, "dist", uuid), {
		recursive: true,
		force: true,
	});

	process.off("trace", onTrace);

	return { exports, error, traces };
}

const attributesSpyPlugin = (
	pluginCalls: CallRecords,
	bundlerCalls: CallRecords,
): Plugin => ({
	name: "attributes-spy",
	resolveId(source, _importer, options) {
		if (source.startsWith("\0")) return null;
		if (source.endsWith("index.js")) return null;

		if (!(source in pluginCalls)) {
			pluginCalls[source] = options;
		} else if (!(source in bundlerCalls)) {
			bundlerCalls[source] = options;
		} else {
			throw new Error(`Unexpected multiple calls for ${source}`);
		}

		return null;
	},
});

export const rollupPluginTestConfig: PluginTestConfig<RollupBuild> = {
	name: "rollup-plugin",
	createBundle: async (options) => {
		const pluginCalls: CallRecords = {};
		const bundlerCalls: CallRecords = {};

		const bundle = await rollup({
			input: options.input,
			plugins: [
				options.trackResolveCalls
					? attributesSpyPlugin(pluginCalls, bundlerCalls)
					: null,
				concurrentTopLevelAwait({
					include: options.include ?? /\.js$/,
					exclude: options.exclude,
				}),
			],
		});

		return {
			bundle,
			pluginCalls,
			bundlerCalls,
		};
	},
	runBundle,
	flags: {
		ignoreOrderDynamicEntryCycleTest: true,
	},
};
