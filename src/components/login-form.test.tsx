/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/login-form";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush }),
}));

describe("LoginForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	it("renders email/username and password fields", () => {
		render(<LoginForm />);

		expect(screen.getByLabelText(/email or username/i)).toBeTruthy();
		expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
	});

	it("shows validation error on empty submit", async () => {
		const user = userEvent.setup();
		render(<LoginForm />);

		await user.click(screen.getByRole("button", { name: /^login$/i }));

		expect(await screen.findAllByRole("alert")).toHaveLength(2);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("calls login API and redirects on success", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(
				JSON.stringify({ user: { id: "1" }, redirectTo: "/mcqs" }),
				{ status: 200 },
			),
		);

		render(<LoginForm />);

		await user.type(screen.getByLabelText(/email or username/i), "jane@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "SecurePass1!");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
				method: "POST",
			}));
		});
		expect(mockPush).toHaveBeenCalledWith("/mcqs");
	});

	it("shows generic error on 401", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(
				JSON.stringify({ error: "Invalid email/username or password" }),
				{ status: 401 },
			),
		);

		render(<LoginForm />);

		await user.type(screen.getByLabelText(/email or username/i), "jane@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "WrongPass1!");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		expect(
			await screen.findByText(/invalid email\/username or password/i),
		).toBeTruthy();
	});
});
