/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { McqsStub } from "@/components/mcqs-stub";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush }),
}));

describe("McqsStub", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	it("displays welcome message with user name", () => {
		render(
			<McqsStub
				user={{
					id: "user-123",
					firstName: "Jane",
					lastName: "Smith",
					username: "jsmith",
					email: "jane@school.edu",
				}}
			/>,
		);

		expect(screen.getByText(/welcome, jane smith/i)).toBeTruthy();
	});

	it("logout button calls logout API and redirects", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(
				JSON.stringify({ message: "Logged out successfully", redirectTo: "/login" }),
				{ status: 200 },
			),
		);

		render(
			<McqsStub
				user={{
					id: "user-123",
					firstName: "Jane",
					lastName: "Smith",
					username: "jsmith",
					email: "jane@school.edu",
				}}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /log out/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({
				method: "POST",
			}));
		});
		expect(mockPush).toHaveBeenCalledWith("/login");
	});
});
