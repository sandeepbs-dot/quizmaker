/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { McqForm } from "@/components/mcq-form";
import { sampleMcqWithChoices, validMcqPayload } from "@/test/fixtures/mcqs";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush }),
}));

describe("McqForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	it("renders with two default choice rows", () => {
		render(<McqForm mode="create" />);

		expect(screen.getByLabelText(/choice 1 text/i)).toBeTruthy();
		expect(screen.getByLabelText(/choice 2 text/i)).toBeTruthy();
	});

	it("add choice appends row up to six", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("button", { name: /add choice/i }));
		await user.click(screen.getByRole("button", { name: /add choice/i }));

		expect(screen.getByLabelText(/choice 4 text/i)).toBeTruthy();
	});

	it("remove choice disabled at two rows", () => {
		render(<McqForm mode="create" />);

		const removeButtons = screen.getAllByRole("button", { name: /remove choice/i });
		expect(removeButtons).toHaveLength(2);
		for (const button of removeButtons) {
			expect((button as HTMLButtonElement).disabled).toBe(true);
		}
	});

	it("shows validation errors on empty submit", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("button", { name: /save/i }));

		expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("save calls POST on create", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ mcq: sampleMcqWithChoices }), {
				status: 201,
			}),
		);

		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText(/^name$/i), validMcqPayload.name);
		await user.type(
			screen.getByLabelText(/^question$/i),
			validMcqPayload.question,
		);
		await user.type(screen.getByLabelText(/choice 1 text/i), "Sunlight");
		await user.type(screen.getByLabelText(/choice 2 text/i), "Moonlight");
		await user.click(screen.getByRole("button", { name: /save/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith(
				"/api/mcqs",
				expect.objectContaining({
					method: "POST",
				}),
			);
		});
		expect(mockPush).toHaveBeenCalledWith("/mcqs");
	});

	it("save calls PUT on edit", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ mcq: sampleMcqWithChoices }), {
				status: 200,
			}),
		);

		render(
			<McqForm
				mode="edit"
				mcqId={sampleMcqWithChoices.id}
				initialValues={{
					name: sampleMcqWithChoices.name,
					question: sampleMcqWithChoices.question,
					choices: sampleMcqWithChoices.choices.map((choice) => ({
						choiceText: choice.choiceText,
						isCorrect: choice.isCorrect,
					})),
				}}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /save/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith(
				`/api/mcqs/${sampleMcqWithChoices.id}`,
				expect.objectContaining({
					method: "PUT",
				}),
			);
		});
		expect(mockPush).toHaveBeenCalledWith("/mcqs");
	});

	it("cancel navigates to /mcqs", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("button", { name: /cancel/i }));

		expect(mockPush).toHaveBeenCalledWith("/mcqs");
	});
});
