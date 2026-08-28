import { describe, it, expect, beforeEach } from "vitest";
import { createMockD1WithUsersSchema } from "@/test/mock-d1";
import { buildCreateUserInput } from "@/test/fixtures/users";
import {
	createUser,
	deleteUser,
	getUserByEmail,
	getUserById,
	getUserByUsername,
	updateUser,
} from "@/lib/user-service";

describe("user-service", () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let db: any;

	beforeEach(() => {
		db = createMockD1WithUsersSchema();
	});

	it("createUser inserts row and returns user with id", async () => {
		const input = buildCreateUserInput();

		const user = await createUser(db, input);

		expect(user.id).toBeTruthy();
		expect(user.firstName).toBe(input.firstName);
		expect(user.lastName).toBe(input.lastName);
		expect(user.username).toBe(input.username.toLowerCase());
		expect(user.email).toBe(input.email.toLowerCase());
		expect(user.passwordHash).toBe(input.passwordHash);
		expect(user.createdAt).toBeTruthy();
		expect(user.updatedAt).toBeTruthy();
	});

	it("createUser normalizes email to lowercase", async () => {
		const user = await createUser(
			db,
			buildCreateUserInput({ email: "Jane.Smith@School.edu" }),
		);

		expect(user.email).toBe("jane.smith@school.edu");
	});

	it("createUser normalizes username to lowercase", async () => {
		const user = await createUser(
			db,
			buildCreateUserInput({ username: "JSmith" }),
		);

		expect(user.username).toBe("jsmith");
	});

	it("getUserById returns user when exists", async () => {
		const created = await createUser(db, buildCreateUserInput());

		const user = await getUserById(db, created.id);

		expect(user).toEqual(created);
	});

	it("getUserById returns null when not found", async () => {
		const user = await getUserById(db, "missing-id");

		expect(user).toBeNull();
	});

	it("getUserByEmail finds user case-insensitively", async () => {
		await createUser(
			db,
			buildCreateUserInput({ email: "jane.smith@school.edu" }),
		);

		const user = await getUserByEmail(db, "Jane.Smith@School.edu");

		expect(user?.email).toBe("jane.smith@school.edu");
	});

	it("getUserByUsername finds user case-insensitively", async () => {
		await createUser(db, buildCreateUserInput({ username: "jsmith" }));

		const user = await getUserByUsername(db, "JSmith");

		expect(user?.username).toBe("jsmith");
	});

	it("updateUser updates fields and sets updated_at", async () => {
		const created = await createUser(db, buildCreateUserInput());

		const updated = await updateUser(db, created.id, {
			firstName: "Janet",
			lastName: "Jones",
		});

		expect(updated).not.toBeNull();
		expect(updated?.firstName).toBe("Janet");
		expect(updated?.lastName).toBe("Jones");
		expect(updated?.updatedAt).not.toBe(created.updatedAt);
	});

	it("updateUser returns null for unknown id", async () => {
		const updated = await updateUser(db, "missing-id", { firstName: "Janet" });

		expect(updated).toBeNull();
	});

	it("deleteUser removes row and returns true", async () => {
		const created = await createUser(db, buildCreateUserInput());

		const deleted = await deleteUser(db, created.id);

		expect(deleted).toBe(true);
		expect(await getUserById(db, created.id)).toBeNull();
	});

	it("deleteUser returns false for unknown id", async () => {
		const deleted = await deleteUser(db, "missing-id");

		expect(deleted).toBe(false);
	});
});
