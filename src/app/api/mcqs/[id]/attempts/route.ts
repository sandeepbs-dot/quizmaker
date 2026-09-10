import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { createAttempt, McqValidationError } from "@/lib/mcq-service";
import { validateAttemptInput } from "@/lib/validation/mcq";

type RouteContext = {
	params: Promise<{ id: string }>;
};

function unauthorizedResponse() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function POST(request: Request, context: RouteContext) {
	const userId = getAuthenticatedUserIdFromRequest(request);
	if (!userId) {
		return unauthorizedResponse();
	}

	const { id: mcqId } = await context.params;

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ errors: { form: "Invalid JSON body" } },
			{ status: 400 },
		);
	}

	const validation = validateAttemptInput(body);
	if (!validation.success) {
		return NextResponse.json({ errors: validation.errors }, { status: 400 });
	}

	try {
		const db = await getDb();
		const attempt = await createAttempt(db, {
			mcqId,
			userId,
			choiceId: validation.data.choiceId,
		});

		return NextResponse.json({ attempt }, { status: 201 });
	} catch (error) {
		if (error instanceof McqValidationError) {
			if (error.message === "MCQ not found") {
				return NextResponse.json({ error: error.message }, { status: 404 });
			}

			return NextResponse.json({ error: error.message }, { status: 400 });
		}

		throw error;
	}
}
