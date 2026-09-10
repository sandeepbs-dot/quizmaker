import type {
	CreateMcqInput,
	Mcq,
	McqAttempt,
	McqWithChoices,
} from "@/lib/mcq-service";

export const sampleMcq: Mcq = {
	id: "mcq-123",
	name: "Photosynthesis",
	question: "What do plants use to make food?",
	createdByUserId: "user-123",
	createdAt: "2026-01-01 00:00:00",
	updatedAt: "2026-01-01 00:00:00",
};

export const sampleMcqWithChoices: McqWithChoices = {
	...sampleMcq,
	choices: [
		{
			id: "choice-1",
			mcqId: sampleMcq.id,
			choiceText: "Sunlight",
			isCorrect: true,
			sortOrder: 0,
			createdAt: "2026-01-01 00:00:00",
			updatedAt: "2026-01-01 00:00:00",
		},
		{
			id: "choice-2",
			mcqId: sampleMcq.id,
			choiceText: "Moonlight",
			isCorrect: false,
			sortOrder: 1,
			createdAt: "2026-01-01 00:00:00",
			updatedAt: "2026-01-01 00:00:00",
		},
	],
};

export const sampleAttempt: McqAttempt = {
	id: "attempt-1",
	mcqId: sampleMcq.id,
	userId: "user-123",
	choiceId: "choice-2",
	isCorrect: false,
	createdAt: "2026-01-01 00:00:00",
};

export const validMcqPayload = {
	name: "Photosynthesis",
	question: "What do plants use to make food?",
	choices: [
		{ choiceText: "Sunlight", isCorrect: true },
		{ choiceText: "Moonlight", isCorrect: false },
	],
};

export const validAttemptPayload = {
	choiceId: "choice-1",
};

export function buildCreateMcqInput(
	createdByUserId: string,
	overrides: Partial<Omit<CreateMcqInput, "createdByUserId">> = {},
): CreateMcqInput {
	return {
		name: validMcqPayload.name,
		question: validMcqPayload.question,
		createdByUserId,
		choices: validMcqPayload.choices,
		...overrides,
	};
}
