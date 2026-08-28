import { describe, it, expect } from "vitest";

describe("vitest harness", () => {
	it("resolves path aliases and runs assertions", () => {
		expect(1 + 1).toBe(2);
	});
});
