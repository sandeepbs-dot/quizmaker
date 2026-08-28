import { redirect } from "next/navigation";
import {
	getAuthenticatedUserIdFromCookies,
	getHomeRedirectPath,
} from "@/lib/auth-guard";

export default async function HomePage() {
	const userId = await getAuthenticatedUserIdFromCookies();

	redirect(getHomeRedirectPath(userId !== null));
}
