export type ValidationResult<T> =
	| { success: true; data: T }
	| { success: false; errors: Record<string, string> };

export interface McqChoicePayload {
	choiceText: string;
	isCorrect: boolean;
}

export interface CreateMcqPayload {
	name: string;
	question: string;
	choices: McqChoicePayload[];
}

export interface AttemptPayload {
	choiceId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function requiredString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseChoices(value: unknown): McqChoicePayload[] | null {
	if (!Array.isArray(value)) {
		return null;
	}

	const choices: McqChoicePayload[] = [];

	for (const item of value) {
		if (!isRecord(item)) {
			return null;
		}

		const choiceText = requiredString(item.choiceText);
		if (!choiceText || choiceText.length > 500) {
			return null;
		}

		if (typeof item.isCorrect !== "boolean") {
			return null;
		}

		choices.push({
			choiceText,
			isCorrect: item.isCorrect,
		});
	}

	return choices;
}

function validateChoiceRules(choices: McqChoicePayload[]): string | null {
	if (choices.length < 2 || choices.length > 6) {
		return "Each MCQ must have between 2 and 6 choices";
	}

	const correctCount = choices.filter((choice) => choice.isCorrect).length;
	if (correctCount !== 1) {
		return "Exactly one choice must be marked as correct";
	}

	return null;
}

export function validateCreateMcqInput(
	input: unknown,
): ValidationResult<CreateMcqPayload> {
	const errors: Record<string, string> = {};

	if (!isRecord(input)) {
		return { success: false, errors: { form: "Invalid request body" } };
	}

	const name = requiredString(input.name);
	if (!name || name.length > 200) {
		errors.name = "Name is required";
	}

	const question = requiredString(input.question);
	if (!question || question.length > 2000) {
		errors.question = "Question is required";
	}

	const choices = parseChoices(input.choices);
	if (!choices) {
		errors.choices = "Choices must be a valid array";
	} else {
		const choiceError = validateChoiceRules(choices);
		if (choiceError) {
			errors.choices = choiceError;
		}
	}

	if (Object.keys(errors).length > 0) {
		return { success: false, errors };
	}

	return {
		success: true,
		data: {
			name: name!,
			question: question!,
			choices: choices!,
		},
	};
}

export function validateAttemptInput(
	input: unknown,
): ValidationResult<AttemptPayload> {
	const errors: Record<string, string> = {};

	if (!isRecord(input)) {
		return { success: false, errors: { form: "Invalid request body" } };
	}

	const choiceId = requiredString(input.choiceId);
	if (!choiceId) {
		errors.choiceId = "Choice is required";
	}

	if (Object.keys(errors).length > 0) {
		return { success: false, errors };
	}

	return {
		success: true,
		data: { choiceId: choiceId! },
	};
}
