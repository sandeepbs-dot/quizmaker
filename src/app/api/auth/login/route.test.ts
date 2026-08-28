import { describe, it, expect, vi, beforeEach } from "vitest";
import { sampleUser, validLoginPayload } from "@/test/fixtures/users";

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

vi.mock("@/lib/user-service", () => ({
	getUserByEmail: vi.fn(),
	getUserByUsername: vi.fn(),
}));

vi.mock("@/lib/password", () => ({
	verifyPassword: vi.fn(),
}));

import { POST } from "./route";
import { getDb } from "@/lib/db";
import { getUserByEmail, getUserByUsername } from "@/lib/user-service";
import { verifyPassword } from "@/lib/password";

describe("POST /api/auth/login", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.SESSION_SECRET = "test-session-secret-for-vitest";
		vi.mocked(getDb).mockResolvedValue({} as D1Database);
	});

	it("returns 200 and user on valid email login", async () => {
		vi.mocked(getUserByEmail).mockResolvedValue(sampleUser);
		vi.mocked(verifyPassword).mockResolvedValue(true);

		const response = await POST(
			new Request("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validLoginPayload),
			}),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.user.id).toBe(sampleUser.id);
		expect(body.user).not.toHaveProperty("passwordHash");
		expect(body.redirectTo).toBe("/mcqs");
		expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
	});

	it("returns 200 on valid username login", async () => {
		vi.mocked(getUserByEmail).mockResolvedValue(null);
		vi.mocked(getUserByUsername).mockResolvedValue(sampleUser);
		vi.mocked(verifyPassword).mockResolvedValue(true);

		const response = await POST(
			new Request("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					emailOrUsername: "jsmith",
					password: validLoginPayload.password,
				}),
			}),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.user.username).toBe("jsmith");
	});

	it("returns 401 on wrong password", async () => {
		vi.mocked(getUserByEmail).mockResolvedValue(sampleUser);
		vi.mocked(verifyPassword).mockResolvedValue(false);

		const response = await POST(
			new Request("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validLoginPayload),
			}),
		);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe("Invalid email/username or password");
	});

	it("returns 401 on unknown user", async () => {
		vi.mocked(getUserByEmail).mockResolvedValue(null);
		vi.mocked(getUserByUsername).mockResolvedValue(null);

		const response = await POST(
			new Request("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validLoginPayload),
			}),
		);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe("Invalid email/username or password");
	});

	it("returns 400 on missing fields", async () => {
		const response = await POST(
			new Request("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ emailOrUsername: "", password: "" }),
			}),
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.errors).toBeTruthy();
	});
});
