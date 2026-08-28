import type { CreateUserInput } from "@/lib/user-service";

export const validPassword = "SecurePass1!";

export const sampleCreateUserInput: CreateUserInput = {
	firstName: "Jane",
	lastName: "Smith",
	username: "jsmith",
	email: "jane.smith@school.edu",
	passwordHash: "$2a$10$fixturehashplaceholder000000000000000000000000000",
};

export function buildCreateUserInput(
	overrides: Partial<CreateUserInput> = {},
): CreateUserInput {
	return { ...sampleCreateUserInput, ...overrides };
}
