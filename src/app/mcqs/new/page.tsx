import { McqForm } from "@/components/mcq-form";
import { requireAuthenticatedUserIdForPage } from "@/lib/auth-guard";

export default async function NewMcqPage() {
	await requireAuthenticatedUserIdForPage();

	return <McqForm mode="create" />;
}
