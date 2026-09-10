import { describe, it, expect } from "vitest";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";
import {
	getHomeRedirectPath,
	getRedirectPathIfUnauthenticated,
	isAuthenticatedRequest,
} from "@/lib/auth-guard";

describe("auth-guard", () => {
	const secret = "test-session-secret-for-vitest";

	it("redirects unauthenticated user to /login", () => {
		const request = new Request("http://localhost/mcqs");

		expect(isAuthenticatedRequest(request, secret)).toBe(false);
	});

	it("allows authenticated user to access /mcqs", () => {
		const sessionCookie = createSessionCookie("user-123", secret);
		const token = sessionCookie.split(`${SESSION_COOKIE_NAME}=`)[1]?.split(";")[0];

		const request = new Request("http://localhost/mcqs", {
			headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
		});

		expect(isAuthenticatedRequest(request, secret)).toBe(true);
	});
});

describe("getHomeRedirectPath", () => {
	it("returns /login when user is not authenticated", () => {
		expect(getHomeRedirectPath(false)).toBe("/login");
	});

	it("returns /mcqs when user is authenticated", () => {
		expect(getHomeRedirectPath(true)).toBe("/mcqs");
	});
});

describe("getRedirectPathIfUnauthenticated", () => {
	it("returns /login when user id is missing", () => {
		expect(getRedirectPathIfUnauthenticated(null)).toBe("/login");
	});

	it("returns null when user id is present", () => {
		expect(getRedirectPathIfUnauthenticated("user-123")).toBeNull();
	});
});
