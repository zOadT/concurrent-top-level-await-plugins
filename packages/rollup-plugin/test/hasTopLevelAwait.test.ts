import { parseAstAsync } from "rollup/parseAst";
import { describe, expect, it } from "vitest";
import hasTopLevelAwait from "../src/hasTopLevelAwait.js";

async function runHasTopLevelAwait(code: string) {
	const ast = await parseAstAsync(code, {
		jsx: false,
	});

	return hasTopLevelAwait(ast);
}

describe("hasTopLevelAwait", () => {
	describe("should detect all possible await node types", () => {
		it("AwaitExpression", async () => {
			expect(
				await runHasTopLevelAwait(`
					await foo();
				`),
			).toBeTruthy();
		});

		it("AwaitForOfStatement", async () => {
			expect(
				await runHasTopLevelAwait(`
					for await (const a of iterator) {
						console.log(a);
					}
				`),
			).toBeTruthy();
		});

		it("AwaitUsingVariableDeclaration", async () => {
			expect(
				await runHasTopLevelAwait(`
					await using resource = acquireResource();
				`),
			).toBeTruthy();
		});
	});

	describe("should detect nested awaits", () => {
		it("nested in blocks", async () => {
			expect(
				await runHasTopLevelAwait(`
					{
						await foo();
					}
				`),
			).toBeTruthy();
		});

		it("nested in if statements", async () => {
			expect(
				await runHasTopLevelAwait(`
					if (condition) {
						await foo();
					}
				`),
			).toBeTruthy();
		});

		it("nested in loops", async () => {
			expect(
				await runHasTopLevelAwait(`
					while (condition) {
						await foo();
					}
				`),
			).toBeTruthy();
		});

		it("nested in try/catch/finally", async () => {
			expect(
				await runHasTopLevelAwait(`
					try {
						await foo();
					} catch (e) {
						await bar();
					} finally {
						await baz();
					}
				`),
			).toBeTruthy();
		});

		it("nested in switch cases", async () => {
			expect(
				await runHasTopLevelAwait(`
					switch (value) {
						case 1:
							await foo();
							break;
					}
				`),
			).toBeTruthy();
		});
	});

	describe("should not detect awaits in functions", () => {
		it("function declarations", async () => {
			expect(
				await runHasTopLevelAwait(`
					async function test() {
						await foo();
					}
				`),
			).toBeFalsy();
		});

		it("generator function declarations", async () => {
			expect(
				await runHasTopLevelAwait(`
					async function* test() {
						await foo();
					}
				`),
			).toBeFalsy();
		});

		it("function expressions", async () => {
			expect(
				await runHasTopLevelAwait(`
					const test = async function() {
						await foo();
					};
				`),
			).toBeFalsy();
		});

		it("arrow functions", async () => {
			expect(
				await runHasTopLevelAwait(`
					const test = async () => {
						await foo();
					};
				`),
			).toBeFalsy();
		});

		it("class methods", async () => {
			expect(
				await runHasTopLevelAwait(`
					class MyClass {
						async myMethod() {
							await foo();
						}
					}
				`),
			).toBeFalsy();
		});

		it("class private methods", async () => {
			expect(
				await runHasTopLevelAwait(`
					class MyClass {
						async #myPrivateMethod() {
							await foo();
						}
					}
				`),
			).toBeFalsy();
		});

		it("object methods", async () => {
			expect(
				await runHasTopLevelAwait(`
					const obj = {
						async myMethod() {
							await foo();
						}
					};
				`),
			).toBeFalsy();
		});
	});
});
