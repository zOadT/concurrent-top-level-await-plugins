export default function register(
	fn: () => void | Promise<void>,
	evaluate_accesses: (() => (
		whenDone: () => void,
		onError?: (error: unknown) => void,
	) => void)[],
) {
	let state: "ready" | "busy" | "done" | "failed" = "ready";
	let whenDones: (() => void)[] = [];
	let whenErrors: ((error: unknown) => void)[] = [];
	let remaining = 1;
	let error: unknown = undefined;

	// evaluate eagerly
	evaluate();

	return evaluate;

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

		for (const access of evaluate_accesses) {
			let evaluate;
			try {
				// Environment-dependent behavior:
				// - throws on cyclic dependencies in V8
				// - returns undefined in some environments (e.g., vitest)
				evaluate = access();
				if (evaluate == null) continue;
			} catch {
				continue;
			}

			remaining++;
			evaluate(importDone, moduleError);
		}
		importDone();
	}
}
