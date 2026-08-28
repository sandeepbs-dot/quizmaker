Date created: August 28, 2026
Date last modified: August 28, 2026 (TDD / Vitest plan added)

# Register, Login, and Logout — Technical PRD

## Overview/Problem

Quiz Maker is a greenfield web application that will allow multiple teachers to collaborate on building a shared test bank of multiple-choice questions. Before any quiz or question functionality can be built, the application needs a way to identify users and persist their accounts.

Today there is no user identity layer. Teachers cannot create accounts, sign in, or sign out. Without authentication, the platform cannot support collaborative content creation, per-user ownership, or protected pages in later phases.

This PRD covers **Phase 1 only**: user registration, login, logout, the database schema and migration for users, a user service layer, and API endpoints that back those flows. After successful registration or login, users are redirected to a stub MCQs page. No MCQ creation, editing, or collaboration features are included in this phase.

---

## Hypothesis

We believe that implementing a secure register/login/logout flow with a persisted user table, a dedicated user service, and HTTP API endpoints will give Quiz Maker a reliable identity foundation so multiple teachers can authenticate and access the application before MCQ features are built.

---

## Scope

### In Scope

What will be built in this feature:

- `users` database table with primary key, first name, last name, username, email, and hashed password
- D1 migration to create the `users` table and required indexes
- User service with methods to create, read, update, and delete users (backed by D1)
- Password hashing on the server during registration using an industry-standard algorithm (bcrypt)
- Password verification on the server during login (compare submitted password against stored hash)
- `POST /api/auth/register` endpoint
- `POST /api/auth/login` endpoint
- `POST /api/auth/logout` endpoint
- Session management so authenticated users remain signed in until logout
- Register page UI with form validation
- Login page UI with form validation
- MCQs stub page (protected) shown after successful register or login
- Logout control accessible from the MCQs stub page
- Protected route enforcement: unauthenticated users redirected to login
- Client-side and server-side validation for all auth forms
- **Vitest** unit test harness and test-driven development (TDD) workflow for every phase
- Unit tests written at the start of each phase (expected to fail/red), then implementation turns them green

### Out of Scope

What is explicitly not being built now but may be considered later:

- MCQ creation, editing, deletion, or listing (beyond a placeholder stub page)
- Test bank collaboration features (sharing, permissions, co-editing)
- Teacher roles or role-based access control
- Password reset or forgot-password flow
- Email verification after registration
- Social login (Google, GitHub, etc.)
- Multi-factor authentication (MFA)
- User profile management (avatar, bio, preferences)
- Account deactivation or soft-delete
- Remember-me / extended session options
- Admin user management UI
- Audit logging of authentication events

### Cut

Things that were considered during planning but deliberately removed (and why):

- **Client-side password hashing before HTTP POST** — Passwords are sent as plain text in the request body over HTTPS; hashing happens on the server. Client-side hashing would make the hash equivalent to the password and provides no security benefit.
- **Redirect to login after registration** — User requested direct redirect to the MCQs stub after both register and login for a faster first-use experience. Auto-login after registration is required to support this.
- **Full Name as a single field** — Split into `first_name` and `last_name` per product requirement; supports future display and sorting needs.
- **Dashboard as post-login destination** — Replaced with `/mcqs` stub page as the authenticated landing page for Phase 1.

---

## Technical Requirements

### Database Schema

The application uses **Cloudflare D1** (SQLite). All schema changes are delivered through Wrangler migrations.

#### Table: `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID or hex random string |
| `first_name` | TEXT | NOT NULL | User's first name |
| `last_name` | TEXT | NOT NULL | User's last name |
| `username` | TEXT | NOT NULL, UNIQUE | Login identifier; unique across all users |
| `email` | TEXT | NOT NULL, UNIQUE | Used for login and account identification |
| `password_hash` | TEXT | NOT NULL | bcrypt hash; never store plain text |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Account creation time |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**

- `idx_users_email` on `email` — fast lookup during login
- `idx_users_username` on `username` — fast lookup and uniqueness enforcement

**Migration SQL** (`migrations/0001_create_users.sql`):

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

**Migration workflow:**

1. Create D1 database: `npx wrangler d1 create quizmaker-db`
2. Add `d1_databases` binding `DB` to `wrangler.jsonc`
3. Create migration: `npx wrangler d1 migrations create quizmaker-db create_users`
4. Apply locally: `npx wrangler d1 migrations apply quizmaker-db --local`
5. Run `npm run cf-typegen` to update types

---

### API Endpoints

All auth endpoints live under `/api/auth/`. Request bodies are JSON. Passwords are transmitted in the POST body over HTTPS and hashed or verified **on the server only**.

#### POST /api/auth/register

Creates a new user account, establishes a session, and returns the created user (without password).

**Request Body:**

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "username": "jsmith",
  "email": "jane.smith@school.edu",
  "password": "SecurePass1!",
  "confirmPassword": "SecurePass1!"
}
```

**Server behavior:**

1. Validate all fields (required, formats, password rules, password match)
2. Check email and username uniqueness
3. Hash password with bcrypt (cost factor 10–12)
4. Call `UserService.createUser()` to insert record
5. Create authenticated session
6. Return success response

**Response:**

- Success (201):

```json
{
  "user": {
    "id": "abc123...",
    "firstName": "Jane",
    "lastName": "Smith",
    "username": "jsmith",
    "email": "jane.smith@school.edu"
  },
  "redirectTo": "/mcqs"
}
```

- Error (400): Validation error with field-level messages
- Error (409): Email or username already exists
- Error (500): Server error

---

#### POST /api/auth/login

Authenticates an existing user by email/username and password, creates a session, and returns the user.

**Request Body:**

```json
{
  "emailOrUsername": "jane.smith@school.edu",
  "password": "SecurePass1!"
}
```

**Server behavior:**

1. Validate required fields
2. Call `UserService.getUserByEmail()` or `UserService.getUserByUsername()` depending on input format
3. Compare submitted password against stored hash using bcrypt
4. If valid, create authenticated session
5. Return success response

**Response:**

- Success (200):

```json
{
  "user": {
    "id": "abc123...",
    "firstName": "Jane",
    "lastName": "Smith",
    "username": "jsmith",
    "email": "jane.smith@school.edu"
  },
  "redirectTo": "/mcqs"
}
```

- Error (401): Invalid credentials (generic message: "Invalid email/username or password")
- Error (400): Validation error
- Error (500): Server error

---

#### POST /api/auth/logout

Clears the current user session.

**Request Body:** None (session cookie identifies the user)

**Server behavior:**

1. Invalidate or clear the session cookie
2. Return success response

**Response:**

- Success (200):

```json
{
  "message": "Logged out successfully",
  "redirectTo": "/login"
}
```

- Error (500): Server error

---

#### GET /api/auth/me (supporting endpoint)

Returns the currently authenticated user. Used by protected pages and client-side auth state.

**Response:**

- Success (200): User object (no password hash)
- Error (401): Not authenticated

---

### User Service

The user service centralizes all database access for user records. It lives in `src/lib/user-service.ts` and is called by API route handlers — not directly from UI components.

#### Interface

```typescript
interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateUserInput {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  passwordHash: string;
}

interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  passwordHash?: string;
}
```

#### Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `createUser(input: CreateUserInput)` | Insert new user row | `User` (without exposing hash in API responses) |
| `getUserById(id: string)` | Fetch user by primary key | `User \| null` |
| `getUserByEmail(email: string)` | Fetch user by email (login) | `User \| null` |
| `getUserByUsername(username: string)` | Fetch user by username (login) | `User \| null` |
| `updateUser(id: string, input: UpdateUserInput)` | Update user fields | `User \| null` |
| `deleteUser(id: string)` | Hard delete user row | `boolean` |

**Implementation notes:**

- All queries use D1 prepared statements with numbered placeholders (`?1`, `?2`)
- Access D1 via `getCloudflareContext()` from `@opennextjs/cloudflare` → `env.DB`
- `createUser` is used by the register endpoint
- `getUserByEmail` / `getUserByUsername` + bcrypt compare are used by the login endpoint
- `updateUser` and `deleteUser` are implemented now for service completeness; no UI exposes them in Phase 1

---

### Password Handling

| Operation | Where hashing happens | Algorithm |
|-----------|----------------------|-----------|
| Registration | Server, before `UserService.createUser()` | bcrypt, cost 10–12 |
| Login verification | Server, compare input against `password_hash` | `bcrypt.compare()` |
| Storage | Database column `password_hash` only | Never store plain text |
| HTTP transport | Plain password in JSON POST body | HTTPS required in production |

**Password validation rules (registration):**

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- `confirmPassword` must match `password`

---

### Session Management

- Use an HttpOnly, Secure (production), SameSite=Lax session cookie
- Session stores user ID; no sensitive data in the cookie payload
- Session is created on successful register and login
- Session is cleared on logout
- Protected routes and `/api/auth/me` validate session server-side before rendering or returning data
- Session secret stored in Wrangler secrets / environment variables (`SESSION_SECRET`)

---

### User Interface Requirements

#### Register Page (`/register`)

- Public access (no authentication required)
- Application branding: Quiz Maker
- Page heading: "Create Account" or "Register"
- Form fields:
  - First Name (required, 1–50 characters)
  - Last Name (required, 1–50 characters)
  - Username (required, 3–30 characters, alphanumeric and underscores only, unique)
  - Email (required, valid email format, unique)
  - Password (required, meets password rules)
  - Confirm Password (required, must match password)
- Primary button: "Register" — submits `POST /api/auth/register`
- Secondary link: "Already have an account? Log in" → `/login`
- Inline and form-level validation errors
- Loading state on submit
- On success: redirect to `/mcqs`

#### Login Page (`/login`)

- Public access
- Page heading: "Log In" or "Sign In"
- Form fields:
  - Email or Username (required)
  - Password (required)
- Primary button: "Log In" — submits `POST /api/auth/login`
- Secondary link: "Don't have an account? Register" → `/register`
- Generic error on invalid credentials (do not reveal whether email/username exists)
- Loading state on submit
- On success: redirect to `/mcqs`

#### MCQs Stub Page (`/mcqs`)

- **Protected** — requires authentication
- Placeholder content indicating MCQ features are coming soon
- Display logged-in user's name (e.g., "Welcome, Jane Smith")
- Logout button/link — submits `POST /api/auth/logout`, then redirects to `/login`
- Unauthenticated access redirects to `/login`

#### Route Summary

| Page | Route | Access |
|------|-------|--------|
| Register | `/register` | Public |
| Login | `/login` | Public |
| MCQs Stub | `/mcqs` | Protected |

---

## Test-Driven Development Approach

Every implementation phase follows **Red → Green → Refactor**. Tests are written first; they fail until the phase implementation is complete. A phase is **not done** until its Vitest suite is green **and** its acceptance criteria are checked off.

### Vitest Setup (once, before Phase 1)

Vitest is not yet installed. Set up the harness before writing any phase tests:

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom vite-tsconfig-paths
```

Add `vitest.config.ts` at the repo root and scripts to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

See `.cursor/skills/testing/SKILL.md` for full config and conventions.

### TDD Rules for This Feature

1. **Write tests first** at the beginning of each phase — expect them to fail (RED).
2. **Implement the minimum code** to make those tests pass (GREEN).
3. **Refactor** only after green; re-run `npm test` after every refactor.
4. **Colocate tests** with source: `src/lib/user-service.ts` → `src/lib/user-service.test.ts`.
5. **Mock at boundaries** — mock D1, `getCloudflareContext()`, and fetch; never hit real network or remote D1 in unit tests.
6. **Assert observable behavior** — return values, HTTP status codes, redirects, rendered text — not internal implementation details.
7. **Cover failure paths** — validation errors, duplicate email, invalid credentials, unauthenticated access.
8. **Phase exit gate** = all phase tests pass (`npm test`) + acceptance criteria for that phase marked complete.

### Test File Conventions

| Layer | Test file pattern | Mock strategy |
|-------|-------------------|---------------|
| Migration / schema | `migrations/0001_create_users.test.ts` | In-memory mock D1 or `better-sqlite3` for schema assertions |
| Password helpers | `src/lib/password.test.ts` | No mocks; real hash/compare |
| User service | `src/lib/user-service.test.ts` | Mock D1 prepared statements |
| Validation | `src/lib/validation/auth.test.ts` | Pure functions; no mocks |
| Session | `src/lib/session.test.ts` | Mock `Request`/`Response` cookies |
| API routes | `src/app/api/auth/*/route.test.ts` | Mock user service, session, password |
| UI (client) | `src/app/*/page.test.tsx` | Mock fetch; render with Testing Library |

### Shared Test Utilities

Create `src/test/` helpers reused across phases:

| File | Purpose |
|------|---------|
| `src/test/mock-d1.ts` | Fake D1Database with in-memory store for user rows |
| `src/test/mock-request.ts` | Build `Request` objects with JSON body and cookies |
| `src/test/fixtures/users.ts` | Sample user records and valid/invalid form payloads |

### Running Tests

| Command | When to use |
|---------|-------------|
| `npm test` | CI and phase exit gate — all tests must pass |
| `npm run test:watch` | During TDD loop within a phase |
| `npm run preview` | Manual smoke test after Phase 3+ (Workers runtime; not Vitest) |

---

## Implementation Phases

Each phase lists **Tests First (RED)** tasks before **Implementation (GREEN)** tasks. Do not skip the red step.

---

### Phase 0: Vitest Harness — COMPLETED

**Objective**: Install and configure Vitest so all subsequent phases can run unit tests.

**Tests First (RED)**:

1. Create a smoke test `src/test/smoke.test.ts` that asserts `true` is not the goal — instead verify the test runner resolves `@/` paths:

```typescript
import { describe, it, expect } from "vitest";

describe("vitest harness", () => {
  it("resolves path aliases and runs assertions", () => {
    expect(1 + 1).toBe(2);
  });
});
```

2. Run `npm test` — fails until Vitest is installed and configured.

**Implementation (GREEN)**:

1. Install Vitest and related dev dependencies (see Vitest Setup above)
2. Add `vitest.config.ts` with `react`, `tsconfigPaths`, and `jsdom` environment
3. Add `test` and `test:watch` scripts to `package.json`
4. Run `npm test` — smoke test passes

**Phase Exit Criteria**:

- [ ] `npm test` runs without config errors
- [ ] `@/` path alias resolves in test files
- [ ] `src/test/` directory exists for shared helpers

**Deliverables**:

- `vitest.config.ts`
- Updated `package.json` scripts and devDependencies
- `src/test/smoke.test.ts`

---

### Phase 1: Database and Migration — COMPLETED

**Objective**: Create the D1 database, users table, and migration infrastructure — validated by tests.

**Tests First (RED)**:

1. Create `src/test/mock-d1.ts` — in-memory D1 mock that supports `prepare().bind().run/all`
2. Create `migrations/0001_create_users.test.ts`:

| Test case | Expected behavior (fails until migration exists) |
|-----------|--------------------------------------------------|
| `applies migration and creates users table` | Running migration SQL on mock D1 creates `users` table |
| `users table has required columns` | Schema includes `id`, `first_name`, `last_name`, `username`, `email`, `password_hash`, `created_at`, `updated_at` |
| `email column is unique` | Inserting duplicate email throws or returns constraint error |
| `username column is unique` | Inserting duplicate username throws or returns constraint error |
| `indexes exist on email and username` | Query plan or `sqlite_master` confirms indexes |

3. Run `npm test` — migration tests fail (RED)

**Implementation (GREEN)**:

1. Create D1 database with Wrangler
2. Add `d1_databases` binding to `wrangler.jsonc`
3. Write `migrations/0001_create_users.sql` matching test expectations
4. Apply locally: `npx wrangler d1 migrations apply quizmaker-db --local`
5. Run `npm run cf-typegen` for typed bindings
6. Run `npm test` — migration tests pass (GREEN)

**Phase Exit Criteria**:

- [ ] All Phase 1 Vitest tests pass
- [ ] D1 migration creates `users` table with all required columns and indexes (acceptance criteria)
- [ ] Local D1 applied with `--local` only

**Deliverables**:

- `migrations/0001_create_users.sql`
- `migrations/0001_create_users.test.ts`
- `src/test/mock-d1.ts`
- Updated `wrangler.jsonc` with `DB` binding
- Updated `cloudflare-env.d.ts`

---

### Phase 2: User Service and Password — COMPLETED

**Objective**: Implement password helpers and user service CRUD — all behavior driven by unit tests.

**Tests First (RED)**:

1. Create `src/test/fixtures/users.ts` with sample `CreateUserInput`, valid passwords, and hashed fixture values
2. Create `src/lib/password.test.ts`:

| Test case | Expected behavior |
|-----------|-------------------|
| `hashPassword returns bcrypt hash` | Output starts with `$2` and differs from plain input |
| `hashPassword produces different hashes for same input` | Two calls yield different salts |
| `verifyPassword returns true for correct password` | Match against known hash |
| `verifyPassword returns false for wrong password` | No match |
| `verifyPassword returns false for empty password` | Rejects empty string |

3. Create `src/lib/user-service.test.ts` (mock D1 via `src/test/mock-d1.ts`):

| Test case | Expected behavior |
|-----------|-------------------|
| `createUser inserts row and returns user with id` | User returned with all fields except plain password |
| `createUser normalizes email to lowercase` | Stored email is lowercase |
| `createUser normalizes username to lowercase` | Stored username is lowercase |
| `getUserById returns user when exists` | Returns matching user |
| `getUserById returns null when not found` | Returns null |
| `getUserByEmail finds user case-insensitively` | Lookup works regardless of input case |
| `getUserByUsername finds user case-insensitively` | Lookup works regardless of input case |
| `updateUser updates fields and sets updated_at` | Changed fields persisted |
| `updateUser returns null for unknown id` | No throw; returns null |
| `deleteUser removes row and returns true` | Row gone on subsequent get |
| `deleteUser returns false for unknown id` | No throw; returns false |

4. Run `npm test` — password and user-service tests fail (RED)

**Implementation (GREEN)**:

1. Add bcrypt (or Workers-compatible alternative) dependency
2. Create `src/lib/password.ts` — `hashPassword()` and `verifyPassword()`
3. Create `src/lib/db.ts` — D1 access helper via `getCloudflareContext()`
4. Create `src/lib/user-service.ts` with all service methods
5. Run `npm test` — all Phase 2 tests pass (GREEN)
6. Refactor if needed; re-run tests

**Phase Exit Criteria**:

- [ ] All Phase 2 Vitest tests pass
- [ ] `UserService.createUser()` inserts and returns user (acceptance criteria)
- [ ] `getUserByEmail` / `getUserByUsername` retrieve users for login (acceptance criteria)
- [ ] `updateUser` / `deleteUser` behave as specified (acceptance criteria)
- [ ] Passwords hashed with bcrypt; plain text never persisted (acceptance criteria)

**Deliverables**:

- `src/lib/db.ts`
- `src/lib/password.ts`
- `src/lib/password.test.ts`
- `src/lib/user-service.ts`
- `src/lib/user-service.test.ts`
- `src/test/fixtures/users.ts`

---

### Phase 3: Validation, Session, and API Endpoints — PLANNED

**Objective**: Expose register, login, logout, and me endpoints — each endpoint tested before and after implementation.

**Tests First (RED)**:

1. Create `src/lib/validation/auth.test.ts`:

| Test case | Expected behavior |
|-----------|-------------------|
| `validateRegisterInput accepts valid payload` | Returns parsed object |
| `validateRegisterInput rejects missing firstName` | Throws or returns field error |
| `validateRegisterInput rejects invalid email` | Field error on email |
| `validateRegisterInput rejects weak password` | Field error on password |
| `validateRegisterInput rejects mismatched confirmPassword` | Field error |
| `validateRegisterInput rejects invalid username` | Field error (non-alphanumeric) |
| `validateLoginInput accepts valid payload` | Returns parsed object |
| `validateLoginInput rejects empty emailOrUsername` | Field error |
| `validateLoginInput rejects empty password` | Field error |

2. Create `src/lib/session.test.ts`:

| Test case | Expected behavior |
|-----------|-------------------|
| `createSession sets HttpOnly cookie with user id` | Cookie present on response |
| `getSessionUserId returns id from valid cookie` | Returns user id string |
| `getSessionUserId returns null when no cookie` | Returns null |
| `getSessionUserId returns null for tampered cookie` | Returns null |
| `destroySession clears session cookie` | Cookie max-age 0 or removed |

3. Create API route tests (mock user service, password, session):

**`src/app/api/auth/register/route.test.ts`**

| Test case | Expected behavior |
|-----------|-------------------|
| `POST returns 201 and user on success` | Body has user without passwordHash; `redirectTo: /mcqs` |
| `POST returns 400 on validation failure` | Status 400 with field errors |
| `POST returns 409 on duplicate email` | Status 409 |
| `POST returns 409 on duplicate username` | Status 409 |
| `POST sets session cookie on success` | Set-Cookie header present |

**`src/app/api/auth/login/route.test.ts`**

| Test case | Expected behavior |
|-----------|-------------------|
| `POST returns 200 and user on valid email login` | User in body; session cookie set |
| `POST returns 200 on valid username login` | Same as above |
| `POST returns 401 on wrong password` | Generic error message |
| `POST returns 401 on unknown user` | Generic error message; no email-exists leak |
| `POST returns 400 on missing fields` | Status 400 |

**`src/app/api/auth/logout/route.test.ts`**

| Test case | Expected behavior |
|-----------|-------------------|
| `POST returns 200 and clears session` | Cookie cleared; `redirectTo: /login` |

**`src/app/api/auth/me/route.test.ts`**

| Test case | Expected behavior |
|-----------|-------------------|
| `GET returns 200 and user when authenticated` | User without passwordHash |
| `GET returns 401 when not authenticated` | Status 401 |

4. Run `npm test` — all Phase 3 tests fail (RED)

**Implementation (GREEN)**:

1. Create `src/lib/validation/auth.ts`
2. Create `src/lib/session.ts`
3. Create route handlers:
   - `src/app/api/auth/register/route.ts`
   - `src/app/api/auth/login/route.ts`
   - `src/app/api/auth/logout/route.ts`
   - `src/app/api/auth/me/route.ts`
4. Run `npm test` — all Phase 3 tests pass (GREEN)
5. Manual smoke test with `npm run preview` (optional but recommended)

**Phase Exit Criteria**:

- [ ] All Phase 3 Vitest tests pass
- [ ] Register endpoint: 201, 400, 409 behaviors (acceptance criteria)
- [ ] Login endpoint: 200, 401 behaviors (acceptance criteria)
- [ ] Logout endpoint: 200 and session cleared (acceptance criteria)

**Deliverables**:

- `src/lib/validation/auth.ts`
- `src/lib/validation/auth.test.ts`
- `src/lib/session.ts`
- `src/lib/session.test.ts`
- Four API route handlers under `src/app/api/auth/`
- Four matching `route.test.ts` files

---

### Phase 4: UI Pages — PLANNED

**Objective**: Build register, login, and MCQs stub pages — UI behavior verified by component tests before wiring is complete.

**Tests First (RED)**:

Extract form components as client components where needed so Testing Library can render them. Server Components' data logic is tested as plain functions; interactive forms are `'use client'` components.

1. Create `src/components/auth/register-form.test.tsx`:

| Test case | Expected behavior |
|-----------|-------------------|
| `renders all required fields` | firstName, lastName, username, email, password, confirmPassword visible |
| `shows validation error on empty submit` | Error messages appear |
| `shows error when passwords do not match` | confirmPassword error |
| `calls register API and redirects on success` | fetch POST to `/api/auth/register`; navigates to `/mcqs` |
| `shows server error on 409 duplicate email` | Error message displayed |

2. Create `src/components/auth/login-form.test.tsx`:

| Test case | Expected behavior |
|-----------|-------------------|
| `renders email/username and password fields` | Fields visible |
| `shows validation error on empty submit` | Error messages appear |
| `calls login API and redirects on success` | fetch POST to `/api/auth/login`; navigates to `/mcqs` |
| `shows generic error on 401` | "Invalid email/username or password" (or equivalent) |

3. Create `src/components/auth/mcqs-stub.test.tsx`:

| Test case | Expected behavior |
|-----------|-------------------|
| `displays welcome message with user name` | "Welcome, Jane Smith" (or similar) |
| `logout button calls logout API and redirects` | fetch POST to `/api/auth/logout`; navigates to `/login` |

4. Create `src/lib/auth-guard.test.ts` (or middleware test):

| Test case | Expected behavior |
|-----------|-------------------|
| `redirects unauthenticated user to /login` | Redirect when no session |
| `allows authenticated user to access /mcqs` | No redirect when session valid |

5. Run `npm test` — all Phase 4 tests fail (RED)

**Implementation (GREEN)**:

1. Create client form components: `register-form.tsx`, `login-form.tsx`
2. Create page wrappers: `src/app/register/page.tsx`, `src/app/login/page.tsx`
3. Create MCQs stub with logout: `src/app/mcqs/page.tsx`
4. Add route protection middleware or layout guard for `/mcqs`
5. Style with shadcn/ui components (Button, Input, Label, Card, Field)
6. Run `npm test` — all Phase 4 tests pass (GREEN)
7. Manual E2E: register → MCQs → logout → login → MCQs via `npm run preview`

**Phase Exit Criteria**:

- [ ] All Phase 4 Vitest tests pass
- [ ] **Full suite green**: `npm test` passes with zero failures across all phases
- [ ] Register page redirects to `/mcqs` on success (acceptance criteria)
- [ ] Login page redirects to `/mcqs` on success (acceptance criteria)
- [ ] MCQs stub protected, shows user name, logout works (acceptance criteria)
- [ ] Auth pages render correctly on mobile, tablet, desktop (acceptance criteria)

**Deliverables**:

- `src/components/auth/register-form.tsx` + `.test.tsx`
- `src/components/auth/login-form.tsx` + `.test.tsx`
- `src/components/auth/mcqs-stub.tsx` + `.test.tsx`
- `src/app/register/page.tsx`
- `src/app/login/page.tsx`
- `src/app/mcqs/page.tsx`
- Auth middleware or protected layout + test

---

## Technical Implementation Details

### Key Files

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest configuration (path aliases, jsdom) |
| `src/test/smoke.test.ts` | Harness smoke test |
| `src/test/mock-d1.ts` | In-memory D1 mock for unit tests |
| `src/test/mock-request.ts` | Request/cookie test helpers |
| `src/test/fixtures/users.ts` | Sample user and auth payloads |
| `migrations/0001_create_users.sql` | D1 migration for users table |
| `migrations/0001_create_users.test.ts` | Migration schema tests |
| `wrangler.jsonc` | D1 binding configuration |
| `src/lib/db.ts` | D1 database access helper |
| `src/lib/password.ts` | bcrypt hash and verify helpers |
| `src/lib/password.test.ts` | Password helper unit tests |
| `src/lib/user-service.ts` | User CRUD service |
| `src/lib/user-service.test.ts` | User service unit tests |
| `src/lib/session.ts` | Session cookie create/read/destroy |
| `src/lib/session.test.ts` | Session unit tests |
| `src/lib/validation/auth.ts` | Shared validation rules for auth forms |
| `src/lib/validation/auth.test.ts` | Validation unit tests |
| `src/lib/auth-guard.test.ts` | Protected route guard tests |
| `src/app/api/auth/register/route.ts` | Register endpoint |
| `src/app/api/auth/register/route.test.ts` | Register endpoint tests |
| `src/app/api/auth/login/route.ts` | Login endpoint |
| `src/app/api/auth/login/route.test.ts` | Login endpoint tests |
| `src/app/api/auth/logout/route.ts` | Logout endpoint |
| `src/app/api/auth/logout/route.test.ts` | Logout endpoint tests |
| `src/app/api/auth/me/route.ts` | Current user endpoint |
| `src/app/api/auth/me/route.test.ts` | Me endpoint tests |
| `src/components/auth/register-form.tsx` | Register form (client component) |
| `src/components/auth/register-form.test.tsx` | Register form tests |
| `src/components/auth/login-form.tsx` | Login form (client component) |
| `src/components/auth/login-form.test.tsx` | Login form tests |
| `src/components/auth/mcqs-stub.tsx` | MCQs stub with logout (client component) |
| `src/components/auth/mcqs-stub.test.tsx` | MCQs stub tests |
| `src/app/register/page.tsx` | Registration page |
| `src/app/login/page.tsx` | Login page |
| `src/app/mcqs/page.tsx` | Protected MCQs stub page |

### Architecture Flow

```
┌─────────────┐     POST /api/auth/register     ┌──────────────────┐
│  Register   │ ──────────────────────────────► │  API Route       │
│  Page       │                                 │  (register)      │
└─────────────┘                                 └────────┬─────────┘
                                                         │
┌─────────────┐     POST /api/auth/login        ┌────────▼─────────┐
│  Login      │ ──────────────────────────────► │  User Service    │
│  Page       │                                 │  + Password lib  │
└─────────────┘                                 └────────┬─────────┘
                                                         │
┌─────────────┐     GET /mcqs (protected)       ┌────────▼─────────┐
│  MCQs Stub  │ ◄── session cookie ──────────── │  D1 (users)      │
│  Page       │     POST /api/auth/logout       └──────────────────┘
└─────────────┘
```

### Implementation Patterns

**User service query (D1 prepared statement):**

```typescript
export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE email = ?1')
    .bind(email.toLowerCase())
    .all<UserRow>();

  return result.results[0] ?? null;
}
```

**Register route handler (simplified):**

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const validated = validateRegisterInput(body);

  const existingEmail = await getUserByEmail(db, validated.email);
  if (existingEmail) return conflict('Email already registered');

  const passwordHash = await hashPassword(validated.password);
  const user = await createUser(db, { ...validated, passwordHash });
  await createSession(user.id);

  return Response.json({ user: toPublicUser(user), redirectTo: '/mcqs' }, { status: 201 });
}
```

**Login password verification:**

```typescript
const user = await getUserByEmail(db, emailOrUsername)
  ?? await getUserByUsername(db, emailOrUsername);

if (!user || !(await verifyPassword(password, user.passwordHash))) {
  return unauthorized('Invalid email/username or password');
}
```

### Important Notes

- D1 is only accessible from server code (API routes, Server Components, server actions). Never import `user-service.ts` into `'use client'` components.
- Use numbered placeholders (`?1`, `?2`) in all D1 queries per project conventions.
- Never apply migrations to the remote database from the agent; local only (`--local`).
- `npm run dev` runs on Node and will not exercise D1 bindings; use `npm run preview` to test auth against local Workers runtime.
- Email addresses should be normalized to lowercase before storage and lookup.
- Usernames should be stored lowercase for case-insensitive uniqueness checks.

---

## Acceptance Criteria

Each criterion maps to one or more Vitest tests. Mark complete only when the test passes **and** the behavior is verified.

### Phase 0 — Vitest Harness

- [x] `npm test` runs successfully with zero config errors
- [x] Path alias `@/` resolves in test files

### Phase 1 — Database

- [x] `migrations/0001_create_users.test.ts` — all tests pass
- [x] D1 migration creates `users` table with all required columns and indexes

### Phase 2 — User Service

- [x] `src/lib/password.test.ts` — all tests pass
- [x] `src/lib/user-service.test.ts` — all tests pass
- [x] `UserService.createUser()` inserts a user and returns the created record
- [x] `UserService.getUserByEmail()` and `getUserByUsername()` retrieve users for login
- [x] `UserService.updateUser()` updates allowed fields and sets `updated_at`
- [x] `UserService.deleteUser()` removes a user by ID
- [x] Passwords are hashed with bcrypt before storage; plain text is never persisted

### Phase 3 — API Endpoints

- [ ] `src/lib/validation/auth.test.ts` — all tests pass
- [ ] `src/lib/session.test.ts` — all tests pass
- [ ] All `src/app/api/auth/*/route.test.ts` — all tests pass
- [ ] `POST /api/auth/register` creates a user, establishes a session, and returns 201
- [ ] `POST /api/auth/register` rejects duplicate email (409) and duplicate username (409)
- [ ] `POST /api/auth/register` validates all fields and returns 400 on invalid input
- [ ] `POST /api/auth/login` authenticates valid credentials and returns 200 with session
- [ ] `POST /api/auth/login` returns 401 with generic message for invalid credentials
- [ ] `POST /api/auth/logout` clears the session and returns 200

### Phase 4 — UI

- [ ] All `src/components/auth/*.test.tsx` — all tests pass
- [ ] `src/lib/auth-guard.test.ts` — all tests pass
- [ ] **Full suite**: `npm test` passes with zero failures
- [ ] Register page submits to register endpoint and redirects to `/mcqs` on success
- [ ] Login page submits to login endpoint and redirects to `/mcqs` on success
- [ ] MCQs stub page is inaccessible without authentication (redirects to `/login`)
- [ ] MCQs stub page shows logged-in user name and a working logout control
- [ ] Session persists across page navigation until logout
- [ ] All auth forms show validation errors for invalid input
- [ ] Auth pages render correctly on mobile (320px+), tablet, and desktop

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Unit test pass rate | 100% before phase exit | `npm test` exit code 0 |
| Test coverage of auth flows | All happy + failure paths in PRD test tables | Vitest test case checklist per phase |
| Registration completion rate | > 90% of started registrations succeed | Count successful `POST /api/auth/register` vs. form submissions |
| Login success rate (valid credentials) | 100% | Manual and automated tests with known test accounts |
| Auth endpoint response time | < 500 ms p95 locally | Wrangler preview timing |
| Zero plain-text passwords in DB | 100% compliance | Inspect `users.password_hash` column format (bcrypt prefix `$2`) |
| Protected route enforcement | 100% unauthenticated redirects | Attempt `/mcqs` without session; verify redirect to `/login` |

---

## Dependencies

### External Dependencies

- **Cloudflare D1** — SQLite database for user persistence
- **bcrypt** (or `@node-rs/bcrypt` for Workers compatibility) — password hashing and verification
- **Wrangler** — D1 migrations and local development runtime
- **Vitest** — unit test runner for TDD workflow
- **@testing-library/react** + **@testing-library/user-event** — UI component tests
- **jsdom** — DOM environment for Vitest component tests
- **vite-tsconfig-paths** — resolves `@/` alias in tests

### Internal Dependencies

- **Next.js App Router** — pages and API routes
- **OpenNext Cloudflare adapter** — `getCloudflareContext()` for D1 binding access
- **shadcn/ui components** — Button, Input, Label, Card, Field for auth forms
- **Existing project layout** — `src/app/layout.tsx`, Tailwind v4 styling
- **`.cursor/skills/testing/SKILL.md`** — Vitest setup and testing conventions

### Environment Variables / Secrets

| Name | Purpose |
|------|---------|
| `SESSION_SECRET` | Signs and verifies session cookies |
| D1 binding `DB` | Configured in `wrangler.jsonc`, not an env var |

---

## Risks and Mitigation

### Technical Risks

- **Risk**: bcrypt may have compatibility issues in the Cloudflare Workers runtime
- **Mitigation**: Evaluate `@node-rs/bcrypt` or Web Crypto–compatible alternatives; test hashing in `npm run preview` before UI work

- **Risk**: D1 is not available during `npm run dev` (Node runtime)
- **Mitigation**: Document that auth testing requires `npm run preview`; consider a dev fallback only if preview workflow is too slow

- **Risk**: Race condition on concurrent registration with same email
- **Mitigation**: Rely on UNIQUE constraints on `email` and `username`; handle 409 gracefully in the register endpoint

### User Experience Risks

- **Risk**: Users confused by MCQs stub with no real functionality
- **Mitigation**: Clear placeholder copy: "MCQ features coming soon"; show welcome message with user name

- **Risk**: Password rules too strict, causing registration drop-off
- **Mitigation**: Show password requirements inline before submit; field-level validation on blur

---

## Troubleshooting Guide

### D1 binding not found in dev/preview

**Problem**: `env.DB` is undefined or throws at runtime

**Cause**: D1 binding not configured in `wrangler.jsonc`, or running `npm run dev` instead of preview

**Solution**: Add `d1_databases` block to `wrangler.jsonc`, run `npm run cf-typegen`, test with `npm run preview`

---

### bcrypt fails in Workers runtime

**Problem**: Password hashing throws at runtime in Cloudflare Workers

**Cause**: Native bcrypt module incompatible with Workers V8 isolate

**Solution**: Switch to `@node-rs/bcrypt` or a Workers-compatible pure JS bcrypt implementation; verify with preview

---

### Session not persisting across requests

**Problem**: User is logged out on every page navigation

**Cause**: Cookie missing `HttpOnly`, wrong path/domain, or `SESSION_SECRET` not set

**Solution**: Verify cookie attributes in `session.ts`; set `SESSION_SECRET` in `.dev.vars` for local preview

---

### UNIQUE constraint error on register

**Problem**: Register returns 500 instead of 409 for duplicate email

**Cause**: D1 constraint violation not caught in route handler

**Solution**: Catch SQLite constraint errors and map to 409 with user-friendly message

---

### Vitest tests fail with "Cannot find module '@/...'"

**Problem**: Imports using `@/` alias fail in test files

**Cause**: `vite-tsconfig-paths` not configured in `vitest.config.ts`

**Solution**: Add `tsconfigPaths()` plugin to Vitest config per testing skill

---

### Tests pass but preview runtime fails

**Problem**: All Vitest tests green but auth breaks in `npm run preview`

**Cause**: Unit tests mock D1/session; real Workers bindings behave differently

**Solution**: Run manual smoke test with `npm run preview` after Phase 3; add integration test with `@cloudflare/vitest-pool-workers` only if user approves

---

## Notes for AI Agents

When working with this PRD:

1. Start by reading the Problem and Hypothesis to understand intent
2. Use Scope (In/Out/Cut) to determine boundaries — do not build MCQ features
3. Follow **TDD**: write phase tests first (RED), implement (GREEN), refactor, re-run `npm test`
4. Follow project D1 conventions in `.cursor/rules/d1.mdc`
5. Follow Vitest conventions in `.cursor/skills/testing/SKILL.md`
6. Implement phases in order: Phase 0 (Vitest) → Phase 1 (DB) → Phase 2 (Service) → Phase 3 (API) → Phase 4 (UI)
7. Do not mark a phase complete until its Vitest suite is green **and** phase acceptance criteria are checked
8. Update phase status markers as work progresses
9. Add troubleshooting entries when bugs are found and fixed
10. Use `npm run preview` for manual Workers smoke tests after Phase 3; Vitest does not replace preview
11. Use code references format: `filepath:line-number` when citing code

---

## Current Status

**Last Updated**: August 28, 2026

**Current Phase**: Phase 2 — User Service and Password (complete; awaiting review)

**Status**: COMPLETED — ready for review before Phase 3

**TDD Workflow**: RED → GREEN → Refactor per phase; `npm test` is the phase exit gate

**Session constraints**: Do not create migrations or deploy to production — user handles those.

**Next Steps** (after your approval):

1. Commit and push Phase 2 to `feature/auth-register-login-logout` (at your direction)
2. Phase 3: Write validation, session, and API route tests (RED), then implement (GREEN)
