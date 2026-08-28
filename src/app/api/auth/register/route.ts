import { NextResponse } from "next/server";
import { toPublicUser } from "@/lib/auth-utils";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { applySessionCookie } from "@/lib/session";
import {
	createUser,
	getUserByEmail,
	getUserByUsername,
} from "@/lib/user-service";
import { validateRegisterInput } from "@/lib/validation/auth";

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

	const validation = validateRegisterInput(body);
	if (!validation.success) {
		return NextResponse.json({ errors: validation.errors }, { status: 400 });
	}

	const db = await getDb();
	const existingEmail = await getUserByEmail(db, validation.data.email);
	if (existingEmail) {
		return NextResponse.json(
			{ error: "Email already registered" },
			{ status: 409 },
		);
	}

	const existingUsername = await getUserByUsername(db, validation.data.username);
	if (existingUsername) {
		return NextResponse.json(
			{ error: "Username already taken" },
			{ status: 409 },
		);
	}

	const passwordHash = await hashPassword(validation.data.password);
	const user = await createUser(db, {
		firstName: validation.data.firstName,
		lastName: validation.data.lastName,
		username: validation.data.username,
		email: validation.data.email,
		passwordHash,
	});

	const response = NextResponse.json(
		{ user: toPublicUser(user), redirectTo: "/mcqs" },
		{ status: 201 },
	);

	return applySessionCookie(response, user.id);
}
