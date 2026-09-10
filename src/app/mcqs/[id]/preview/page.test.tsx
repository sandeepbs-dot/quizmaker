/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { sampleMcqWithChoices } from "@/test/fixtures/mcqs";

const mockNotFound = vi.fn();

vi.mock("next/navigation", () => ({
	notFound: () => {
		mockNotFound();
		throw new Error("NEXT_NOT_FOUND");
	},
}));

vi.mock("@/lib/auth-guard", () => ({
	requireAuthenticatedUserIdForPage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

vi.mock("@/lib/mcq-service", () => ({
	getMcqById: vi.fn(),
}));

vi.mock("@/components/mcq-preview", () => ({
	McqPreview: ({ mcq }: { mcq: { name: string } }) => (
		<div data-testid="mcq-preview">{mcq.name}</div>
	),
}));

import PreviewMcqPage from "./page";
import { getDb } from "@/lib/db";
import { getMcqById } from "@/lib/mcq-service";

describe("PreviewMcqPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getDb).mockResolvedValue({} as D1Database);
	});

	it("calls notFound when mcq is missing", async () => {
		vi.mocked(getMcqById).mockResolvedValue(null);

		await expect(
			PreviewMcqPage({ params: Promise.resolve({ id: "missing" }) }),
		).rejects.toThrow("NEXT_NOT_FOUND");
		expect(mockNotFound).toHaveBeenCalled();
	});

	it("renders preview when mcq exists", async () => {
		vi.mocked(getMcqById).mockResolvedValue(sampleMcqWithChoices);

		const page = await PreviewMcqPage({
			params: Promise.resolve({ id: sampleMcqWithChoices.id }),
		});
		render(page);

		expect(screen.getByTestId("mcq-preview").textContent).toBe(
			sampleMcqWithChoices.name,
		);
	});
});
