import { NextResponse } from "next/server";
import { applyClearSessionCookie } from "@/lib/session";

export async function POST() {
	const response = NextResponse.json(
		{ message: "Logged out successfully", redirectTo: "/login" },
		{ status: 200 },
	);

	return applyClearSessionCookie(response);
}
