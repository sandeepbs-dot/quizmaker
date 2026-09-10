import { redirect, notFound } from "next/navigation";
import { McqForm } from "@/components/mcq-form";
import {
	getAuthenticatedUserIdFromCookies,
	getLoginRedirectPath,
} from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { getMcqById } from "@/lib/mcq-service";

type EditMcqPageProps = {
	params: Promise<{ id: string }>;
};

export default async function EditMcqPage({ params }: EditMcqPageProps) {
	const userId = await getAuthenticatedUserIdFromCookies();

	if (!userId) {
		redirect(getLoginRedirectPath());
	}

	const { id } = await params;
	const db = await getDb();
	const mcq = await getMcqById(db, id);

	if (!mcq) {
		notFound();
	}

	return (
		<McqForm
			mode="edit"
			mcqId={mcq.id}
			initialValues={{
				name: mcq.name,
				question: mcq.question,
				choices: mcq.choices.map((choice) => ({
					choiceText: choice.choiceText,
					isCorrect: choice.isCorrect,
				})),
			}}
		/>
	);
}
