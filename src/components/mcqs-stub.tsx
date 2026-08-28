"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AuthApiResponse, PublicUser } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface McqsStubProps {
	user: PublicUser;
}

export function McqsStub({ user }: McqsStubProps) {
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	async function handleLogout() {
		setIsLoggingOut(true);

		try {
			const response = await fetch("/api/auth/logout", { method: "POST" });
			const body = (await response.json()) as AuthApiResponse;

			if (response.ok) {
				router.push(body.redirectTo ?? "/login");
			}
		} finally {
			setIsLoggingOut(false);
		}
	}

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-lg">
				<Card>
					<CardHeader>
						<CardTitle>
							Welcome, {user.firstName} {user.lastName}
						</CardTitle>
						<CardDescription>
							MCQ features are coming soon. You are signed in and ready to
							collaborate on the test bank.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							type="button"
							variant="outline"
							onClick={handleLogout}
							disabled={isLoggingOut}
						>
							{isLoggingOut ? "Logging out..." : "Log out"}
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
