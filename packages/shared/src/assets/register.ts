type Access = {
	/**
	 * Evaluates the module if necessary and reports completion. Compatible
	 * with a promise executor (`new Promise(access.evaluate)`).
	 */
	evaluate: (whenDone?: () => void, onError?: (error: unknown) => void) => void;
	/** Accessors for the modules this module imports (see `register`). */
	dependencies: (() => Access)[];
	/**
	 * Resolves once this module and every module reachable from it through
	 * its imports have been evaluated. Rejects if any of them failed.
	 */
	settled: () => Promise<void>;
};

export default function register(
	fn: () => void | Promise<void>,
	evaluate_accesses: (() => Access)[],
) {
	let state: "ready" | "busy" | "done" | "failed" = "ready";
	let whenDones: (() => void)[] = [];
	let whenErrors: ((error: unknown) => void)[] = [];
	let remaining = 1;
	let error: unknown = undefined;

	// evaluate eagerly
	evaluate();

	const access: Access = {
		evaluate,
		dependencies: evaluate_accesses,
		settled,
	};
	return access;

	// Modules are registered eagerly, so when `evaluate` wires up the imports
	// below, any import that is part of a cycle and declared later in the chunk
	// is not available yet and gets skipped. Awaiting `evaluate` alone therefore
	// only covers the imports declared before this module. This is called
	// lazily by the entry proxy (after the whole chunk has been declared), so it
	// can collect the complete import closure, including the cyclic imports.
	function settled() {
		const visited = new Set<Access>([access]);
		const promises: Promise<void>[] = [];
		for (const module of visited) {
			promises.push(new Promise(module.evaluate));
			for (const dependencyAccess of module.dependencies) {
				try {
					// see the comment in `evaluate`
					const dependency = dependencyAccess();
					if (dependency != null) visited.add(dependency);
				} catch {}
			}
		}
		return Promise.all(promises).then(() => {});
	}

	function evaluate(whenDone?: () => void, onError?: (error: unknown) => void) {
		if (state === "done") {
			if (whenDone) whenDone();
			return;
		}
		if (state === "failed") {
			if (onError) onError(error);
			return;
		}
		if (whenDone) whenDones.push(whenDone);
		if (onError) whenErrors.push(onError);
		if (state === "busy") {
			return;
		}
		state = "busy";

		let moduleDone = () => {
			state = "done";
			for (let x of whenDones) x();
		};
		let moduleError = (err: unknown) => {
			state = "failed";
			error = err;
			for (let x of whenErrors) x(err);
		};
		let importDone = () => {
			if (state !== "busy") return;
			if (--remaining !== 0) return;
			try {
				let result = fn();
				if (result) {
					result.then(moduleDone).catch(moduleError);
				} else {
					moduleDone();
				}
			} catch (err) {
				moduleError(err);
			}
		};

		for (const dependencyAccess of evaluate_accesses) {
			let dependency;
			try {
				// Environment-dependent behavior:
				// - throws on cyclic dependencies in V8
				// - returns undefined in some environments (e.g., vitest)
				dependency = dependencyAccess();
				if (dependency == null) continue;
			} catch {
				continue;
			}

			remaining++;
			dependency.evaluate(importDone, moduleError);
		}
		importDone();
	}
}
