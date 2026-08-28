"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AuthApiResponse } from "@/lib/auth-utils";
import { validateLoginInput } from "@/lib/validation/auth";

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const router = useRouter();
	const [emailOrUsername, setEmailOrUsername] = useState("");
	const [password, setPassword] = useState("");
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		const validation = validateLoginInput({ emailOrUsername, password });
		if (!validation.success) {
			setFieldErrors(validation.errors);
			return;
		}

		setFieldErrors({});
		setIsSubmitting(true);

		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validation.data),
			});

			const body = (await response.json()) as AuthApiResponse;

			if (!response.ok) {
				if (response.status === 400 && body.errors) {
					setFieldErrors(body.errors);
					return;
				}

				setFormError(body.error ?? "Unable to log in. Please try again.");
				return;
			}

			router.push(body.redirectTo ?? "/mcqs");
		} catch {
			setFormError("Unable to log in. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>Login to your account</CardTitle>
					<CardDescription>
						Enter your email or username below to login to your account
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							{formError ? <FieldError>{formError}</FieldError> : null}
							<Field data-invalid={!!fieldErrors.emailOrUsername}>
								<FieldLabel htmlFor="emailOrUsername">Email or Username</FieldLabel>
								<Input
									id="emailOrUsername"
									type="text"
									placeholder="jane@school.edu or jsmith"
									value={emailOrUsername}
									onChange={(event) => setEmailOrUsername(event.target.value)}
									aria-invalid={!!fieldErrors.emailOrUsername}
								/>
								{fieldErrors.emailOrUsername ? (
									<FieldError>{fieldErrors.emailOrUsername}</FieldError>
								) : null}
							</Field>
							<Field data-invalid={!!fieldErrors.password}>
								<FieldLabel htmlFor="password">Password</FieldLabel>
								<Input
									id="password"
									type="password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									aria-invalid={!!fieldErrors.password}
								/>
								{fieldErrors.password ? (
									<FieldError>{fieldErrors.password}</FieldError>
								) : null}
							</Field>
							<Field>
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Logging in..." : "Login"}
								</Button>
								<FieldDescription className="text-center">
									Don&apos;t have an account?{" "}
									<Link href="/register" className="underline underline-offset-4">
										Sign up
									</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
