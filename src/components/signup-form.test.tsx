/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupForm } from "@/components/signup-form";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush }),
}));

describe("SignupForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	it("renders all required fields", () => {
		render(<SignupForm />);

		expect(screen.getByLabelText(/first name/i)).toBeTruthy();
		expect(screen.getByLabelText(/last name/i)).toBeTruthy();
		expect(screen.getByLabelText(/^username$/i)).toBeTruthy();
		expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
		expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
		expect(screen.getByLabelText(/confirm password/i)).toBeTruthy();
	});

	it("shows validation error on empty submit", async () => {
		const user = userEvent.setup();
		render(<SignupForm />);

		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("shows error when passwords do not match", async () => {
		const user = userEvent.setup();
		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Smith");
		await user.type(screen.getByLabelText(/^username$/i), "jsmith");
		await user.type(screen.getByLabelText(/^email$/i), "jane@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "SecurePass1!");
		await user.type(screen.getByLabelText(/confirm password/i), "DifferentPass1!");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByText(/passwords do not match/i)).toBeTruthy();
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("calls register API and redirects on success", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(
				JSON.stringify({ user: { id: "1" }, redirectTo: "/mcqs" }),
				{ status: 201 },
			),
		);

		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Smith");
		await user.type(screen.getByLabelText(/^username$/i), "jsmith");
		await user.type(screen.getByLabelText(/^email$/i), "jane@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "SecurePass1!");
		await user.type(screen.getByLabelText(/confirm password/i), "SecurePass1!");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({
				method: "POST",
			}));
		});
		expect(mockPush).toHaveBeenCalledWith("/mcqs");
	});

	it("shows server error on 409 duplicate email", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "Email already registered" }), {
				status: 409,
			}),
		);

		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Smith");
		await user.type(screen.getByLabelText(/^username$/i), "jsmith");
		await user.type(screen.getByLabelText(/^email$/i), "jane@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "SecurePass1!");
		await user.type(screen.getByLabelText(/confirm password/i), "SecurePass1!");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByText(/email already registered/i)).toBeTruthy();
	});
});
