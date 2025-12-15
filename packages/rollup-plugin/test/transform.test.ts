import MagicString from "magic-string";
import { parseAstAsync } from "rollup/parseAst";
import { describe, expect, it } from "vitest";
import { format } from "prettier";
import transform from "../src/transform.js";

async function runTransform(
	code: string,
	asyncFilter: (id: string) => boolean,
	hasAwait: boolean,
) {
	let s = new MagicString(code);
	const ast = await parseAstAsync(code, {
		jsx: true,
	});

	const importDeclarations = ast.body
		.filter((a) => a.type === "ImportDeclaration")
		.filter((a) => asyncFilter(a.source.value as string));

	return format(transform(s, ast, importDeclarations, hasAwait).toString(), {
		parser: "babel",
		useTabs: true,
	});
}

describe("transform", () => {
	describe("import declarations", () => {
		const code = `
			import a from './a';
			import { b } from './b';
			import * as c from './c';

			console.log(a, b, c);
		`;

		it("adds import for __tla_access", async () => {
			expect(await runTransform(code, () => true, true)).toMatchInlineSnapshot(`
				"import a from "./a";
				import { __tla_access as __tla0 } from "./a";
				import { b } from "./b";
				import { __tla_access as __tla1 } from "./b";
				import * as c from "./c";
				import { __tla_access as __tla2 } from "./c";
				async function __exec() {
					console.log(a, b, c);
				}
				const __tla = Promise.all(
					[__tla0, __tla1, __tla2]
						.flatMap((a) => {
							try {
								const result = a();
								if (Array.isArray(result)) {
									return result;
								}
								return [a];
							} catch {
								return []; // happens for cyclic dependencies
							}
						})
						.map((e) => e()),
				).then(() => __exec());
				const __todo = __tla;
				if (import.meta.useTla) await __todo;
				export function __tla_access() {
					return __tla;
				}
				"
			`);
		});

		it("only applies logic to async modules", async () => {
			expect(await runTransform(code, (id) => id != "./b", true))
				.toMatchInlineSnapshot(`
				"import a from "./a";
				import { __tla_access as __tla0 } from "./a";
				import { b } from "./b";
				import * as c from "./c";
				import { __tla_access as __tla1 } from "./c";
				async function __exec() {
					console.log(a, b, c);
				}
				const __tla = Promise.all(
					[__tla0, __tla1]
						.flatMap((a) => {
							try {
								const result = a();
								if (Array.isArray(result)) {
									return result;
								}
								return [a];
							} catch {
								return []; // happens for cyclic dependencies
							}
						})
						.map((e) => e()),
				).then(() => __exec());
				const __todo = __tla;
				if (import.meta.useTla) await __todo;
				export function __tla_access() {
					return __tla;
				}
				"
			`);
		});

		it("handles no async modules", async () => {
			expect(await runTransform(code, () => false, true))
				.toMatchInlineSnapshot(`
				"import a from "./a";
				import { b } from "./b";
				import * as c from "./c";
				async function __exec() {
					console.log(a, b, c);
				}
				const __tla = __exec();
				const __todo = __tla;
				if (import.meta.useTla) await __todo;
				export function __tla_access() {
					return __tla;
				}
				"
			`);
		});
	});

	describe("without top level await", () => {
		it("handles hasAwait false", async () => {
			const code = `
				import a from './a';

				console.log(a);
			`;
			expect(await runTransform(code, () => true, false))
				.toMatchInlineSnapshot(`
				"import a from "./a";
				import { __tla_access as __tla0 } from "./a";
				async function __exec() {
					console.log(a);
				}
				const __tla = [__tla0].flatMap((a) => {
					try {
						const result = a();
						if (Array.isArray(result)) {
							return result;
						}
						return [a];
					} catch {
						return []; // happens for cyclic dependencies
					}
				});
				const __todo = Promise.all(
					[__tla0]
						.flatMap((a) => {
							try {
								const result = a();
								if (Array.isArray(result)) {
									return result;
								}
								return [a];
							} catch {
								return []; // happens for cyclic dependencies
							}
						})
						.map((e) => e()),
				).then(() => __exec());
				if (import.meta.useTla) await __todo;
				export function __tla_access() {
					return __tla;
				}
				"
			`);
		});
	});

	describe("declarations", () => {
		it("moves declarations to top", async () => {
			const code = `
				function a() {
					return 123;
				}
				console.log('A');
				class B {
					method() {
						return 123;
					}
				}
				console.log('B');
				@decorated
				class C { }`;

			expect(await runTransform(code, () => true, true)).toMatchInlineSnapshot(`
					"function a() {
						return 123;
					}
					class B {
						method() {
							return 123;
						}
					}
					@decorated
					class C {}
					async function __exec() {
						console.log("A");

						console.log("B");
					}
					const __tla = __exec();
					const __todo = __tla;
					if (import.meta.useTla) await __todo;
					export function __tla_access() {
						return __tla;
					}
					"
				`);
		});
	});
});
