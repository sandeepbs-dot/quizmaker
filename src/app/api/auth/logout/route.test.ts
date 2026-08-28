import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

describe("POST /api/auth/logout", () => {
	beforeEach(() => {
		process.env.SESSION_SECRET = "test-session-secret-for-vitest";
	});

	it("returns 200 and clears session", async () => {
		const sessionCookie = createSessionCookie("user-123", process.env.SESSION_SECRET!);
		const token = sessionCookie.split(`${SESSION_COOKIE_NAME}=`)[1]?.split(";")[0];

		const response = await POST(
			new Request("http://localhost/api/auth/logout", {
				method: "POST",
				headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
			}),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.message).toBe("Logged out successfully");
		expect(body.redirectTo).toBe("/login");

		const cookies = response.headers.getSetCookie();
		expect(cookies.some((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
	});
});
