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
	const s = new MagicString(code);
	const ast = await parseAstAsync(code, {
		jsx: false,
	});

	const importDeclarations = ast.body
		.filter((a) => a.type === "ImportDeclaration")
		.filter((a) => asyncFilter(a.source.value as string));

	transform(s, ast, `\0__tlaRegister`, importDeclarations, hasAwait, "__tla");

	return format(s.toString(), {
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
				"import __tla_register from "\\u0000__tlaRegister";
				import a from "./a";
				import { __tla_access as __tla0 } from "./a";
				import { b } from "./b";
				import { __tla_access as __tla1 } from "./b";
				import * as c from "./c";
				import { __tla_access as __tla2 } from "./c";
				async function __tla_initModuleExports() {
					console.log(a, b, c);
				}
				export const __tla_access = __tla_register(__tla_initModuleExports, [
					() => __tla0,
					() => __tla1,
					() => __tla2,
				]);
				if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
				"
			`);
		});

		it("only applies logic to async modules", async () => {
			expect(await runTransform(code, (id) => id != "./b", true))
				.toMatchInlineSnapshot(`
					"import __tla_register from "\\u0000__tlaRegister";
					import a from "./a";
					import { __tla_access as __tla0 } from "./a";
					import { b } from "./b";
					import * as c from "./c";
					import { __tla_access as __tla1 } from "./c";
					async function __tla_initModuleExports() {
						console.log(a, b, c);
					}
					export const __tla_access = __tla_register(__tla_initModuleExports, [
						() => __tla0,
						() => __tla1,
					]);
					if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
					"
				`);
		});

		it("handles no async modules", async () => {
			expect(await runTransform(code, () => false, true))
				.toMatchInlineSnapshot(`
					"import __tla_register from "\\u0000__tlaRegister";
					import a from "./a";
					import { b } from "./b";
					import * as c from "./c";
					async function __tla_initModuleExports() {
						console.log(a, b, c);
					}
					export const __tla_access = __tla_register(__tla_initModuleExports, []);
					if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
					"import __tla_register from "\\u0000__tlaRegister";
					import a from "./a";
					import { __tla_access as __tla0 } from "./a";
					function __tla_initModuleExports() {
						console.log(a);
					}
					export const __tla_access = __tla_register(__tla_initModuleExports, [
						() => __tla0,
					]);
					if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
					"
				`);
		});
	});

	describe("function declarations", () => {
		it("moves function declarations to top", async () => {
			const code = `
				console.log('A');
				function a() {
					return 123;
				}
				console.log('B');`;

			expect(await runTransform(code, () => true, true)).toMatchInlineSnapshot(`
				"import __tla_register from "\\u0000__tlaRegister";
				function a() {
					return 123;
				}
				async function __tla_initModuleExports() {
					console.log("A");
					console.log("B");
				}
				export const __tla_access = __tla_register(__tla_initModuleExports, []);
				if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
				"import __tla_register from "\\u0000__tlaRegister";
				let a;
				function b() {
					return 123;
				}
				async function __tla_initModuleExports() {
					a = function (value) {
						console.log(value);
					};
					123;
				}
				export const __tla_access = __tla_register(__tla_initModuleExports, []);
				if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
				"
			`);
		});
	});

	describe("class declarations", () => {
		it("handles undecorated classes", async () => {
			const code = `
				console.log("A");
				class A {
					method() {
						return 123;
					}
				}
				console.log("B");
			`;
			expect(await runTransform(code, () => true, true)).toMatchInlineSnapshot(`
				"import __tla_register from "\\u0000__tlaRegister";
				let A;
				async function __tla_initModuleExports() {
					console.log("A");
					A = class A {
						method() {
							return 123;
						}
					};
					console.log("B");
				}
				export const __tla_access = __tla_register(__tla_initModuleExports, []);
				if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
				"
			`);
		});

		it("handles decorated classes", async () => {
			const code = `
				console.log("A");
				@decorator
				class A {
					method() {
						return 123;
					}
				}
				console.log("B");
			`;

			expect(await runTransform(code, () => true, true)).toMatchInlineSnapshot(`
				"import __tla_register from "\\u0000__tlaRegister";
				let A;
				async function __tla_initModuleExports() {
					console.log("A");
					A =
						@decorator
						class A {
							method() {
								return 123;
							}
						};
					console.log("B");
				}
				export const __tla_access = __tla_register(__tla_initModuleExports, []);
				if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
				"
			`);
		});

		it("handles multiple decorators", async () => {
			const code = `
				console.log("A");
				@decorator1 @decorator2 class A {
					method() {
						return 123;
					}
				}
				console.log("B");
			`;

			expect(await runTransform(code, () => true, true)).toMatchInlineSnapshot(`
				"import __tla_register from "\\u0000__tlaRegister";
				let A;
				async function __tla_initModuleExports() {
					console.log("A");
					A =
						@decorator1
						@decorator2
						class A {
							method() {
								return 123;
							}
						};
					console.log("B");
				}
				export const __tla_access = __tla_register(__tla_initModuleExports, []);
				if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
						"import __tla_register from "\\u0000__tlaRegister";
						export default function a() {
							return 123;
						}
						async function __tla_initModuleExports() {
							console.log("A");
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
						"import __tla_register from "\\u0000__tlaRegister";
						export function a() {
							return 123;
						}
						async function __tla_initModuleExports() {
							console.log("A");
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
						"
					`);
			});
		});

		describe("class declaration exports", () => {
			describe("handles default exports", () => {
				it("without name", async () => {
					const code = `
						export default @decorator class {
							method() {
								return 123;
							}
						}
						console.log('A');
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"import __tla_register from "\\u0000__tlaRegister";
							let __tla_default;
							export { __tla_default as default };
							async function __tla_initModuleExports() {
								__tla_default =
									@decorator
									class {
										method() {
											return 123;
										}
									};
								console.log("A");
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
							"
						`);
				});

				it("with name", async () => {
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
							"import __tla_register from "\\u0000__tlaRegister";
							let A;
							export { A as default };
							async function __tla_initModuleExports() {
								A =
									@decorator
									class A {
										method() {
											return 123;
										}
									};
								console.log("A");
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
							"import __tla_register from "\\u0000__tlaRegister";
							export let A;
							async function __tla_initModuleExports() {
								A = class A {
									method() {
										return 123;
									}
								};
								console.log("A");
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
							"import __tla_register from "\\u0000__tlaRegister";
							export let A;
							async function __tla_initModuleExports() {
								A =
									@decorator
									class A {
										method() {
											return 123;
										}
									};
								console.log("A");
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
							"import __tla_register from "\\u0000__tlaRegister";
							let __tla_default;
							export { __tla_default as default };
							async function __tla_initModuleExports() {
								__tla_default = "a";
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
							"
						`);
				});

				it("handles awaited default exports", async () => {
					const code = `
						export default await "a";
					`;

					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"import __tla_register from "\\u0000__tlaRegister";
							let __tla_default;
							export { __tla_default as default };
							async function __tla_initModuleExports() {
								__tla_default = await "a";
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
							"import __tla_register from "\\u0000__tlaRegister";
							let a;
							let __tla_default;
							export { __tla_default as default };
							async function __tla_initModuleExports() {
								a = await 1;
								__tla_default = a;
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
							"import __tla_register from "\\u0000__tlaRegister";
							let a, b;
							let __tla_default;
							export { __tla_default as default };
							async function __tla_initModuleExports() {
								(a, b);
								__tla_default = { a, c: { d: b = 3 } = {} } = { a: 1, c: { d: 2 } };
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
							"import __tla_register from "\\u0000__tlaRegister";
							let a, b, c;
							let __tla_default;
							export { __tla_default as default };
							async function __tla_initModuleExports() {
								(a, b, c);
								__tla_default = [a, [b, c]] = [1, [2, 3]];
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
							"import __tla_register from "\\u0000__tlaRegister";
							export let a, b;
							async function __tla_initModuleExports() {
								((a = 1), (b = 2));
								console.log("A");
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
							"import __tla_register from "\\u0000__tlaRegister";
							export let a, b;
							async function __tla_initModuleExports() {
								((a = 1), (b = 2));
								console.log("A");
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
							"import __tla_register from "\\u0000__tlaRegister";
							export var a, b;
							async function __tla_initModuleExports() {
								((a = 1), (b = 2));
								console.log("A");
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
							"import __tla_register from "\\u0000__tlaRegister";
							export let a, b;
							export let x, y, z;
							async function __tla_initModuleExports() {
								({ a, c: { d: b = 3 } = {} } = { a: 1, c: { d: 2 } });
								[x, [y, z]] = [1, [2, 3]];
								console.log("A");
							}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
							"import __tla_register from "\\u0000__tlaRegister";
							export { a, b as c };
							async function __tla_initModuleExports() {}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
							"
						`);
				});

				it("handles re-export", async () => {
					const code = `
						export { foo, default as def } from './mod';
					`;
					expect(await runTransform(code, () => true, true))
						.toMatchInlineSnapshot(`
							"import __tla_register from "\\u0000__tlaRegister";
							export { foo, default as def } from "./mod";
							async function __tla_initModuleExports() {}
							export const __tla_access = __tla_register(__tla_initModuleExports, []);
							if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
						"import __tla_register from "\\u0000__tlaRegister";
						export * from "module";
						async function __tla_initModuleExports() {
							console.log("A");
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
						"import __tla_register from "\\u0000__tlaRegister";
						export * as ident from "module";
						async function __tla_initModuleExports() {
							console.log("A");
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
				"import __tla_register from "\\u0000__tlaRegister";
				let a, b;
				async function __tla_initModuleExports() {
					((a = 1), (b = 2));
				}
				export const __tla_access = __tla_register(__tla_initModuleExports, []);
				if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
						"import __tla_register from "\\u0000__tlaRegister";
						var a, b;
						async function __tla_initModuleExports() {
							try {
								((a = 1), (b = 2));
							} catch (e) {}
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
						"import __tla_register from "\\u0000__tlaRegister";
						async function __tla_initModuleExports() {
							try {
								let a = 1,
									b = 2;
							} catch (e) {}
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
						"import __tla_register from "\\u0000__tlaRegister";
						async function __tla_initModuleExports() {
							try {
								function test() {
									var a = 1,
										b = 2;
								}
							} catch (e) {}
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
				"import __tla_register from "\\u0000__tlaRegister";
				var a, b;
				async function __tla_initModuleExports() {
					dontCallMe;
					((a = 1), (b = 2));
				}
				export const __tla_access = __tla_register(__tla_initModuleExports, []);
				if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
						"import __tla_register from "\\u0000__tlaRegister";
						let a, b;
						async function __tla_initModuleExports() {
							({ a, c: b = 3 } = { a: 1, c: 2 });
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
						"
					`);
			});

			it("handles nested destructuring", async () => {
				const code = `
					const { a, c: { d: b = 3 } = {} } = { a: 1, c: { d: 2 } };
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
						"import __tla_register from "\\u0000__tlaRegister";
						let a, b;
						async function __tla_initModuleExports() {
							({ a, c: { d: b = 3 } = {} } = { a: 1, c: { d: 2 } });
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
						"
					`);
			});

			it("handles rest property", async () => {
				const code = `
					const { a, ...b } = { a: 1, c: 2, d: 3 };
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
						"import __tla_register from "\\u0000__tlaRegister";
						let a, b;
						async function __tla_initModuleExports() {
							({ a, ...b } = { a: 1, c: 2, d: 3 });
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
						"import __tla_register from "\\u0000__tlaRegister";
						let a, b;
						async function __tla_initModuleExports() {
							[a, b = 3] = [1, 2];
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
						"
					`);
			});

			it("handles nested array destructuring", async () => {
				const code = `
					const [a, [b, c]] = [1, [2, 3]];
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
						"import __tla_register from "\\u0000__tlaRegister";
						let a, b, c;
						async function __tla_initModuleExports() {
							[a, [b, c]] = [1, [2, 3]];
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
						"
					`);
			});

			it("handles rest element", async () => {
				const code = `
					const [a, ...b] = [1, 2, 3];
				`;

				expect(await runTransform(code, () => true, true))
					.toMatchInlineSnapshot(`
						"import __tla_register from "\\u0000__tlaRegister";
						let a, b;
						async function __tla_initModuleExports() {
							[a, ...b] = [1, 2, 3];
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
						"import __tla_register from "\\u0000__tlaRegister";
						let resourceA;
						let resourceB;
						async function __tla_initModuleExports() {
							using __tla_using_resourceA = getResourceA(),
								__tla_using_resourceB = getResourceB();
							resourceA = __tla_using_resourceA;
							resourceB = __tla_using_resourceB;
							console.log(resourceA);
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
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
						"import __tla_register from "\\u0000__tlaRegister";
						let resourceA;
						let resourceB;
						async function __tla_initModuleExports() {
							await using __tla_using_resourceA = getResourceA(),
								__tla_using_resourceB = getResourceB();
							resourceA = __tla_using_resourceA;
							resourceB = __tla_using_resourceB;
							console.log(resourceA);
						}
						export const __tla_access = __tla_register(__tla_initModuleExports, []);
						if (import.meta.useTla) await new Promise((resolve) => __tla_access(resolve));
						"
					`);
			});
		});
	});
});
