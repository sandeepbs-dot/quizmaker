/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { sampleMcq } from "@/test/fixtures/mcqs";
import { sampleUser } from "@/test/fixtures/users";

const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
	redirect: (path: string) => {
		mockRedirect(path);
		throw new Error(`NEXT_REDIRECT:${path}`);
	},
}));

vi.mock("@/lib/auth-guard", () => ({
	requireAuthenticatedUserIdForPage: vi.fn(),
	getLoginRedirectPath: () => "/login",
}));

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

vi.mock("@/lib/user-service", () => ({
	getUserById: vi.fn(),
}));

vi.mock("@/lib/mcq-service", () => ({
	listMcqs: vi.fn(),
}));

vi.mock("@/components/mcq-list", () => ({
	McqList: ({
		user,
		mcqs,
	}: {
		user: { username: string };
		mcqs: { id: string }[];
	}) => (
		<div data-testid="mcq-list">
			<span>{user.username}</span>
			<span>{mcqs.length} mcqs</span>
		</div>
	),
}));

import McqsPage from "./page";
import { requireAuthenticatedUserIdForPage } from "@/lib/auth-guard";
import { getDb } from "@/lib/db";
import { getUserById } from "@/lib/user-service";
import { listMcqs } from "@/lib/mcq-service";

describe("McqsPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getDb).mockResolvedValue({} as D1Database);
		vi.mocked(requireAuthenticatedUserIdForPage).mockResolvedValue(
			sampleUser.id,
		);
	});

	it("redirects to login when user record is missing", async () => {
		vi.mocked(getUserById).mockResolvedValue(null);

		await expect(McqsPage()).rejects.toThrow("NEXT_REDIRECT:/login");
		expect(mockRedirect).toHaveBeenCalledWith("/login");
	});

	it("renders McqList with user and mcqs when authenticated", async () => {
		vi.mocked(getUserById).mockResolvedValue(sampleUser);
		vi.mocked(listMcqs).mockResolvedValue([sampleMcq]);

		const page = await McqsPage();
		render(page);

		expect(screen.getByTestId("mcq-list")).toBeTruthy();
		expect(screen.getByText(sampleUser.username)).toBeTruthy();
		expect(screen.getByText("1 mcqs")).toBeTruthy();
	});
});
