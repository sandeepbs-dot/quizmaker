"use client";

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
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { validateCreateMcqInput } from "@/lib/validation/mcq";

type ChoiceRow = {
	choiceText: string;
	isCorrect: boolean;
};

interface McqFormProps {
	mode: "create" | "edit";
	mcqId?: string;
	initialValues?: {
		name: string;
		question: string;
		choices: ChoiceRow[];
	};
}

function createDefaultChoices(): ChoiceRow[] {
	return [
		{ choiceText: "", isCorrect: true },
		{ choiceText: "", isCorrect: false },
	];
}

export function McqForm({ mode, mcqId, initialValues }: McqFormProps) {
	const router = useRouter();
	const [name, setName] = useState(initialValues?.name ?? "");
	const [question, setQuestion] = useState(initialValues?.question ?? "");
	const [choices, setChoices] = useState<ChoiceRow[]>(
		initialValues?.choices ?? createDefaultChoices(),
	);
	const [correctIndex, setCorrectIndex] = useState(
		String(initialValues?.choices.findIndex((choice) => choice.isCorrect) ?? 0),
	);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	function updateChoicesWithCorrectIndex(index: number) {
		setChoices((current) =>
			current.map((choice, choiceIndex) => ({
				...choice,
				isCorrect: choiceIndex === index,
			})),
		);
	}

	function handleCorrectIndexChange(value: string) {
		setCorrectIndex(value);
		updateChoicesWithCorrectIndex(Number(value));
	}

	function handleChoiceTextChange(index: number, value: string) {
		setChoices((current) =>
			current.map((choice, choiceIndex) =>
				choiceIndex === index ? { ...choice, choiceText: value } : choice,
			),
		);
	}

	function handleAddChoice() {
		if (choices.length >= 6) {
			return;
		}

		setChoices((current) => [...current, { choiceText: "", isCorrect: false }]);
	}

	function handleRemoveChoice(index: number) {
		if (choices.length <= 2) {
			return;
		}

		const nextChoices = choices.filter((_, choiceIndex) => choiceIndex !== index);
		const nextCorrectIndex = Math.min(
			Number(correctIndex),
			nextChoices.length - 1,
		);

		setChoices(
			nextChoices.map((choice, choiceIndex) => ({
				...choice,
				isCorrect: choiceIndex === nextCorrectIndex,
			})),
		);
		setCorrectIndex(String(nextCorrectIndex));
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		const payloadChoices = choices.map((choice, index) => ({
			choiceText: choice.choiceText,
			isCorrect: index === Number(correctIndex),
		}));

		const validation = validateCreateMcqInput({
			name,
			question,
			choices: payloadChoices,
		});

		if (!validation.success) {
			setFieldErrors(validation.errors);
			return;
		}

		setFieldErrors({});
		setIsSubmitting(true);

		try {
			const url = mode === "create" ? "/api/mcqs" : `/api/mcqs/${mcqId}`;
			const method = mode === "create" ? "POST" : "PUT";

			const response = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validation.data),
			});

			const body = (await response.json()) as {
				errors?: Record<string, string>;
				error?: string;
			};

			if (!response.ok) {
				if (response.status === 400 && body.errors) {
					setFieldErrors(body.errors);
					return;
				}

				setFormError(body.error ?? "Unable to save this question.");
				return;
			}

			router.push("/mcqs");
		} catch {
			setFormError("Unable to save this question.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className="mx-auto flex min-h-svh w-full max-w-3xl items-start justify-center p-6 md:p-10">
			<Card className="w-full">
				<CardHeader>
					<CardTitle>
						{mode === "create" ? "Create MCQ" : "Edit MCQ"}
					</CardTitle>
					<CardDescription>
						Provide a name, question text, and between two and six answer
						choices. Mark exactly one choice as correct.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="mcq-name">Name</FieldLabel>
								<Input
									id="mcq-name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									aria-invalid={Boolean(fieldErrors.name)}
								/>
								{fieldErrors.name ? (
									<FieldError role="alert">{fieldErrors.name}</FieldError>
								) : null}
							</Field>

							<Field>
								<FieldLabel htmlFor="mcq-question">Question</FieldLabel>
								<Textarea
									id="mcq-question"
									value={question}
									onChange={(event) => setQuestion(event.target.value)}
									aria-invalid={Boolean(fieldErrors.question)}
								/>
								{fieldErrors.question ? (
									<FieldError role="alert">{fieldErrors.question}</FieldError>
								) : null}
							</Field>

							<Field>
								<FieldLabel>Choices</FieldLabel>
								<RadioGroup
									value={correctIndex}
									onValueChange={handleCorrectIndexChange}
									className="gap-4"
								>
									{choices.map((choice, index) => (
										<div
											key={`choice-${index}`}
											className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end"
										>
											<div className="flex flex-1 flex-col gap-2">
												<FieldLabel htmlFor={`choice-text-${index}`}>
													Choice {index + 1} text
												</FieldLabel>
												<Input
													id={`choice-text-${index}`}
													value={choice.choiceText}
													onChange={(event) =>
														handleChoiceTextChange(index, event.target.value)
													}
												/>
											</div>
											<div className="flex items-center gap-2 pb-1">
												<RadioGroupItem
													value={String(index)}
													id={`choice-correct-${index}`}
													aria-label={`Mark choice ${index + 1} as correct`}
												/>
												<FieldLabel htmlFor={`choice-correct-${index}`}>
													Correct
												</FieldLabel>
											</div>
											<Button
												type="button"
												variant="outline"
												onClick={() => handleRemoveChoice(index)}
												disabled={choices.length <= 2}
												aria-label={`Remove choice ${index + 1}`}
											>
												Remove choice
											</Button>
										</div>
									))}
								</RadioGroup>
								{fieldErrors.choices ? (
									<FieldError role="alert">{fieldErrors.choices}</FieldError>
								) : null}
								<Button
									type="button"
									variant="outline"
									onClick={handleAddChoice}
									disabled={choices.length >= 6}
									className="mt-3"
								>
									Add choice
								</Button>
							</Field>

							{formError ? (
								<p className="text-sm text-destructive" role="alert">
									{formError}
								</p>
							) : null}

							<div className="flex flex-wrap gap-2">
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Saving..." : "Save"}
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => router.push("/mcqs")}
								>
									Cancel
								</Button>
							</div>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
