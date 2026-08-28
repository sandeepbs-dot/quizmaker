import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword: string): Promise<string> {
	return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(
	plainPassword: string,
	passwordHash: string,
): Promise<boolean> {
	if (!plainPassword) {
		return false;
	}

	return bcrypt.compare(plainPassword, passwordHash);
}
