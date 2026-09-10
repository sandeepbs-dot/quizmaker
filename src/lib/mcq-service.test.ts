import { describe, it, expect, beforeEach } from "vitest";
import { createMockD1WithMcqSchema } from "@/test/mock-d1";
import { buildCreateUserInput } from "@/test/fixtures/users";
import { buildCreateMcqInput as buildMcqInput } from "@/test/fixtures/mcqs";
import { createUser } from "@/lib/user-service";
import {
	createAttempt,
	createMcq,
	deleteMcq,
	getMcqById,
	listMcqs,
	McqValidationError,
	updateMcq,
} from "@/lib/mcq-service";

describe("mcq-service", () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let db: any;
	let userId: string;

	beforeEach(async () => {
		db = createMockD1WithMcqSchema();
		const user = await createUser(db, buildCreateUserInput());
		userId = user.id;
	});

	it("listMcqs returns all mcqs ordered by created_at desc", async () => {
		const first = await createMcq(db, buildMcqInput(userId, { name: "First" }));
		const second = await createMcq(
			db,
			buildMcqInput(userId, { name: "Second" }),
		);

		db.getSqliteDatabase()
			.prepare(
				`UPDATE mcqs SET created_at = '2026-01-01 00:00:00' WHERE id = ?`,
			)
			.run(first.id);
		db.getSqliteDatabase()
			.prepare(
				`UPDATE mcqs SET created_at = '2026-01-02 00:00:00' WHERE id = ?`,
			)
			.run(second.id);

		const mcqs = await listMcqs(db);

		expect(mcqs).toHaveLength(2);
		expect(mcqs[0]?.id).toBe(second.id);
		expect(mcqs[1]?.id).toBe(first.id);
	});

	it("getMcqById returns mcq with ordered choices", async () => {
		const created = await createMcq(
			db,
			buildMcqInput(userId, {
				choices: [
					{ choiceText: "Second", isCorrect: false },
					{ choiceText: "First", isCorrect: true },
					{ choiceText: "Third", isCorrect: false },
				],
			}),
		);

		const mcq = await getMcqById(db, created.id);

		expect(mcq).not.toBeNull();
		expect(mcq?.choices.map((choice) => choice.choiceText)).toEqual([
			"Second",
			"First",
			"Third",
		]);
		expect(mcq?.choices.map((choice) => choice.sortOrder)).toEqual([0, 1, 2]);
	});

	it("getMcqById returns null when not found", async () => {
		const mcq = await getMcqById(db, "missing-id");

		expect(mcq).toBeNull();
	});

	it("createMcq inserts mcq and choices", async () => {
		const created = await createMcq(db, buildMcqInput(userId));

		expect(created.id).toBeTruthy();
		expect(created.name).toBe("Photosynthesis");
		expect(created.question).toBe("What do plants use to make food?");
		expect(created.choices).toHaveLength(2);
		expect(created.choices.every((choice) => choice.id)).toBe(true);
	});

	it("createMcq persists created_by_user_id", async () => {
		const created = await createMcq(db, buildMcqInput(userId));

		expect(created.createdByUserId).toBe(userId);
	});

	it("createMcq assigns sort_order from array index", async () => {
		const created = await createMcq(
			db,
			buildMcqInput(userId, {
				choices: [
					{ choiceText: "A", isCorrect: true },
					{ choiceText: "B", isCorrect: false },
					{ choiceText: "C", isCorrect: false },
				],
			}),
		);

		expect(created.choices.map((choice) => choice.sortOrder)).toEqual([0, 1, 2]);
	});

	it("updateMcq updates fields and replaces choices", async () => {
		const created = await createMcq(db, buildMcqInput(userId));

		const updated = await updateMcq(db, created.id, {
			name: "Updated name",
			question: "Updated question?",
			choices: [
				{ choiceText: "New A", isCorrect: false },
				{ choiceText: "New B", isCorrect: true },
				{ choiceText: "New C", isCorrect: false },
			],
		});

		expect(updated).not.toBeNull();
		expect(updated?.name).toBe("Updated name");
		expect(updated?.question).toBe("Updated question?");
		expect(updated?.choices.map((choice) => choice.choiceText)).toEqual([
			"New A",
			"New B",
			"New C",
		]);
		expect(updated?.choices.find((choice) => choice.isCorrect)?.choiceText).toBe(
			"New B",
		);
	});

	it("updateMcq does not change created_by_user_id", async () => {
		const created = await createMcq(db, buildMcqInput(userId));

		const updated = await updateMcq(db, created.id, {
			name: "Renamed only",
		});

		expect(updated?.createdByUserId).toBe(userId);
		expect(updated?.createdByUserId).toBe(created.createdByUserId);
	});

	it("updateMcq returns null for unknown id", async () => {
		const updated = await updateMcq(db, "missing-id", { name: "Nope" });

		expect(updated).toBeNull();
	});

	it("deleteMcq removes mcq and returns true", async () => {
		const created = await createMcq(db, buildMcqInput(userId));

		const deleted = await deleteMcq(db, created.id);

		expect(deleted).toBe(true);
		expect(await getMcqById(db, created.id)).toBeNull();
	});

	it("deleteMcq returns false for unknown id", async () => {
		const deleted = await deleteMcq(db, "missing-id");

		expect(deleted).toBe(false);
	});

	it("createAttempt records is_correct from choice", async () => {
		const created = await createMcq(db, buildMcqInput(userId));
		const incorrectChoice = created.choices.find((choice) => !choice.isCorrect)!;

		const attempt = await createAttempt(db, {
			mcqId: created.id,
			userId,
			choiceId: incorrectChoice.id,
		});

		expect(attempt.isCorrect).toBe(false);
		expect(attempt.choiceId).toBe(incorrectChoice.id);
		expect(attempt.userId).toBe(userId);
	});

	it("createAttempt rejects choice not belonging to mcq", async () => {
		const created = await createMcq(db, buildMcqInput(userId));
		const other = await createMcq(
			db,
			buildMcqInput(userId, { name: "Other question" }),
		);
		const foreignChoiceId = other.choices[0]!.id;

		await expect(
			createAttempt(db, {
				mcqId: created.id,
				userId,
				choiceId: foreignChoiceId,
			}),
		).rejects.toBeInstanceOf(McqValidationError);
	});
});
