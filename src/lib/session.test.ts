import { describe, it, expect, beforeEach } from "vitest";
import {
	SESSION_COOKIE_NAME,
	clearSessionCookie,
	createSessionCookie,
	getSessionUserId,
} from "@/lib/session";

const TEST_SECRET = "test-session-secret-for-vitest";

describe("session", () => {
	beforeEach(() => {
		process.env.SESSION_SECRET = TEST_SECRET;
	});

	it("createSession sets HttpOnly cookie with user id", () => {
		const cookie = createSessionCookie("user-123", TEST_SECRET);

		expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
	});

	it("getSessionUserId returns id from valid cookie", () => {
		const cookie = createSessionCookie("user-123", TEST_SECRET);
		const token = cookie.split(`${SESSION_COOKIE_NAME}=`)[1]?.split(";")[0];

		const request = new Request("http://localhost/", {
			headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
		});

		expect(getSessionUserId(request, TEST_SECRET)).toBe("user-123");
	});

	it("getSessionUserId returns null when no cookie", () => {
		const request = new Request("http://localhost/");

		expect(getSessionUserId(request, TEST_SECRET)).toBeNull();
	});

	it("getSessionUserId returns null for tampered cookie", () => {
		const cookie = createSessionCookie("user-123", TEST_SECRET);
		const token = cookie.split(`${SESSION_COOKIE_NAME}=`)[1]?.split(";")[0];

		const request = new Request("http://localhost/", {
			headers: { cookie: `${SESSION_COOKIE_NAME}=${token}tampered` },
		});

		expect(getSessionUserId(request, TEST_SECRET)).toBeNull();
	});

	it("destroySession clears session cookie", () => {
		const cookie = clearSessionCookie();

		expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
		expect(cookie).toContain("Max-Age=0");
	});
});
