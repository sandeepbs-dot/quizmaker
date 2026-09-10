import { randomBytes } from "node:crypto";

export interface Mcq {
	id: string;
	name: string;
	question: string;
	createdByUserId: string;
	createdAt: string;
	updatedAt: string;
}

export interface McqChoice {
	id: string;
	mcqId: string;
	choiceText: string;
	isCorrect: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface McqWithChoices extends Mcq {
	choices: McqChoice[];
}

export interface McqAttempt {
	id: string;
	mcqId: string;
	userId: string;
	choiceId: string;
	isCorrect: boolean;
	createdAt: string;
}

export interface CreateMcqChoiceInput {
	choiceText: string;
	isCorrect: boolean;
}

export interface CreateMcqInput {
	name: string;
	question: string;
	createdByUserId: string;
	choices: CreateMcqChoiceInput[];
}

export interface UpdateMcqInput {
	name?: string;
	question?: string;
	choices?: CreateMcqChoiceInput[];
}

export interface CreateAttemptInput {
	mcqId: string;
	userId: string;
	choiceId: string;
}

export class McqValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "McqValidationError";
	}
}

type McqRow = {
	id: string;
	name: string;
	question: string;
	created_by_user_id: string;
	created_at: string;
	updated_at: string;
};

type McqChoiceRow = {
	id: string;
	mcq_id: string;
	choice_text: string;
	is_correct: number;
	sort_order: number;
	created_at: string;
	updated_at: string;
};

type McqAttemptRow = {
	id: string;
	mcq_id: string;
	user_id: string;
	choice_id: string;
	is_correct: number;
	created_at: string;
};

function generateId(): string {
	return randomBytes(16).toString("hex");
}

function rowToMcq(row: McqRow): Mcq {
	return {
		id: row.id,
		name: row.name,
		question: row.question,
		createdByUserId: row.created_by_user_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function rowToChoice(row: McqChoiceRow): McqChoice {
	return {
		id: row.id,
		mcqId: row.mcq_id,
		choiceText: row.choice_text,
		isCorrect: row.is_correct === 1,
		sortOrder: row.sort_order,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function rowToAttempt(row: McqAttemptRow): McqAttempt {
	return {
		id: row.id,
		mcqId: row.mcq_id,
		userId: row.user_id,
		choiceId: row.choice_id,
		isCorrect: row.is_correct === 1,
		createdAt: row.created_at,
	};
}

function assertValidChoices(choices: CreateMcqChoiceInput[]): void {
	if (choices.length < 2 || choices.length > 6) {
		throw new McqValidationError("Each MCQ must have between 2 and 6 choices");
	}

	const correctCount = choices.filter((choice) => choice.isCorrect).length;
	if (correctCount !== 1) {
		throw new McqValidationError("Exactly one choice must be marked as correct");
	}

	for (const choice of choices) {
		if (!choice.choiceText.trim()) {
			throw new McqValidationError("Choice text is required");
		}
	}
}

async function getChoicesForMcq(
	db: D1Database,
	mcqId: string,
): Promise<McqChoice[]> {
	const result = await db
		.prepare(
			`SELECT * FROM mcq_choices
			 WHERE mcq_id = ?1
			 ORDER BY sort_order ASC`,
		)
		.bind(mcqId)
		.all<McqChoiceRow>();

	return result.results.map(rowToChoice);
}

async function replaceChoices(
	db: D1Database,
	mcqId: string,
	choices: CreateMcqChoiceInput[],
): Promise<void> {
	await db
		.prepare("DELETE FROM mcq_attempts WHERE mcq_id = ?1")
		.bind(mcqId)
		.run();

	await db
		.prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1")
		.bind(mcqId)
		.run();

	const statements = choices.map((choice, index) =>
		db
			.prepare(
				`INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, sort_order)
				 VALUES (?1, ?2, ?3, ?4, ?5)`,
			)
			.bind(
				generateId(),
				mcqId,
				choice.choiceText.trim(),
				choice.isCorrect ? 1 : 0,
				index,
			),
	);

	await db.batch(statements);
}

export async function listMcqs(db: D1Database): Promise<Mcq[]> {
	const result = await db
		.prepare(
			`SELECT * FROM mcqs
			 ORDER BY created_at DESC, id DESC`,
		)
		.all<McqRow>();

	return result.results.map(rowToMcq);
}

export async function getMcqById(
	db: D1Database,
	id: string,
): Promise<McqWithChoices | null> {
	const result = await db
		.prepare("SELECT * FROM mcqs WHERE id = ?1")
		.bind(id)
		.all<McqRow>();

	const row = result.results[0];
	if (!row) {
		return null;
	}

	const choices = await getChoicesForMcq(db, id);

	return {
		...rowToMcq(row),
		choices,
	};
}

export async function createMcq(
	db: D1Database,
	input: CreateMcqInput,
): Promise<McqWithChoices> {
	assertValidChoices(input.choices);

	const id = generateId();

	await db
		.prepare(
			`INSERT INTO mcqs (id, name, question, created_by_user_id)
			 VALUES (?1, ?2, ?3, ?4)`,
		)
		.bind(
			id,
			input.name.trim(),
			input.question.trim(),
			input.createdByUserId,
		)
		.run();

	await replaceChoices(db, id, input.choices);

	const mcq = await getMcqById(db, id);
	if (!mcq) {
		throw new Error("Failed to create MCQ");
	}

	return mcq;
}

export async function updateMcq(
	db: D1Database,
	id: string,
	input: UpdateMcqInput,
): Promise<McqWithChoices | null> {
	const existing = await getMcqById(db, id);
	if (!existing) {
		return null;
	}

	const name = input.name?.trim() ?? existing.name;
	const question = input.question?.trim() ?? existing.question;

	if (input.choices) {
		assertValidChoices(input.choices);
	}

	await db
		.prepare(
			`UPDATE mcqs
			 SET name = ?1,
			     question = ?2,
			     updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
			 WHERE id = ?3`,
		)
		.bind(name, question, id)
		.run();

	if (input.choices) {
		await replaceChoices(db, id, input.choices);
	}

	return getMcqById(db, id);
}

export async function deleteMcq(db: D1Database, id: string): Promise<boolean> {
	const result = await db
		.prepare("DELETE FROM mcqs WHERE id = ?1")
		.bind(id)
		.run();

	return (result.meta?.changes ?? 0) > 0;
}

export async function createAttempt(
	db: D1Database,
	input: CreateAttemptInput,
): Promise<McqAttempt> {
	const mcq = await getMcqById(db, input.mcqId);
	if (!mcq) {
		throw new McqValidationError("MCQ not found");
	}

	const choice = mcq.choices.find((item) => item.id === input.choiceId);
	if (!choice) {
		throw new McqValidationError("Choice does not belong to this MCQ");
	}

	const id = generateId();

	await db
		.prepare(
			`INSERT INTO mcq_attempts (id, mcq_id, user_id, choice_id, is_correct)
			 VALUES (?1, ?2, ?3, ?4, ?5)`,
		)
		.bind(
			id,
			input.mcqId,
			input.userId,
			input.choiceId,
			choice.isCorrect ? 1 : 0,
		)
		.run();

	const result = await db
		.prepare("SELECT * FROM mcq_attempts WHERE id = ?1")
		.bind(id)
		.all<McqAttemptRow>();

	const row = result.results[0];
	if (!row) {
		throw new Error("Failed to create attempt");
	}

	return rowToAttempt(row);
}
