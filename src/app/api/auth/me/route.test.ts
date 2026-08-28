import { describe, it, expect, vi, beforeEach } from "vitest";
import { sampleUser } from "@/test/fixtures/users";

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

vi.mock("@/lib/user-service", () => ({
	getUserById: vi.fn(),
}));

import { GET } from "./route";
import { getDb } from "@/lib/db";
import { getUserById } from "@/lib/user-service";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

describe("GET /api/auth/me", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.SESSION_SECRET = "test-session-secret-for-vitest";
		vi.mocked(getDb).mockResolvedValue({} as D1Database);
	});

	it("returns 200 and user when authenticated", async () => {
		vi.mocked(getUserById).mockResolvedValue(sampleUser);
		const sessionCookie = createSessionCookie(
			sampleUser.id,
			process.env.SESSION_SECRET!,
		);
		const token = sessionCookie.split(`${SESSION_COOKIE_NAME}=`)[1]?.split(";")[0];

		const response = await GET(
			new Request("http://localhost/api/auth/me", {
				headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
			}),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.user.id).toBe(sampleUser.id);
		expect(body.user).not.toHaveProperty("passwordHash");
	});

	it("returns 401 when not authenticated", async () => {
		const response = await GET(new Request("http://localhost/api/auth/me"));

		expect(response.status).toBe(401);
	});
});
