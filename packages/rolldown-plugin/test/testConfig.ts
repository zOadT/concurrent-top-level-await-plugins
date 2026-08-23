import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { type Plugin, rolldown, type RolldownBuild } from "rolldown";
import concurrentTopLevelAwait from "../src/index.js";
import {
	CallRecords,
	PluginTestConfig,
} from "../../shared/test/plugins.test.js";

async function runBundle(bundle: RolldownBuild, cooldown = 0) {
	const uuid = randomUUID();
	const traces: string[] = [];

	const onTrace = (data: { message: string; uuid: string }) => {
		if (data.uuid === uuid) {
			traces.push(data.message);
		}
	};
	process.on("trace", onTrace);

	try {
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
			error = err as string;
			traces.push(`Caught error: ${error}`);
		}

		await new Promise((resolve) => setTimeout(resolve, cooldown));

		await fs.rm(path.join(__dirname, "dist", uuid), {
			recursive: true,
			force: true,
		});

		return { exports, error, traces };
	} finally {
		process.off("trace", onTrace);
	}
}

const attributesSpyPlugin = (
	pluginCalls: CallRecords,
	bundlerCalls: CallRecords,
): Plugin => {
	return {
		name: "attributes-spy",
		resolveId: {
			order: "pre",
			handler(source, _importer, options) {
				if (source.startsWith("\0")) return null;
				if (source.endsWith("index.js")) return null;

				if (!(source in pluginCalls)) {
					// @ts-expect-error
					pluginCalls[source] = options;
				} else if (!(source in bundlerCalls)) {
					// @ts-expect-error
					bundlerCalls[source] = options;
				} else {
					throw new Error(`Unexpected multiple calls for ${source}`);
				}

				return null;
			},
		},
	};
};

const breakDependencyPlugin = (
	brokenModule: string,
	loadBrokenModule: () => string,
): Plugin => ({
	name: "break-dependency",
	load(id) {
		if (id.startsWith("\0") || !id.endsWith(brokenModule)) return null;
		return loadBrokenModule();
	},
});

export const rolldownPluginTestConfig: PluginTestConfig<RolldownBuild, Plugin> =
	{
		name: "rolldown-plugin",
		createBundle: async (options) => {
			const bundle = await rolldown({
				experimental: { nativeMagicString: true },
				input: options.input,
				external: options.external,
				plugins: [
					...(options.plugins ?? []),
					concurrentTopLevelAwait({
						include: options.include ?? /\.js$/,
						exclude: options.exclude,
					}),
				],
			});

			return { bundle };
		},
		runBundle,
		attributesSpyPlugin,
		breakDependencyPlugin,
		flags: {
			skipImportAttributesTest: true,
			skipDynamicEntryCycleTest: true,
		},
	};
