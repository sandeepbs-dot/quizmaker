import { redirect } from "next/navigation";
import { McqForm } from "@/components/mcq-form";
import {
	getAuthenticatedUserIdFromCookies,
	getLoginRedirectPath,
} from "@/lib/auth-guard";

export default async function NewMcqPage() {
	const userId = await getAuthenticatedUserIdFromCookies();

	if (!userId) {
		redirect(getLoginRedirectPath());
	}

	return <McqForm mode="create" />;
}
