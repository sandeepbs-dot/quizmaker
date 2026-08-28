import Database from "better-sqlite3";

type D1Result<T = Record<string, unknown>> = {
	success: boolean;
	results: T[];
};

class MockPreparedStatement {
	constructor(
		private readonly db: Database.Database,
		private readonly query: string,
		private boundValues: unknown[] = [],
	) {}

	bind(...values: unknown[]): MockPreparedStatement {
		return new MockPreparedStatement(this.db, this.query, values);
	}

	async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
		this.db.prepare(this.query).run(...this.boundValues);
		return { success: true, results: [] };
	}

	async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
		const results = this.db
			.prepare(this.query)
			.all(...this.boundValues) as T[];

		return { success: true, results };
	}
}

export class MockD1Database {
	constructor(private readonly db: Database.Database) {}

	prepare(query: string): MockPreparedStatement {
		return new MockPreparedStatement(this.db, query);
	}

	async exec(query: string): Promise<{ count: number; duration: number }> {
		this.db.exec(query);
		return { count: 0, duration: 0 };
	}

	getSqliteDatabase(): Database.Database {
		return this.db;
	}
}

export function createMockD1(): MockD1Database {
	return new MockD1Database(createInMemoryDatabase());
}

function createInMemoryDatabase(): Database.Database {
	return new Database(":memory:");
}
