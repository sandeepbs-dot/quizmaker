import Database from "better-sqlite3";

export function createInMemoryDatabase(): Database.Database {
	return new Database(":memory:");
}

export function applyMigrationSql(db: Database.Database, sql: string): void {
	db.exec(sql);
}

export function tableColumns(
	db: Database.Database,
	tableName: string,
): string[] {
	const rows = db
		.prepare(`PRAGMA table_info(${tableName})`)
		.all() as Array<{ name: string }>;

	return rows.map((row) => row.name);
}

export function indexNames(db: Database.Database): string[] {
	const rows = db
		.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'",
		)
		.all() as Array<{ name: string }>;

	return rows.map((row) => row.name);
}
