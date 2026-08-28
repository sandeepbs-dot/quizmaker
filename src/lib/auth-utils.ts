import type { User } from "@/lib/user-service";

export type PublicUser = Omit<User, "passwordHash">;

export function toPublicUser(user: User): PublicUser {
	const { passwordHash: _passwordHash, ...publicUser } = user;
	return publicUser;
}
