import { describe, it, expect, vi, beforeEach } from "vitest";
import { sampleUser } from "@/test/fixtures/users";
import {
	sampleMcqWithChoices,
	validMcqPayload,
} from "@/test/fixtures/mcqs";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

vi.mock("@/lib/mcq-service", () => ({
	deleteMcq: vi.fn(),
	getMcqById: vi.fn(),
	updateMcq: vi.fn(),
}));

import { DELETE, GET, PUT } from "./route";
import { getDb } from "@/lib/db";
import { deleteMcq, getMcqById, updateMcq } from "@/lib/mcq-service";

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

describe("/api/mcqs/[id]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.SESSION_SECRET = "test-session-secret-for-vitest";
		vi.mocked(getDb).mockResolvedValue({} as D1Database);
	});

	describe("GET", () => {
		it("returns 200 and mcq with choices", async () => {
			vi.mocked(getMcqById).mockResolvedValue(sampleMcqWithChoices);

			const response = await GET(
				createAuthenticatedRequest(
					`http://localhost/api/mcqs/${sampleMcqWithChoices.id}`,
				),
				routeContext,
			);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.mcq.id).toBe(sampleMcqWithChoices.id);
			expect(body.mcq.choices).toHaveLength(2);
		});

		it("returns 404 when not found", async () => {
			vi.mocked(getMcqById).mockResolvedValue(null);

			const response = await GET(
				createAuthenticatedRequest("http://localhost/api/mcqs/missing-id"),
				{ params: Promise.resolve({ id: "missing-id" }) },
			);

			expect(response.status).toBe(404);
		});
	});

	describe("PUT", () => {
		it("returns 200 on valid update", async () => {
			const updatedMcq = {
				...sampleMcqWithChoices,
				name: "Updated name",
			};
			vi.mocked(updateMcq).mockResolvedValue(updatedMcq);

			const response = await PUT(
				createAuthenticatedRequest(
					`http://localhost/api/mcqs/${sampleMcqWithChoices.id}`,
					{
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							...validMcqPayload,
							name: "Updated name",
						}),
					},
				),
				routeContext,
			);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.mcq.name).toBe("Updated name");
		});

		it("returns 404 when not found", async () => {
			vi.mocked(updateMcq).mockResolvedValue(null);

			const response = await PUT(
				createAuthenticatedRequest("http://localhost/api/mcqs/missing-id", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(validMcqPayload),
				}),
				{ params: Promise.resolve({ id: "missing-id" }) },
			);

			expect(response.status).toBe(404);
		});
	});

	describe("DELETE", () => {
		it("returns 200 on success", async () => {
			vi.mocked(deleteMcq).mockResolvedValue(true);

			const response = await DELETE(
				createAuthenticatedRequest(
					`http://localhost/api/mcqs/${sampleMcqWithChoices.id}`,
					{ method: "DELETE" },
				),
				routeContext,
			);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.message).toMatch(/deleted/i);
		});

		it("returns 404 when not found", async () => {
			vi.mocked(deleteMcq).mockResolvedValue(false);

			const response = await DELETE(
				createAuthenticatedRequest("http://localhost/api/mcqs/missing-id", {
					method: "DELETE",
				}),
				{ params: Promise.resolve({ id: "missing-id" }) },
			);

			expect(response.status).toBe(404);
		});
	});
});
