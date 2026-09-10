/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { McqPreview } from "@/components/mcq-preview";
import { sampleAttempt, sampleMcqWithChoices } from "@/test/fixtures/mcqs";

describe("McqPreview", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	it("renders question and choices", () => {
		render(<McqPreview mcq={sampleMcqWithChoices} />);

		expect(screen.getByText(sampleMcqWithChoices.name)).toBeTruthy();
		expect(screen.getByText(sampleMcqWithChoices.question)).toBeTruthy();
		expect(screen.getByRole("radio", { name: /sunlight/i })).toBeTruthy();
		expect(screen.getByRole("radio", { name: /moonlight/i })).toBeTruthy();
	});

	it("submit calls attempts API", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ attempt: sampleAttempt }), {
				status: 201,
			}),
		);

		render(<McqPreview mcq={sampleMcqWithChoices} />);

		await user.click(screen.getByRole("radio", { name: /moonlight/i }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith(
				`/api/mcqs/${sampleMcqWithChoices.id}/attempts`,
				expect.objectContaining({
					method: "POST",
				}),
			);
		});
	});

	it("shows correct feedback after submit", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					attempt: { ...sampleAttempt, isCorrect: true, choiceId: "choice-1" },
				}),
				{ status: 201 },
			),
		);

		render(<McqPreview mcq={sampleMcqWithChoices} />);

		await user.click(screen.getByRole("radio", { name: /sunlight/i }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		expect(await screen.findByText(/correct/i)).toBeTruthy();
	});

	it("shows incorrect feedback after submit", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ attempt: sampleAttempt }), {
				status: 201,
			}),
		);

		render(<McqPreview mcq={sampleMcqWithChoices} />);

		await user.click(screen.getByRole("radio", { name: /moonlight/i }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		expect(await screen.findByText(/incorrect/i)).toBeTruthy();
	});
});
