import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { describe, it, expect } from "vitest";
import {
	applyMigrationSql,
	createInMemoryDatabase,
	indexNames,
	tableColumns,
} from "@/test/sqlite-test-db";

const USERS_MIGRATION_PATH = join(
	process.cwd(),
	"migrations",
	"0001_create_users.sql",
);
const MCQ_MIGRATION_PATH = join(
	process.cwd(),
	"migrations",
	"0002_create_mcq_tables.sql",
);

const MCQS_REQUIRED_COLUMNS = [
	"id",
	"name",
	"question",
	"created_by_user_id",
	"created_at",
	"updated_at",
];

const MCQ_CHOICES_REQUIRED_COLUMNS = [
	"id",
	"mcq_id",
	"choice_text",
	"is_correct",
	"sort_order",
	"created_at",
	"updated_at",
];

const MCQ_ATTEMPTS_REQUIRED_COLUMNS = [
	"id",
	"mcq_id",
	"user_id",
	"choice_id",
	"is_correct",
	"created_at",
];

function loadMigrationSql(path: string): string {
	return readFileSync(path, "utf-8");
}

function applyBaseAndMcqMigrations(db: Database.Database): void {
	db.pragma("foreign_keys = ON");
	applyMigrationSql(db, loadMigrationSql(USERS_MIGRATION_PATH));
	applyMigrationSql(db, loadMigrationSql(MCQ_MIGRATION_PATH));
}

function insertUser(db: Database.Database, id = "user-1"): void {
	db.prepare(
		`INSERT INTO users (id, first_name, last_name, username, email, password_hash)
		 VALUES (?, ?, ?, ?, ?, ?)`,
	).run(id, "Jane", "Smith", "jsmith", "jane@school.edu", "hash1");
}

describe("0002_create_mcq_tables migration", () => {
	it("applies migration and creates mcqs table", () => {
		const db = createInMemoryDatabase();
		applyBaseAndMcqMigrations(db);

		const tables = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mcqs'",
			)
			.all() as Array<{ name: string }>;

		expect(tables).toHaveLength(1);
		expect(tables[0]?.name).toBe("mcqs");
	});

	it("applies migration and creates mcq_choices table", () => {
		const db = createInMemoryDatabase();
		applyBaseAndMcqMigrations(db);

		const tables = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mcq_choices'",
			)
			.all() as Array<{ name: string }>;

		expect(tables).toHaveLength(1);
		expect(tables[0]?.name).toBe("mcq_choices");
	});

	it("applies migration and creates mcq_attempts table", () => {
		const db = createInMemoryDatabase();
		applyBaseAndMcqMigrations(db);

		const tables = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mcq_attempts'",
			)
			.all() as Array<{ name: string }>;

		expect(tables).toHaveLength(1);
		expect(tables[0]?.name).toBe("mcq_attempts");
	});

	it("mcqs table has required columns", () => {
		const db = createInMemoryDatabase();
		applyBaseAndMcqMigrations(db);

		const columns = tableColumns(db, "mcqs");

		for (const column of MCQS_REQUIRED_COLUMNS) {
			expect(columns).toContain(column);
		}
	});

	it("mcq_choices table has required columns", () => {
		const db = createInMemoryDatabase();
		applyBaseAndMcqMigrations(db);

		const columns = tableColumns(db, "mcq_choices");

		for (const column of MCQ_CHOICES_REQUIRED_COLUMNS) {
			expect(columns).toContain(column);
		}
	});

	it("mcq_attempts table has required columns", () => {
		const db = createInMemoryDatabase();
		applyBaseAndMcqMigrations(db);

		const columns = tableColumns(db, "mcq_attempts");

		for (const column of MCQ_ATTEMPTS_REQUIRED_COLUMNS) {
			expect(columns).toContain(column);
		}
	});

	it("mcqs.created_by_user_id references users", () => {
		const db = createInMemoryDatabase();
		applyBaseAndMcqMigrations(db);

		expect(() => {
			db.prepare(
				`INSERT INTO mcqs (id, name, question, created_by_user_id)
				 VALUES (?, ?, ?, ?)`,
			).run("mcq-1", "Photosynthesis", "What do plants use?", "missing-user");
		}).toThrow();
	});

	it("deleting mcq cascades to choices and attempts", () => {
		const db = createInMemoryDatabase();
		applyBaseAndMcqMigrations(db);
		insertUser(db);

		db.prepare(
			`INSERT INTO mcqs (id, name, question, created_by_user_id)
			 VALUES (?, ?, ?, ?)`,
		).run("mcq-1", "Photosynthesis", "What do plants use?", "user-1");

		db.prepare(
			`INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, sort_order)
			 VALUES (?, ?, ?, ?, ?)`,
		).run("choice-1", "mcq-1", "Sunlight", 1, 0);

		db.prepare(
			`INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, sort_order)
			 VALUES (?, ?, ?, ?, ?)`,
		).run("choice-2", "mcq-1", "Moonlight", 0, 1);

		db.prepare(
			`INSERT INTO mcq_attempts (id, mcq_id, user_id, choice_id, is_correct)
			 VALUES (?, ?, ?, ?, ?)`,
		).run("attempt-1", "mcq-1", "user-1", "choice-2", 0);

		db.prepare("DELETE FROM mcqs WHERE id = ?").run("mcq-1");

		const choices = db
			.prepare("SELECT id FROM mcq_choices WHERE mcq_id = ?")
			.all("mcq-1");
		const attempts = db
			.prepare("SELECT id FROM mcq_attempts WHERE mcq_id = ?")
			.all("mcq-1");

		expect(choices).toHaveLength(0);
		expect(attempts).toHaveLength(0);
	});

	it("indexes exist on mcqs, mcq_choices, and mcq_attempts", () => {
		const db = createInMemoryDatabase();
		applyBaseAndMcqMigrations(db);

		const indexes = indexNames(db);

		expect(indexes).toContain("idx_mcqs_created_at");
		expect(indexes).toContain("idx_mcqs_created_by_user_id");
		expect(indexes).toContain("idx_mcq_choices_mcq_id");
		expect(indexes).toContain("idx_mcq_attempts_mcq_id");
		expect(indexes).toContain("idx_mcq_attempts_user_id");
	});
});
