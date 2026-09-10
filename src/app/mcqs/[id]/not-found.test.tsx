/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import McqNotFound from "./not-found";

vi.mock("next/link", () => ({
	default: ({
		children,
		href,
	}: {
		children: React.ReactNode;
		href: string;
	}) => <a href={href}>{children}</a>,
}));

describe("McqNotFound", () => {
	it("renders not found message and back link", () => {
		render(<McqNotFound />);

		expect(screen.getByText("MCQ not found")).toBeTruthy();
		expect(
			screen.getByText(/this question may have been deleted/i),
		).toBeTruthy();
		const backLink = screen.getByRole("link", { name: /back to mcq list/i });
		expect(backLink.getAttribute("href")).toBe("/mcqs");
	});
});
