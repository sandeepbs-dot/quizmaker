/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { McqList } from "@/components/mcq-list";
import { sampleMcq } from "@/test/fixtures/mcqs";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

describe("McqList", () => {
	const user = {
		id: "user-123",
		firstName: "Jane",
		lastName: "Smith",
		username: "jsmith",
		email: "jane@school.edu",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	it("renders table with mcq rows", () => {
		render(<McqList user={user} mcqs={[sampleMcq]} />);

		expect(screen.getByText(sampleMcq.name)).toBeTruthy();
		expect(screen.getByText(sampleMcq.question)).toBeTruthy();
	});

	it("create button navigates to /mcqs/new", async () => {
		const clickUser = userEvent.setup();
		render(<McqList user={user} mcqs={[]} />);

		await clickUser.click(screen.getByRole("button", { name: /create mcq/i }));

		expect(mockPush).toHaveBeenCalledWith("/mcqs/new");
	});

	it("actions menu shows Edit, Preview, Delete", async () => {
		const clickUser = userEvent.setup();
		render(<McqList user={user} mcqs={[sampleMcq]} />);

		await clickUser.click(
			screen.getByRole("button", { name: /actions for photosynthesis/i }),
		);

		expect(await screen.findByRole("menuitem", { name: /edit/i })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /preview/i })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /delete/i })).toBeTruthy();
	});

	it("delete confirms and calls DELETE API", async () => {
		const clickUser = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ message: "MCQ deleted successfully" }), {
				status: 200,
			}),
		);

		render(<McqList user={user} mcqs={[sampleMcq]} />);

		await clickUser.click(
			screen.getByRole("button", { name: /actions for photosynthesis/i }),
		);
		await clickUser.click(await screen.findByRole("menuitem", { name: /delete/i }));
		await clickUser.click(screen.getByRole("button", { name: /delete question/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith(
				`/api/mcqs/${sampleMcq.id}`,
				expect.objectContaining({ method: "DELETE" }),
			);
		});
		expect(mockRefresh).toHaveBeenCalled();
	});

	it("shows empty state when no mcqs", () => {
		render(<McqList user={user} mcqs={[]} />);

		expect(screen.getByText(/no multiple-choice questions yet/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: /create mcq/i })).toBeTruthy();
	});
});
