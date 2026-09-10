/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth-guard", () => ({
	requireAuthenticatedUserIdForPage: vi.fn(),
}));

vi.mock("@/components/mcq-form", () => ({
	McqForm: ({ mode }: { mode: string }) => (
		<div data-testid="mcq-form">{mode}</div>
	),
}));

import NewMcqPage from "./page";
import { requireAuthenticatedUserIdForPage } from "@/lib/auth-guard";

describe("NewMcqPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(requireAuthenticatedUserIdForPage).mockResolvedValue("user-123");
	});

	it("requires authentication before rendering", async () => {
		await NewMcqPage();

		expect(requireAuthenticatedUserIdForPage).toHaveBeenCalled();
	});

	it("renders create form when authenticated", async () => {
		const page = await NewMcqPage();
		render(page);

		expect(screen.getByTestId("mcq-form").textContent).toBe("create");
	});
});
