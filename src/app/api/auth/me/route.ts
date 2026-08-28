import { NextResponse } from "next/server";
import { toPublicUser } from "@/lib/auth-utils";
import { getDb } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { getUserById } from "@/lib/user-service";

export async function GET(request: Request) {
	const userId = getSessionUserId(request);
	if (!userId) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const db = await getDb();
	const user = await getUserById(db, userId);
	if (!user) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	return NextResponse.json({ user: toPublicUser(user) }, { status: 200 });
}
