import { redirect } from "next/navigation";
import { McqsStub } from "@/components/mcqs-stub";
import { toPublicUser } from "@/lib/auth-utils";
import {
	getAuthenticatedUserIdFromCookies,
	getLoginRedirectPath,
} from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { getUserById } from "@/lib/user-service";

export default async function McqsPage() {
	const userId = await getAuthenticatedUserIdFromCookies();

	if (!userId) {
		redirect(getLoginRedirectPath());
	}

	const db = await getDb();
	const user = await getUserById(db, userId);

	if (!user) {
		redirect(getLoginRedirectPath());
	}

	return <McqsStub user={toPublicUser(user)} />;
}
