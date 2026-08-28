export type ValidationResult<T> =
	| { success: true; data: T }
	| { success: false; errors: Record<string, string> };

export interface RegisterInput {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	password: string;
	confirmPassword: string;
}

export interface LoginInput {
	emailOrUsername: string;
	password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function requiredString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function passwordIsStrong(password: string): boolean {
	return (
		password.length >= 8 &&
		/[A-Z]/.test(password) &&
		/[a-z]/.test(password) &&
		/[0-9]/.test(password) &&
		/[^A-Za-z0-9]/.test(password)
	);
}

export function validateRegisterInput(input: unknown): ValidationResult<RegisterInput> {
	const errors: Record<string, string> = {};

	if (!isRecord(input)) {
		return { success: false, errors: { form: "Invalid request body" } };
	}

	const firstName = requiredString(input.firstName);
	if (!firstName || firstName.length > 50) {
		errors.firstName = "First name is required";
	}

	const lastName = requiredString(input.lastName);
	if (!lastName || lastName.length > 50) {
		errors.lastName = "Last name is required";
	}

	const username = requiredString(input.username);
	if (!username || !USERNAME_PATTERN.test(username)) {
		errors.username =
			"Username must be 3-30 characters and contain only letters, numbers, and underscores";
	}

	const email = requiredString(input.email);
	if (!email || !EMAIL_PATTERN.test(email)) {
		errors.email = "A valid email address is required";
	}

	const password =
		typeof input.password === "string" ? input.password : "";
	if (!passwordIsStrong(password)) {
		errors.password =
			"Password must be at least 8 characters and include uppercase, lowercase, number, and special character";
	}

	const confirmPassword =
		typeof input.confirmPassword === "string" ? input.confirmPassword : "";
	if (password !== confirmPassword) {
		errors.confirmPassword = "Passwords do not match";
	}

	if (Object.keys(errors).length > 0) {
		return { success: false, errors };
	}

	return {
		success: true,
		data: {
			firstName: firstName!,
			lastName: lastName!,
			username: username!,
			email: email!,
			password,
			confirmPassword,
		},
	};
}

export function validateLoginInput(input: unknown): ValidationResult<LoginInput> {
	const errors: Record<string, string> = {};

	if (!isRecord(input)) {
		return { success: false, errors: { form: "Invalid request body" } };
	}

	const emailOrUsername = requiredString(input.emailOrUsername);
	if (!emailOrUsername) {
		errors.emailOrUsername = "Email or username is required";
	}

	const password = typeof input.password === "string" ? input.password : "";
	if (!password) {
		errors.password = "Password is required";
	}

	if (Object.keys(errors).length > 0) {
		return { success: false, errors };
	}

	return {
		success: true,
		data: { emailOrUsername: emailOrUsername!, password },
	};
}
