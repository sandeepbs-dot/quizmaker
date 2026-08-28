import type { CreateUserInput } from "@/lib/user-service";

export const validPassword = "SecurePass1!";

export const validRegisterPayload = {
	firstName: "Jane",
	lastName: "Smith",
	username: "jsmith",
	email: "jane.smith@school.edu",
	password: validPassword,
	confirmPassword: validPassword,
};

export const validLoginPayload = {
	emailOrUsername: "jane.smith@school.edu",
	password: validPassword,
};

export const sampleUser = {
	id: "user-123",
	firstName: "Jane",
	lastName: "Smith",
	username: "jsmith",
	email: "jane.smith@school.edu",
	passwordHash: "$2a$10$fixturehashplaceholder000000000000000000000000000",
	createdAt: "2026-01-01 00:00:00",
	updatedAt: "2026-01-01 00:00:00",
};

export const sampleCreateUserInput: CreateUserInput = {
	firstName: sampleUser.firstName,
	lastName: sampleUser.lastName,
	username: sampleUser.username,
	email: sampleUser.email,
	passwordHash: sampleUser.passwordHash,
};

export function buildCreateUserInput(
	overrides: Partial<CreateUserInput> = {},
): CreateUserInput {
	return { ...sampleCreateUserInput, ...overrides };
}
