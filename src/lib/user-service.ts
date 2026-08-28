import { randomBytes } from "node:crypto";

export interface User {
	id: string;
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	passwordHash: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateUserInput {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	passwordHash: string;
}

export interface UpdateUserInput {
	firstName?: string;
	lastName?: string;
	username?: string;
	email?: string;
	passwordHash?: string;
}

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
};

function rowToUser(row: UserRow): User {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		username: row.username,
		email: row.email,
		passwordHash: row.password_hash,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function generateId(): string {
	return randomBytes(16).toString("hex");
}

function normalizeEmail(email: string): string {
	return email.toLowerCase();
}

function normalizeUsername(username: string): string {
	return username.toLowerCase();
}

export async function createUser(
	db: D1Database,
	input: CreateUserInput,
): Promise<User> {
	const id = generateId();
	const email = normalizeEmail(input.email);
	const username = normalizeUsername(input.username);

	await db
		.prepare(
			`INSERT INTO users (id, first_name, last_name, username, email, password_hash)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
		)
		.bind(
			id,
			input.firstName,
			input.lastName,
			username,
			email,
			input.passwordHash,
		)
		.run();

	const user = await getUserById(db, id);
	if (!user) {
		throw new Error("Failed to create user");
	}

	return user;
}

export async function getUserById(
	db: D1Database,
	id: string,
): Promise<User | null> {
	const result = await db
		.prepare("SELECT * FROM users WHERE id = ?1")
		.bind(id)
		.all<UserRow>();

	return result.results[0] ? rowToUser(result.results[0]) : null;
}

export async function getUserByEmail(
	db: D1Database,
	email: string,
): Promise<User | null> {
	const result = await db
		.prepare("SELECT * FROM users WHERE email = ?1")
		.bind(normalizeEmail(email))
		.all<UserRow>();

	return result.results[0] ? rowToUser(result.results[0]) : null;
}

export async function getUserByUsername(
	db: D1Database,
	username: string,
): Promise<User | null> {
	const result = await db
		.prepare("SELECT * FROM users WHERE username = ?1")
		.bind(normalizeUsername(username))
		.all<UserRow>();

	return result.results[0] ? rowToUser(result.results[0]) : null;
}

export async function updateUser(
	db: D1Database,
	id: string,
	input: UpdateUserInput,
): Promise<User | null> {
	const existing = await getUserById(db, id);
	if (!existing) {
		return null;
	}

	const firstName = input.firstName ?? existing.firstName;
	const lastName = input.lastName ?? existing.lastName;
	const username = input.username
		? normalizeUsername(input.username)
		: existing.username;
	const email = input.email ? normalizeEmail(input.email) : existing.email;
	const passwordHash = input.passwordHash ?? existing.passwordHash;

	await db
		.prepare(
			`UPDATE users
			 SET first_name = ?1,
			     last_name = ?2,
			     username = ?3,
			     email = ?4,
			     password_hash = ?5,
			     updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
			 WHERE id = ?6`,
		)
		.bind(firstName, lastName, username, email, passwordHash, id)
		.run();

	return getUserById(db, id);
}

export async function deleteUser(db: D1Database, id: string): Promise<boolean> {
	const result = await db
		.prepare("DELETE FROM users WHERE id = ?1")
		.bind(id)
		.run();

	return (result.meta?.changes ?? 0) > 0;
}
