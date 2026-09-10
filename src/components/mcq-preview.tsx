"use client";

import Link from "next/link";
import { useState } from "react";
import type { McqWithChoices } from "@/lib/mcq-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface McqPreviewProps {
	mcq: McqWithChoices;
}

export function McqPreview({ mcq }: McqPreviewProps) {
	const [selectedChoiceId, setSelectedChoiceId] = useState<string>("");
	const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
	const [formError, setFormError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		if (!selectedChoiceId) {
			setFormError("Select an answer before submitting.");
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch(`/api/mcqs/${mcq.id}/attempts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ choiceId: selectedChoiceId }),
			});

			const body = (await response.json()) as {
				attempt?: { isCorrect: boolean };
				error?: string;
				errors?: Record<string, string>;
			};

			if (!response.ok) {
				setFormError(
					body.error ?? body.errors?.choiceId ?? "Unable to submit answer.",
				);
				return;
			}

			setResult(body.attempt?.isCorrect ? "correct" : "incorrect");
		} catch {
			setFormError("Unable to submit answer.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6 md:p-10">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold">Preview MCQ</h1>
					<p className="text-sm text-muted-foreground">{mcq.name}</p>
				</div>
				<Button variant="outline" render={<Link href="/mcqs" />}>
					Back to list
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{mcq.question}</CardTitle>
					<CardDescription>Select one answer and submit to record a practice attempt.</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<RadioGroup
								value={selectedChoiceId}
								onValueChange={setSelectedChoiceId}
								disabled={result !== null}
							>
								{mcq.choices.map((choice) => (
									<Field key={choice.id} orientation="horizontal">
										<RadioGroupItem
											value={choice.id}
											id={`preview-choice-${choice.id}`}
										/>
										<FieldLabel htmlFor={`preview-choice-${choice.id}`}>
											{choice.choiceText}
										</FieldLabel>
									</Field>
								))}
							</RadioGroup>

							{formError ? (
								<p className="text-sm text-destructive" role="alert">
									{formError}
								</p>
							) : null}

							{result === "correct" ? (
								<Badge variant="default">Correct!</Badge>
							) : null}
							{result === "incorrect" ? (
								<Badge variant="destructive">Incorrect.</Badge>
							) : null}

							<Button type="submit" disabled={isSubmitting || result !== null}>
								{isSubmitting ? "Submitting..." : "Submit answer"}
							</Button>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
