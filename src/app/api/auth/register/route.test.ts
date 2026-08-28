import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	sampleUser,
	validRegisterPayload,
} from "@/test/fixtures/users";

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

vi.mock("@/lib/user-service", () => ({
	createUser: vi.fn(),
	getUserByEmail: vi.fn(),
	getUserByUsername: vi.fn(),
}));

vi.mock("@/lib/password", () => ({
	hashPassword: vi.fn(),
}));

import { POST } from "./route";
import { getDb } from "@/lib/db";
import {
	createUser,
	getUserByEmail,
	getUserByUsername,
} from "@/lib/user-service";
import { hashPassword } from "@/lib/password";

describe("POST /api/auth/register", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.SESSION_SECRET = "test-session-secret-for-vitest";
		vi.mocked(getDb).mockResolvedValue({} as D1Database);
	});

	it("returns 201 and user on success", async () => {
		vi.mocked(getUserByEmail).mockResolvedValue(null);
		vi.mocked(getUserByUsername).mockResolvedValue(null);
		vi.mocked(hashPassword).mockResolvedValue("hashed-password");
		vi.mocked(createUser).mockResolvedValue(sampleUser);

		const response = await POST(
			new Request("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validRegisterPayload),
			}),
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.user).not.toHaveProperty("passwordHash");
		expect(body.user.id).toBe(sampleUser.id);
		expect(body.redirectTo).toBe("/mcqs");
	});

	it("returns 400 on validation failure", async () => {
		const response = await POST(
			new Request("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...validRegisterPayload, firstName: "" }),
			}),
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.errors.firstName).toBeTruthy();
	});

	it("returns 409 on duplicate email", async () => {
		vi.mocked(getUserByEmail).mockResolvedValue(sampleUser);

		const response = await POST(
			new Request("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validRegisterPayload),
			}),
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.error).toMatch(/email/i);
	});

	it("returns 409 on duplicate username", async () => {
		vi.mocked(getUserByEmail).mockResolvedValue(null);
		vi.mocked(getUserByUsername).mockResolvedValue(sampleUser);

		const response = await POST(
			new Request("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validRegisterPayload),
			}),
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.error).toMatch(/username/i);
	});

	it("sets session cookie on success", async () => {
		vi.mocked(getUserByEmail).mockResolvedValue(null);
		vi.mocked(getUserByUsername).mockResolvedValue(null);
		vi.mocked(hashPassword).mockResolvedValue("hashed-password");
		vi.mocked(createUser).mockResolvedValue(sampleUser);

		const response = await POST(
			new Request("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validRegisterPayload),
			}),
		);

		const cookies = response.headers.getSetCookie();
		expect(cookies.some((cookie) => cookie.includes("HttpOnly"))).toBe(true);
	});
});
