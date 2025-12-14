import { describe, expect, it } from "vitest";
import concurrentTopLevelAwait from "../src/index.js";

describe("concurrentTopLevelAwait", () => {
	it("is not implemented", () => {
		expect(concurrentTopLevelAwait).toThrowError("Function not implemented.");
	});
});
