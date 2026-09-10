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

vi.mock("@/components/mcq-form", () => ({
	McqForm: ({
		mode,
		mcqId,
		initialValues,
	}: {
		mode: string;
		mcqId: string;
		initialValues: { name: string };
	}) => (
		<div data-testid="mcq-form">
			<span>{mode}</span>
			<span>{mcqId}</span>
			<span>{initialValues.name}</span>
		</div>
	),
}));

import EditMcqPage from "./page";
import { requireAuthenticatedUserIdForPage } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { getMcqById } from "@/lib/mcq-service";

describe("EditMcqPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getDb).mockResolvedValue({} as D1Database);
		vi.mocked(requireAuthenticatedUserIdForPage).mockResolvedValue("user-123");
	});

	it("calls notFound when mcq is missing", async () => {
		vi.mocked(getMcqById).mockResolvedValue(null);

		await expect(
			EditMcqPage({ params: Promise.resolve({ id: "missing" }) }),
		).rejects.toThrow("NEXT_NOT_FOUND");
		expect(mockNotFound).toHaveBeenCalled();
	});

	it("renders edit form with initial values when mcq exists", async () => {
		vi.mocked(getMcqById).mockResolvedValue(sampleMcqWithChoices);

		const page = await EditMcqPage({
			params: Promise.resolve({ id: sampleMcqWithChoices.id }),
		});
		render(page);

		expect(screen.getByTestId("mcq-form")).toBeTruthy();
		expect(screen.getByText("edit")).toBeTruthy();
		expect(screen.getByText(sampleMcqWithChoices.id)).toBeTruthy();
		expect(screen.getByText(sampleMcqWithChoices.name)).toBeTruthy();
	});
});
