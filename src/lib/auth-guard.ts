import { cookies } from "next/headers";
import {
	getSessionSecret,
	getSessionUserId,
	SESSION_COOKIE_NAME,
	verifySessionToken,
} from "@/lib/session";

export function isAuthenticatedRequest(
	request: Request,
	secret?: string,
): boolean {
	return getSessionUserId(request, secret) !== null;
}

export function getLoginRedirectPath(): string {
	return "/login";
}

export function getHomeRedirectPath(isAuthenticated: boolean): string {
	return isAuthenticated ? "/mcqs" : "/login";
}

export async function getAuthenticatedUserIdFromCookies(): Promise<string | null> {
	const cookieStore = await cookies();
	const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

	if (!token) {
		return null;
	}

	return verifySessionToken(token, getSessionSecret());
}
