import { describe, expect, it } from "vitest";
import { AsyncTlaTracker } from "../src/AsyncTlaTracker.js";

function createAcyclicTree() {
	const tree = new AsyncTlaTracker<string>();
	tree.setChildren("A", ["B", "C"]);
	tree.setChildren("B", ["D", "E"]);
	tree.setChildren("C", ["F", "G"]);
	tree.setChildren("D", []);
	tree.setChildren("E", []);
	tree.setChildren("F", []);
	tree.setChildren("G", []);
	return tree;
}

function createCyclicTree() {
	const tree = new AsyncTlaTracker<string>();
	tree.setChildren("A", ["B", "C"]);
	tree.setChildren("B", ["D", "E"]);
	tree.setChildren("C", ["F", "G"]);
	tree.setChildren("D", ["F"]);
	tree.setChildren("E", []);
	tree.setChildren("F", ["B"]);
	tree.setChildren("G", []);
	return tree;
}

describe("AsyncTlaTracker", () => {
	describe("acyclic tree", () => {
		it("marks leaf nodes", async () => {
			const tree = createAcyclicTree();

			tree.setMarked("D", false);
			tree.setMarked("F", true);

			expect(await tree.get("D")).toBe(false);
			expect(await tree.get("F")).toBe(true);
		});

		it("propagates markings to ancestors", async () => {
			const tree = createAcyclicTree();
			tree.setMarked("A", false);
			tree.setMarked("B", false);
			tree.setMarked("D", true);

			expect(await tree.get("D")).toBe(true);
			expect(await tree.get("B")).toBe(true);
			expect(await tree.get("A")).toBe(true);
		});

		it("propagates unmarked status to ancestors", async () => {
			const tree = createCyclicTree();
			tree.setMarked("A", false);
			tree.setMarked("B", false);
			tree.setMarked("C", false);
			tree.setMarked("D", false);
			tree.setMarked("E", false);
			tree.setMarked("F", false);
			tree.setMarked("G", false);

			expect(await tree.get("A")).toBe(false);
			expect(await tree.get("B")).toBe(false);
			expect(await tree.get("D")).toBe(false);
		});
	});

	describe("cyclic tree", () => {
		it("propagates markings across a cycle", async () => {
			const tree = createCyclicTree();

			tree.setMarked("B", true);

			expect(await tree.get("A")).toBe(true);
			expect(await tree.get("B")).toBe(true);
			expect(await tree.get("D")).toBe(true);
			expect(await tree.get("F")).toBe(true);
		});

		it("marks entire cycle when a sibling is marked", async () => {
			const tree = createCyclicTree();

			tree.setMarked("B", false);
			tree.setMarked("D", false);
			tree.setMarked("F", false);
			tree.setMarked("E", true);

			expect(await tree.get("A")).toBe(true);
			expect(await tree.get("B")).toBe(true);
			expect(await tree.get("D")).toBe(true);
			expect(await tree.get("F")).toBe(true);
		});

		it("resolves cycles as unmarked", async () => {
			const tree = createCyclicTree();

			tree.setMarked("A", false);
			tree.setMarked("B", false);
			tree.setMarked("C", false);
			tree.setMarked("D", false);
			tree.setMarked("E", false);
			tree.setMarked("F", false);
			tree.setMarked("G", true);

			expect(await tree.get("B")).toBe(false);
			expect(await tree.get("D")).toBe(false);
			expect(await tree.get("F")).toBe(false);
		});

		it("propagates markings before resolving cycles", async () => {
			const tree = createCyclicTree();

			tree.setMarked("A", false);
			tree.setMarked("B", false);
			tree.setMarked("C", false);
			tree.setMarked("D", false);
			tree.setMarked("E", false);
			tree.setMarked("G", true);

			tree.setMarked("F", true);

			expect(await tree.get("B")).toBe(true);
			expect(await tree.get("D")).toBe(true);
			expect(await tree.get("F")).toBe(true);
		});
	});
});
