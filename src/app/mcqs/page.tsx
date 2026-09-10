import { redirect } from "next/navigation";
import { McqList } from "@/components/mcq-list";
import { toPublicUser } from "@/lib/auth-utils";
import {
	getAuthenticatedUserIdFromCookies,
	getLoginRedirectPath,
} from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { listMcqs } from "@/lib/mcq-service";
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

	const mcqs = await listMcqs(db);

	return <McqList user={toPublicUser(user)} mcqs={mcqs} />;
}
