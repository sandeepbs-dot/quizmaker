import { describe, it, expect } from "vitest";
import {
	validateLoginInput,
	validateRegisterInput,
} from "@/lib/validation/auth";
import { validRegisterPayload } from "@/test/fixtures/users";

describe("validateRegisterInput", () => {
	it("accepts valid payload", () => {
		const result = validateRegisterInput(validRegisterPayload);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.email).toBe(validRegisterPayload.email);
		}
	});

	it("rejects missing firstName", () => {
		const result = validateRegisterInput({
			...validRegisterPayload,
			firstName: "",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.firstName).toBeTruthy();
		}
	});

	it("rejects invalid email", () => {
		const result = validateRegisterInput({
			...validRegisterPayload,
			email: "not-an-email",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.email).toBeTruthy();
		}
	});

	it("rejects weak password", () => {
		const result = validateRegisterInput({
			...validRegisterPayload,
			password: "weak",
			confirmPassword: "weak",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.password).toBeTruthy();
		}
	});

	it("rejects mismatched confirmPassword", () => {
		const result = validateRegisterInput({
			...validRegisterPayload,
			confirmPassword: "DifferentPass1!",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.confirmPassword).toBeTruthy();
		}
	});

	it("rejects invalid username", () => {
		const result = validateRegisterInput({
			...validRegisterPayload,
			username: "invalid username!",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.username).toBeTruthy();
		}
	});
});

describe("validateLoginInput", () => {
	it("accepts valid payload", () => {
		const result = validateLoginInput({
			emailOrUsername: "jane.smith@school.edu",
			password: "SecurePass1!",
		});

		expect(result.success).toBe(true);
	});

	it("rejects empty emailOrUsername", () => {
		const result = validateLoginInput({
			emailOrUsername: "",
			password: "SecurePass1!",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.emailOrUsername).toBeTruthy();
		}
	});

	it("rejects empty password", () => {
		const result = validateLoginInput({
			emailOrUsername: "jsmith",
			password: "",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.password).toBeTruthy();
		}
	});
});
