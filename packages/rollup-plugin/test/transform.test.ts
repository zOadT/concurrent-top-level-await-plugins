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
		jsx: false,
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

		it("statements surrounding declaration remain separated", async () => {
			const code = `
				const a = function(value) {
					console.log(value)
				}
				function b() {
					return 123;
				}
				(123)
			`;

			expect(await runTransform(code, () => true, true)).toMatchInlineSnapshot(`
				"let a;
				function b() {
					return 123;
				}
				async function __exec() {
					a = function (value) {
						console.log(value);
					};
					123;
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

	describe("exports", () => {
		describe("function declaration exports", () => {
			it("handles default exports", async () => {
				const code = `
					export default function a() {
						return 123;
					}
					console.log('A');
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
					"export default function a() {
						return 123;
					}
					async function __exec() {
						console.log("A");
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

			it("handles named export", async () => {
				const code = `
					export function a() {
						return 123;
					}
					console.log('A');
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
						"export function a() {
							return 123;
						}
						async function __exec() {
							console.log("A");
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

		describe("class declaration exports", () => {
			describe("handles default exports", () => {
				it("without decorator", async () => {
					const code = `
						export default class A {
							method() {
								return 123;
							}
						}
						console.log('A');
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"export default class A {
								method() {
									return 123;
								}
							}
							async function __exec() {
								console.log("A");
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

				it("with decorator", async () => {
					const code = `
						export default @decorator class A {
							method() {
								return 123;
							}
						}
						console.log('A');
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"export default
							@decorator
							class A {
								method() {
									return 123;
								}
							}
							async function __exec() {
								console.log("A");
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

			describe("handles named export", () => {
				it("without decorator", async () => {
					const code = `
						export class A {
							method() {
								return 123;
							}
						}
						console.log('A');
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"export class A {
								method() {
									return 123;
								}
							}
							async function __exec() {
								console.log("A");
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

				it("with decorator", async () => {
					const code = `
						export @decorator class A {
							method() {
								return 123;
							}
						}
						console.log('A');
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"export
							@decorator
							class A {
								method() {
									return 123;
								}
							}
							async function __exec() {
								console.log("A");
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

		describe("variable exports", () => {
			describe("default exports", () => {
				it("simple case", async () => {
					const code = `
						export default "a";
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"let __tla_default;
							export { __tla_default as default };
							async function __exec() {
								__tla_default = "a";
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

				it("handles awaited default exports", async () => {
					const code = `
						export default await "a";
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"let __tla_default;
							export { __tla_default as default };
							async function __exec() {
								__tla_default = await "a";
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

				it("handles export of variable", async () => {
					const code = `
						const a = await 1;
						export default a;
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"let a;
							let __tla_default;
							export { __tla_default as default };
							async function __exec() {
								a = await 1;
								__tla_default = a;
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

				it("handles destructuring", async () => {
					const code = `
						let a, b;
						export default { a, c: { d: b = 3 } = {} } = { a: 1, c: { d: 2 } };
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"let a, b;
							let __tla_default;
							export { __tla_default as default };
							async function __exec() {
								(a, b);
								__tla_default = { a, c: { d: b = 3 } = {} } = { a: 1, c: { d: 2 } };
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

				it("handles array destructuring", async () => {
					const code = `
						let a, b, c;
						export default [a, [b, c]] = [1, [2, 3]];
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"let a, b, c;
							let __tla_default;
							export { __tla_default as default };
							async function __exec() {
								(a, b, c);
								__tla_default = [a, [b, c]] = [1, [2, 3]];
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

			describe("named exports", () => {
				it("handles kind let", async () => {
					const code = `
						export let a = 1, b = 2;
						console.log('A');
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"export let a, b;
							async function __exec() {
								((a = 1), (b = 2));
								console.log("A");
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

				it("handles kind const", async () => {
					const code = `
						export const a = 1, b = 2;
						console.log('A');
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"export let a, b;
							async function __exec() {
								((a = 1), (b = 2));
								console.log("A");
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

				it("handles kind var", async () => {
					const code = `
						export var a = 1, b = 2;
						console.log('A');
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"export var a, b;
							async function __exec() {
								((a = 1), (b = 2));
								console.log("A");
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

				it("handles destructuring", async () => {
					const code = `
						export const { a, c: { d: b = 3 } = {} } = { a: 1, c: { d: 2 } };
						export const [x, [y, z]] = [1, [2, 3]];
						console.log('A');
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
						"export let a, b;
						export let x, y, z;
						async function __exec() {
							({ a, c: { d: b = 3 } = {} } = { a: 1, c: { d: 2 } });
							[x, [y, z]] = [1, [2, 3]];
							console.log("A");
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

			describe("handles export {} syntax", () => {
				it("handles named export list", async () => {
					const code = `
						export { a, b as c };
					`;
					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"export { a, b as c };
							async function __exec() {}
							const __tla = __exec();
							const __todo = __tla;
							if (import.meta.useTla) await __todo;
							export function __tla_access() {
								return __tla;
							}
							"
						`);
				});

				it("handles re-export", async () => {
					const code = `
						export { foo, default as def } from './mod';
					`;
					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"export { foo, default as def } from "./mod";
							async function __exec() {}
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

		describe("export * syntax", () => {
			it("handles export * from syntax", async () => {
				const code = `
					export * from 'module';
					console.log('A');
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
						"export * from "module";
						async function __exec() {
							console.log("A");
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

			it("handles export * as from syntax", async () => {
				const code = `
					export * as ident from 'module';
					console.log('A');
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
						"export * as ident from "module";
						async function __exec() {
							console.log("A");
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

	describe("variable declarations", () => {
		it("handles simple case", async () => {
			const code = `
				const a = 1, b = 2;
			`;

			expect(await runTransform(code, () => true, true)).toMatchInlineSnapshot(`
				"let a, b;
				async function __exec() {
					((a = 1), (b = 2));
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

		describe("var declarations", () => {
			it("hoists var declarations", async () => {
				const code = `
					try {
						var a = 1, b = 2;
					} catch (e) {}
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
					"var a, b;
					async function __exec() {
						try {
							((a = 1), (b = 2));
						} catch (e) {}
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

			it("does not hoist non var declarations", async () => {
				const code = `
					try {
						let a = 1, b = 2;
					} catch (e) {}
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
					"async function __exec() {
						try {
							let a = 1,
								b = 2;
						} catch (e) {}
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

			it("does not hoist var declarations inside functions", async () => {
				const code = `
					try {
						function test() {
							var a = 1, b = 2;
						}
					} catch(e) {}
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
					"async function __exec() {
						try {
							function test() {
								var a = 1,
									b = 2;
							}
						} catch (e) {}
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

		it("does not call expressions before variable declarations", async () => {
			const code = `
				dontCallMe
				var a = 1, b = 2;
			`;

			expect(await runTransform(code, () => true, true)).toMatchInlineSnapshot(`
				"var a, b;
				async function __exec() {
					dontCallMe;
					((a = 1), (b = 2));
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

		describe("with object destructuring", () => {
			it("handles object destructuring", async () => {
				const code = `
					const { a, c: b = 3 } = { a: 1, c: 2 };
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
					"let a, b;
					async function __exec() {
						({ a, c: b = 3 } = { a: 1, c: 2 });
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

			it("handles nested destructuring", async () => {
				const code = `
					const { a, c: { d: b = 3 } = {} } = { a: 1, c: { d: 2 } };
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
					"let a, b;
					async function __exec() {
						({ a, c: { d: b = 3 } = {} } = { a: 1, c: { d: 2 } });
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

			it("handles rest property", async () => {
				const code = `
					const { a, ...b } = { a: 1, c: 2, d: 3 };
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
					"let a, b;
					async function __exec() {
						({ a, ...b } = { a: 1, c: 2, d: 3 });
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

		describe("with array destructuring", () => {
			it("handles array destructuring", async () => {
				const code = `
					const [a, b = 3] = [1, 2];
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
					"let a, b;
					async function __exec() {
						[a, b = 3] = [1, 2];
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

			it("handles nested array destructuring", async () => {
				const code = `
					const [a, [b, c]] = [1, [2, 3]];
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
					"let a, b, c;
					async function __exec() {
						[a, [b, c]] = [1, [2, 3]];
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

			it("handles rest element", async () => {
				const code = `
					const [a, ...b] = [1, 2, 3];
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
					"let a, b;
					async function __exec() {
						[a, ...b] = [1, 2, 3];
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

		describe("with using declaration", () => {
			it("handles using declaration", async () => {
				const code = `
					using resourceA = getResourceA(), resourceB = getResourceB();
					console.log(resourceA);
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
						"let resourceA;

						let resourceB;
						async function __exec() {
							using __tla_using_resourceA = getResourceA(),
								__tla_using_resourceB = getResourceB();
							resourceA = __tla_using_resourceA;
							resourceB = __tla_using_resourceB;
							console.log(resourceA);
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

			it("handles await using declaration", async () => {
				const code = `
					await using resourceA = getResourceA(), resourceB = getResourceB();
					console.log(resourceA);
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
						"let resourceA;

						let resourceB;
						async function __exec() {
							await using __tla_using_resourceA = getResourceA(),
								__tla_using_resourceB = getResourceB();
							resourceA = __tla_using_resourceA;
							resourceB = __tla_using_resourceB;
							console.log(resourceA);
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
});
