import { redirect, notFound } from "next/navigation";
import { McqPreview } from "@/components/mcq-preview";
import {
	getAuthenticatedUserIdFromCookies,
	getLoginRedirectPath,
} from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { getMcqById } from "@/lib/mcq-service";

type PreviewMcqPageProps = {
	params: Promise<{ id: string }>;
};

export default async function PreviewMcqPage({ params }: PreviewMcqPageProps) {
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

	return <McqPreview mcq={mcq} />;
}
