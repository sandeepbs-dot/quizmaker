import { describe, it, expect, vi, beforeEach } from "vitest";
import { sampleUser } from "@/test/fixtures/users";
import {
	sampleAttempt,
	sampleMcqWithChoices,
	validAttemptPayload,
} from "@/test/fixtures/mcqs";
import { McqValidationError } from "@/lib/mcq-service";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

vi.mock("@/lib/mcq-service", () => ({
	createAttempt: vi.fn(),
	McqValidationError: class McqValidationError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "McqValidationError";
		}
	},
}));

import { POST } from "./route";
import { getDb } from "@/lib/db";
import { createAttempt } from "@/lib/mcq-service";

function createAuthenticatedRequest(
	url: string,
	init: RequestInit = {},
): Request {
	const sessionCookie = createSessionCookie(
		sampleUser.id,
		process.env.SESSION_SECRET!,
	);
	const token = sessionCookie
		.split(`${SESSION_COOKIE_NAME}=`)[1]
		?.split(";")[0];

	return new Request(url, {
		...init,
		headers: {
			...(init.headers ?? {}),
			cookie: `${SESSION_COOKIE_NAME}=${token}`,
		},
	});
}

const routeContext = { params: Promise.resolve({ id: sampleMcqWithChoices.id }) };

describe("POST /api/mcqs/[id]/attempts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.SESSION_SECRET = "test-session-secret-for-vitest";
		vi.mocked(getDb).mockResolvedValue({} as D1Database);
	});

	it("returns 201 and attempt on valid submit", async () => {
		vi.mocked(createAttempt).mockResolvedValue(sampleAttempt);

		const response = await POST(
			createAuthenticatedRequest(
				`http://localhost/api/mcqs/${sampleMcqWithChoices.id}/attempts`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(validAttemptPayload),
				},
			),
			routeContext,
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.attempt.isCorrect).toBe(false);
		expect(createAttempt).toHaveBeenCalledWith(
			{},
			expect.objectContaining({
				mcqId: sampleMcqWithChoices.id,
				userId: sampleUser.id,
				choiceId: validAttemptPayload.choiceId,
			}),
		);
	});

	it("returns 400 when choice invalid", async () => {
		vi.mocked(createAttempt).mockRejectedValue(
			new McqValidationError("Choice does not belong to this MCQ"),
		);

		const response = await POST(
			createAuthenticatedRequest(
				`http://localhost/api/mcqs/${sampleMcqWithChoices.id}/attempts`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(validAttemptPayload),
				},
			),
			routeContext,
		);

		expect(response.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const response = await POST(
			new Request(
				`http://localhost/api/mcqs/${sampleMcqWithChoices.id}/attempts`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(validAttemptPayload),
				},
			),
			routeContext,
		);

		expect(response.status).toBe(401);
	});

	it("returns 404 when mcq not found", async () => {
		vi.mocked(createAttempt).mockRejectedValue(
			new McqValidationError("MCQ not found"),
		);

		const response = await POST(
			createAuthenticatedRequest(
				`http://localhost/api/mcqs/${sampleMcqWithChoices.id}/attempts`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(validAttemptPayload),
				},
			),
			routeContext,
		);

		expect(response.status).toBe(404);
	});
});
