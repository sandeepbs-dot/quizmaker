import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import {
	applyMigrationSql,
	createInMemoryDatabase,
	indexNames,
	tableColumns,
} from "@/test/sqlite-test-db";

const MIGRATION_PATH = join(process.cwd(), "migrations", "0001_create_users.sql");

const REQUIRED_COLUMNS = [
	"id",
	"first_name",
	"last_name",
	"username",
	"email",
	"password_hash",
	"created_at",
	"updated_at",
];

function loadMigrationSql(): string {
	return readFileSync(MIGRATION_PATH, "utf-8");
}

describe("0001_create_users migration", () => {
	beforeEach(() => {
		// Each test gets a fresh in-memory database.
	});

	it("applies migration and creates users table", () => {
		const db = createInMemoryDatabase();
		applyMigrationSql(db, loadMigrationSql());

		const tables = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'",
			)
			.all() as Array<{ name: string }>;

		expect(tables).toHaveLength(1);
		expect(tables[0]?.name).toBe("users");
	});

	it("users table has required columns", () => {
		const db = createInMemoryDatabase();
		applyMigrationSql(db, loadMigrationSql());

		const columns = tableColumns(db, "users");

		for (const column of REQUIRED_COLUMNS) {
			expect(columns).toContain(column);
		}
	});

	it("email column is unique", () => {
		const db = createInMemoryDatabase();
		applyMigrationSql(db, loadMigrationSql());

		db.prepare(
			`INSERT INTO users (id, first_name, last_name, username, email, password_hash)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		).run("user-1", "Jane", "Smith", "jsmith", "jane@school.edu", "hash1");

		expect(() => {
			db.prepare(
				`INSERT INTO users (id, first_name, last_name, username, email, password_hash)
				 VALUES (?, ?, ?, ?, ?, ?)`,
			).run(
				"user-2",
				"John",
				"Doe",
				"jdoe",
				"jane@school.edu",
				"hash2",
			);
		}).toThrow();
	});

	it("username column is unique", () => {
		const db = createInMemoryDatabase();
		applyMigrationSql(db, loadMigrationSql());

		db.prepare(
			`INSERT INTO users (id, first_name, last_name, username, email, password_hash)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		).run("user-1", "Jane", "Smith", "jsmith", "jane@school.edu", "hash1");

		expect(() => {
			db.prepare(
				`INSERT INTO users (id, first_name, last_name, username, email, password_hash)
				 VALUES (?, ?, ?, ?, ?, ?)`,
			).run(
				"user-2",
				"John",
				"Doe",
				"jsmith",
				"john@school.edu",
				"hash2",
			);
		}).toThrow();
	});

	it("indexes exist on email and username", () => {
		const db = createInMemoryDatabase();
		applyMigrationSql(db, loadMigrationSql());

		const indexes = indexNames(db);

		expect(indexes).toContain("idx_users_email");
		expect(indexes).toContain("idx_users_username");
	});
});
