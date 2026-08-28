"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { validateRegisterInput } from "@/lib/validation/auth";

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
	const router = useRouter();
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		const validation = validateRegisterInput({
			firstName,
			lastName,
			username,
			email,
			password,
			confirmPassword,
		});

		if (!validation.success) {
			setFieldErrors(validation.errors);
			return;
		}

		setFieldErrors({});
		setIsSubmitting(true);

		try {
			const response = await fetch("/api/auth/register", {
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

				setFormError(body.error ?? "Unable to create account. Please try again.");
				return;
			}

			router.push(body.redirectTo ?? "/mcqs");
		} catch {
			setFormError("Unable to create account. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Card {...props}>
			<CardHeader>
				<CardTitle>Create an account</CardTitle>
				<CardDescription>
					Enter your information below to create your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						{formError ? <FieldError>{formError}</FieldError> : null}
						<Field data-invalid={!!fieldErrors.firstName}>
							<FieldLabel htmlFor="firstName">First Name</FieldLabel>
							<Input
								id="firstName"
								type="text"
								placeholder="Jane"
								value={firstName}
								onChange={(event) => setFirstName(event.target.value)}
								aria-invalid={!!fieldErrors.firstName}
							/>
							{fieldErrors.firstName ? (
								<FieldError>{fieldErrors.firstName}</FieldError>
							) : null}
						</Field>
						<Field data-invalid={!!fieldErrors.lastName}>
							<FieldLabel htmlFor="lastName">Last Name</FieldLabel>
							<Input
								id="lastName"
								type="text"
								placeholder="Smith"
								value={lastName}
								onChange={(event) => setLastName(event.target.value)}
								aria-invalid={!!fieldErrors.lastName}
							/>
							{fieldErrors.lastName ? (
								<FieldError>{fieldErrors.lastName}</FieldError>
							) : null}
						</Field>
						<Field data-invalid={!!fieldErrors.username}>
							<FieldLabel htmlFor="username">Username</FieldLabel>
							<Input
								id="username"
								type="text"
								placeholder="jsmith"
								value={username}
								onChange={(event) => setUsername(event.target.value)}
								aria-invalid={!!fieldErrors.username}
							/>
							{fieldErrors.username ? (
								<FieldError>{fieldErrors.username}</FieldError>
							) : null}
						</Field>
						<Field data-invalid={!!fieldErrors.email}>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								type="email"
								placeholder="m@example.com"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								aria-invalid={!!fieldErrors.email}
							/>
							<FieldDescription>
								We&apos;ll use this to contact you. We will not share your email
								with anyone else.
							</FieldDescription>
							{fieldErrors.email ? (
								<FieldError>{fieldErrors.email}</FieldError>
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
							<FieldDescription>
								Must be at least 8 characters with uppercase, lowercase, number,
								and special character.
							</FieldDescription>
							{fieldErrors.password ? (
								<FieldError>{fieldErrors.password}</FieldError>
							) : null}
						</Field>
						<Field data-invalid={!!fieldErrors.confirmPassword}>
							<FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
							<Input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(event) => setConfirmPassword(event.target.value)}
								aria-invalid={!!fieldErrors.confirmPassword}
							/>
							<FieldDescription>Please confirm your password.</FieldDescription>
							{fieldErrors.confirmPassword ? (
								<FieldError>{fieldErrors.confirmPassword}</FieldError>
							) : null}
						</Field>
						<Field>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Creating account..." : "Create Account"}
							</Button>
							<FieldDescription className="px-6 text-center">
								Already have an account?{" "}
								<Link href="/login" className="underline underline-offset-4">
									Sign in
								</Link>
							</FieldDescription>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
