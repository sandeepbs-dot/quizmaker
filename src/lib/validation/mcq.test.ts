import { describe, it, expect } from "vitest";
import {
	validateAttemptInput,
	validateCreateMcqInput,
} from "@/lib/validation/mcq";
import { validAttemptPayload, validMcqPayload } from "@/test/fixtures/mcqs";

describe("validateCreateMcqInput", () => {
	it("accepts valid payload", () => {
		const result = validateCreateMcqInput(validMcqPayload);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe(validMcqPayload.name);
			expect(result.data.question).toBe(validMcqPayload.question);
			expect(result.data.choices).toHaveLength(2);
		}
	});

	it("rejects empty name", () => {
		const result = validateCreateMcqInput({
			...validMcqPayload,
			name: "",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.name).toBeTruthy();
		}
	});

	it("rejects empty question", () => {
		const result = validateCreateMcqInput({
			...validMcqPayload,
			question: "",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.question).toBeTruthy();
		}
	});

	it("rejects fewer than 2 choices", () => {
		const result = validateCreateMcqInput({
			...validMcqPayload,
			choices: [{ choiceText: "Only one", isCorrect: true }],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.choices).toBeTruthy();
		}
	});

	it("rejects more than 6 choices", () => {
		const result = validateCreateMcqInput({
			...validMcqPayload,
			choices: Array.from({ length: 7 }, (_, index) => ({
				choiceText: `Choice ${index + 1}`,
				isCorrect: index === 0,
			})),
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.choices).toBeTruthy();
		}
	});

	it("rejects zero correct answers", () => {
		const result = validateCreateMcqInput({
			...validMcqPayload,
			choices: [
				{ choiceText: "Sunlight", isCorrect: false },
				{ choiceText: "Moonlight", isCorrect: false },
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.choices).toBeTruthy();
		}
	});

	it("rejects multiple correct answers", () => {
		const result = validateCreateMcqInput({
			...validMcqPayload,
			choices: [
				{ choiceText: "Sunlight", isCorrect: true },
				{ choiceText: "Moonlight", isCorrect: true },
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.choices).toBeTruthy();
		}
	});

	it("rejects empty choice text", () => {
		const result = validateCreateMcqInput({
			...validMcqPayload,
			choices: [
				{ choiceText: "Sunlight", isCorrect: true },
				{ choiceText: "   ", isCorrect: false },
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.choices).toBeTruthy();
		}
	});
});

describe("validateAttemptInput", () => {
	it("accepts valid choiceId", () => {
		const result = validateAttemptInput(validAttemptPayload);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.choiceId).toBe(validAttemptPayload.choiceId);
		}
	});

	it("rejects missing choiceId", () => {
		const result = validateAttemptInput({});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.choiceId).toBeTruthy();
		}
	});
});
