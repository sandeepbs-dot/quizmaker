import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { deleteMcq, getMcqById, updateMcq } from "@/lib/mcq-service";
import { validateCreateMcqInput } from "@/lib/validation/mcq";

type RouteContext = {
	params: Promise<{ id: string }>;
};

function unauthorizedResponse() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function GET(request: Request, context: RouteContext) {
	const userId = getAuthenticatedUserIdFromRequest(request);
	if (!userId) {
		return unauthorizedResponse();
	}

	const { id } = await context.params;
	const db = await getDb();
	const mcq = await getMcqById(db, id);

	if (!mcq) {
		return NextResponse.json({ error: "MCQ not found" }, { status: 404 });
	}

	return NextResponse.json({ mcq }, { status: 200 });
}

export async function PUT(request: Request, context: RouteContext) {
	const userId = getAuthenticatedUserIdFromRequest(request);
	if (!userId) {
		return unauthorizedResponse();
	}

	const { id } = await context.params;

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
	const mcq = await updateMcq(db, id, {
		name: validation.data.name,
		question: validation.data.question,
		choices: validation.data.choices,
	});

	if (!mcq) {
		return NextResponse.json({ error: "MCQ not found" }, { status: 404 });
	}

	return NextResponse.json({ mcq }, { status: 200 });
}

export async function DELETE(request: Request, context: RouteContext) {
	const userId = getAuthenticatedUserIdFromRequest(request);
	if (!userId) {
		return unauthorizedResponse();
	}

	const { id } = await context.params;
	const db = await getDb();
	const deleted = await deleteMcq(db, id);

	if (!deleted) {
		return NextResponse.json({ error: "MCQ not found" }, { status: 404 });
	}

	return NextResponse.json(
		{ message: "MCQ deleted successfully" },
		{ status: 200 },
	);
}
