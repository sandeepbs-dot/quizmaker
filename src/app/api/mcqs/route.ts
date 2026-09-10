import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { createMcq, listMcqs } from "@/lib/mcq-service";
import { validateCreateMcqInput } from "@/lib/validation/mcq";

function unauthorizedResponse() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function GET(request: Request) {
	const userId = getAuthenticatedUserIdFromRequest(request);
	if (!userId) {
		return unauthorizedResponse();
	}

	const db = await getDb();
	const mcqs = await listMcqs(db);

	return NextResponse.json({ mcqs }, { status: 200 });
}

export async function POST(request: Request) {
	const userId = getAuthenticatedUserIdFromRequest(request);
	if (!userId) {
		return unauthorizedResponse();
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ errors: { form: "Invalid JSON body" } },
			{ status: 400 },
		);
	}

	const validation = validateCreateMcqInput(body);
	if (!validation.success) {
		return NextResponse.json({ errors: validation.errors }, { status: 400 });
	}

	const db = await getDb();
	const mcq = await createMcq(db, {
		name: validation.data.name,
		question: validation.data.question,
		createdByUserId: userId,
		choices: validation.data.choices,
	});

	return NextResponse.json({ mcq }, { status: 201 });
}
