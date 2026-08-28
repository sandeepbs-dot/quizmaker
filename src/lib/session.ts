import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "quizmaker_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getSessionSecret(): string {
	return process.env.SESSION_SECRET ?? "dev-session-secret";
}

function signPayload(payload: string, secret: string): string {
	return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, secret: string): string {
	const payload = Buffer.from(JSON.stringify({ userId })).toString("base64url");
	const signature = signPayload(payload, secret);
	return `${payload}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): string | null {
	const [payload, signature] = token.split(".");
	if (!payload || !signature) {
		return null;
	}

	const expectedSignature = signPayload(payload, secret);

	try {
		const signatureBuffer = Buffer.from(signature);
		const expectedBuffer = Buffer.from(expectedSignature);

		if (
			signatureBuffer.length !== expectedBuffer.length ||
			!timingSafeEqual(signatureBuffer, expectedBuffer)
		) {
			return null;
		}
	} catch {
		return null;
	}

	try {
		const data = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf-8"),
		) as { userId?: string };

		return data.userId ?? null;
	} catch {
		return null;
	}
}

function parseCookieHeader(cookieHeader: string, name: string): string | null {
	const cookies = cookieHeader.split(";").map((part) => part.trim());

	for (const cookie of cookies) {
		const separatorIndex = cookie.indexOf("=");
		if (separatorIndex === -1) {
			continue;
		}

		const cookieName = cookie.slice(0, separatorIndex);
		if (cookieName === name) {
			return cookie.slice(separatorIndex + 1);
		}
	}

	return null;
}

export function createSessionCookie(
	userId: string,
	secret = getSessionSecret(),
): string {
	const token = createSessionToken(userId, secret);
	const parts = [
		`${SESSION_COOKIE_NAME}=${token}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${SESSION_MAX_AGE_SECONDS}`,
	];

	if (process.env.NODE_ENV === "production") {
		parts.push("Secure");
	}

	return parts.join("; ");
}

export function clearSessionCookie(): string {
	const parts = [
		`${SESSION_COOKIE_NAME}=`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		"Max-Age=0",
	];

	if (process.env.NODE_ENV === "production") {
		parts.push("Secure");
	}

	return parts.join("; ");
}

export function getSessionUserId(
	request: Request,
	secret = getSessionSecret(),
): string | null {
	const cookieHeader = request.headers.get("cookie");
	if (!cookieHeader) {
		return null;
	}

	const token = parseCookieHeader(cookieHeader, SESSION_COOKIE_NAME);
	if (!token) {
		return null;
	}

	return verifySessionToken(token, secret);
}

export function applySessionCookie(
	response: Response,
	userId: string,
	secret = getSessionSecret(),
): Response {
	const headers = new Headers(response.headers);
	headers.append("Set-Cookie", createSessionCookie(userId, secret));

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export function applyClearSessionCookie(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.append("Set-Cookie", clearSessionCookie());

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
