import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validPassword } from "@/test/fixtures/users";

describe("password", () => {
	it("hashPassword returns bcrypt hash", async () => {
		const hash = await hashPassword(validPassword);

		expect(hash).toMatch(/^\$2/);
		expect(hash).not.toBe(validPassword);
	});

	it("hashPassword produces different hashes for same input", async () => {
		const first = await hashPassword(validPassword);
		const second = await hashPassword(validPassword);

		expect(first).not.toBe(second);
	});

	it("verifyPassword returns true for correct password", async () => {
		const hash = await hashPassword(validPassword);

		expect(await verifyPassword(validPassword, hash)).toBe(true);
	});

	it("verifyPassword returns false for wrong password", async () => {
		const hash = await hashPassword(validPassword);

		expect(await verifyPassword("WrongPass1!", hash)).toBe(false);
	});

	it("verifyPassword returns false for empty password", async () => {
		const hash = await hashPassword(validPassword);

		expect(await verifyPassword("", hash)).toBe(false);
	});
});
