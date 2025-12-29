import { describe, expect, it } from "vitest";
import { AsyncModuleTracker } from "../src/AsyncModuleTracker.js";

function createAcyclicTree() {
	const tree = new AsyncModuleTracker<string>();
	tree.setDependencies("A", ["B", "C"]);
	tree.setDependencies("B", ["D", "E"]);
	tree.setDependencies("C", ["F", "G"]);
	tree.setDependencies("D", []);
	tree.setDependencies("E", []);
	tree.setDependencies("F", []);
	tree.setDependencies("G", []);
	return tree;
}

function createCyclicTree() {
	const tree = new AsyncModuleTracker<string>();
	tree.setDependencies("A", ["B", "C"]);
	tree.setDependencies("B", ["D", "E"]);
	tree.setDependencies("C", ["F", "G"]);
	tree.setDependencies("D", ["F"]);
	tree.setDependencies("E", []);
	tree.setDependencies("F", ["B"]);
	tree.setDependencies("G", []);
	return tree;
}

describe("AsyncModuleTracker", () => {
	describe("acyclic tree", () => {
		it("marks leaf nodes", async () => {
			const tree = createAcyclicTree();

			tree.setEntryAsync("D", false);
			tree.setEntryAsync("F", true);

			expect(await tree.isAsync("D")).toBe(false);
			expect(await tree.isAsync("F")).toBe(true);
		});

		it("propagates markings to ancestors", async () => {
			const tree = createAcyclicTree();
			tree.setEntryAsync("A", false);
			tree.setEntryAsync("B", false);
			tree.setEntryAsync("D", true);

			expect(await tree.isAsync("D")).toBe(true);
			expect(await tree.isAsync("B")).toBe(true);
			expect(await tree.isAsync("A")).toBe(true);
		});

		it("propagates unmarked status to ancestors", async () => {
			const tree = createCyclicTree();
			tree.setEntryAsync("A", false);
			tree.setEntryAsync("B", false);
			tree.setEntryAsync("C", false);
			tree.setEntryAsync("D", false);
			tree.setEntryAsync("E", false);
			tree.setEntryAsync("F", false);
			tree.setEntryAsync("G", false);

			expect(await tree.isAsync("A")).toBe(false);
			expect(await tree.isAsync("B")).toBe(false);
			expect(await tree.isAsync("D")).toBe(false);
		});
	});

	describe("cyclic tree", () => {
		it("propagates markings across a cycle", async () => {
			const tree = createCyclicTree();

			tree.setEntryAsync("B", true);

			expect(await tree.isAsync("A")).toBe(true);
			expect(await tree.isAsync("B")).toBe(true);
			expect(await tree.isAsync("D")).toBe(true);
			expect(await tree.isAsync("F")).toBe(true);
		});

		it("marks entire cycle when a sibling is marked", async () => {
			const tree = createCyclicTree();

			tree.setEntryAsync("B", false);
			tree.setEntryAsync("D", false);
			tree.setEntryAsync("F", false);
			tree.setEntryAsync("E", true);

			expect(await tree.isAsync("A")).toBe(true);
			expect(await tree.isAsync("B")).toBe(true);
			expect(await tree.isAsync("D")).toBe(true);
			expect(await tree.isAsync("F")).toBe(true);
		});

		it("resolves cycles as unmarked", async () => {
			const tree = createCyclicTree();

			tree.setEntryAsync("A", false);
			tree.setEntryAsync("B", false);
			tree.setEntryAsync("C", false);
			tree.setEntryAsync("D", false);
			tree.setEntryAsync("E", false);
			tree.setEntryAsync("F", false);
			tree.setEntryAsync("G", true);

			expect(await tree.isAsync("B")).toBe(false);
			expect(await tree.isAsync("D")).toBe(false);
			expect(await tree.isAsync("F")).toBe(false);
		});

		it("propagates markings before resolving cycles", async () => {
			const tree = createCyclicTree();

			tree.setEntryAsync("A", false);
			tree.setEntryAsync("B", false);
			tree.setEntryAsync("C", false);
			tree.setEntryAsync("D", false);
			tree.setEntryAsync("E", false);
			tree.setEntryAsync("G", true);

			tree.setEntryAsync("F", true);

			expect(await tree.isAsync("B")).toBe(true);
			expect(await tree.isAsync("D")).toBe(true);
			expect(await tree.isAsync("F")).toBe(true);
		});
	});
});
