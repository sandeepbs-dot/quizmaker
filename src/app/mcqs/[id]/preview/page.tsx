import { notFound } from "next/navigation";
import { McqPreview } from "@/components/mcq-preview";
import { requireAuthenticatedUserIdForPage } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { getMcqById } from "@/lib/mcq-service";

type PreviewMcqPageProps = {
	params: Promise<{ id: string }>;
};

export default async function PreviewMcqPage({ params }: PreviewMcqPageProps) {
	await requireAuthenticatedUserIdForPage();

	const { id } = await params;
	const db = await getDb();
	const mcq = await getMcqById(db, id);

	if (!mcq) {
		notFound();
	}

	return <McqPreview mcq={mcq} />;
}
