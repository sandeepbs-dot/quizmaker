import { describe, it, expect, vi, beforeEach } from "vitest";
import { sampleUser } from "@/test/fixtures/users";
import {
	sampleMcq,
	sampleMcqWithChoices,
	validMcqPayload,
} from "@/test/fixtures/mcqs";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

vi.mock("@/lib/mcq-service", () => ({
	createMcq: vi.fn(),
	listMcqs: vi.fn(),
}));

import { GET, POST } from "./route";
import { getDb } from "@/lib/db";
import { createMcq, listMcqs } from "@/lib/mcq-service";

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

describe("/api/mcqs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.SESSION_SECRET = "test-session-secret-for-vitest";
		vi.mocked(getDb).mockResolvedValue({} as D1Database);
	});

	describe("GET", () => {
		it("returns 200 and mcqs list when authenticated", async () => {
			vi.mocked(listMcqs).mockResolvedValue([sampleMcq]);

			const response = await GET(
				createAuthenticatedRequest("http://localhost/api/mcqs"),
			);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.mcqs).toHaveLength(1);
			expect(body.mcqs[0].id).toBe(sampleMcq.id);
		});

		it("returns 401 when not authenticated", async () => {
			const response = await GET(new Request("http://localhost/api/mcqs"));

			expect(response.status).toBe(401);
		});
	});

	describe("POST", () => {
		it("returns 201 and mcq on valid create", async () => {
			vi.mocked(createMcq).mockResolvedValue(sampleMcqWithChoices);

			const response = await POST(
				createAuthenticatedRequest("http://localhost/api/mcqs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(validMcqPayload),
				}),
			);

			expect(response.status).toBe(201);
			const body = await response.json();
			expect(body.mcq.id).toBe(sampleMcqWithChoices.id);
			expect(body.mcq.choices).toHaveLength(2);
			expect(createMcq).toHaveBeenCalledWith(
				{},
				expect.objectContaining({
					createdByUserId: sampleUser.id,
					name: validMcqPayload.name,
				}),
			);
		});

		it("returns 400 on validation failure", async () => {
			const response = await POST(
				createAuthenticatedRequest("http://localhost/api/mcqs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ ...validMcqPayload, name: "" }),
				}),
			);

			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.errors.name).toBeTruthy();
		});

		it("returns 401 when not authenticated", async () => {
			const response = await POST(
				new Request("http://localhost/api/mcqs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(validMcqPayload),
				}),
			);

			expect(response.status).toBe(401);
		});
	});
});
