import { NextResponse } from "next/server";
import { toPublicUser } from "@/lib/auth-utils";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { applySessionCookie } from "@/lib/session";
import { getUserByEmail, getUserByUsername } from "@/lib/user-service";
import { validateLoginInput } from "@/lib/validation/auth";

const INVALID_CREDENTIALS_MESSAGE = "Invalid email/username or password";

function looksLikeEmail(value: string): boolean {
	return value.includes("@");
}

export async function POST(request: Request) {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ errors: { form: "Invalid JSON body" } },
			{ status: 400 },
		);
	}

	const validation = validateLoginInput(body);
	if (!validation.success) {
		return NextResponse.json({ errors: validation.errors }, { status: 400 });
	}

	const db = await getDb();
	const { emailOrUsername, password } = validation.data;

	const user = looksLikeEmail(emailOrUsername)
		? await getUserByEmail(db, emailOrUsername)
		: await getUserByUsername(db, emailOrUsername);

	if (!user || !(await verifyPassword(password, user.passwordHash))) {
		return NextResponse.json(
			{ error: INVALID_CREDENTIALS_MESSAGE },
			{ status: 401 },
		);
	}

	const response = NextResponse.json(
		{ user: toPublicUser(user), redirectTo: "/mcqs" },
		{ status: 200 },
	);

	return applySessionCookie(response, user.id);
}
