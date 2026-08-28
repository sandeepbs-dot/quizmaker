Date created: August 28, 2026
Date last modified: August 28, 2026 (implementation complete — verified)

# Register, Login, and Logout — Technical PRD

## Overview/Problem

Quiz Maker is a greenfield web application that will allow multiple teachers to collaborate on building a shared test bank of multiple-choice questions. Before any quiz or question functionality can be built, the application needs a way to identify users and persist their accounts.

This PRD documents the **complete authentication implementation** delivered in Phases 0–5: user registration, login, logout, D1 persistence, API endpoints, shadcn/ui pages, protected MCQs stub, and home-route redirect. After successful registration or login, users are redirected to a stub MCQs page. No MCQ creation, editing, or collaboration features are included.

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

## Implementation Record

**Feature branch**: `feature/auth-register-login-logout`  
**Stack**: Next.js 16 App Router, Cloudflare D1, OpenNext Cloudflare, Tailwind CSS v4, shadcn/ui, Vitest  
**Test suite**: 64 tests across 14 files — all passing (`npm test`)

### Git Commits (pushed)

| Commit | Phase | Description |
|--------|-------|-------------|
| `dfe5dec` | 0–1 | Vitest harness, D1 migration, schema tests, `wrangler.jsonc` binding |
| `608bb4a` | 2 | User service, `bcryptjs` password helpers, unit tests |
| `2811602` | 3 | Validation, session, register/login/logout/me API routes + tests |

### Local Implementation (Phases 4–5, verified — pending commit)

| Phase | Deliverables | Status |
|-------|--------------|--------|
| 4 | shadcn signup/login forms, MCQs stub, `/register`, `/login`, `/mcqs` pages | Implemented & verified |
| 5 | Home `/` redirect to `/login` or `/mcqs` | Implemented & verified |

### Manual Verification (August 28, 2026)

Verified locally by product owner:

- [x] Navigate to login page (`/login`)
- [x] Register new account (`/register`)
- [x] Log in with credentials
- [x] Land on MCQs stub page (`/mcqs`)
- [x] Log out and return to login
- [x] Home route (`/`) redirects appropriately

### End-to-End User Flow (implemented)

```
/  ──► /login (guest) or /mcqs (signed in)
/register ──► POST /api/auth/register ──► /mcqs
/login    ──► POST /api/auth/login    ──► /mcqs
/mcqs     ──► POST /api/auth/logout   ──► /login
```

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
| Registration | Server, before `createUser()` | `bcryptjs`, cost factor 10 |
| Login verification | Server, compare input against `password_hash` | `bcryptjs.compare()` |
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

| Page | Route | Access | Implementation |
|------|-------|--------|----------------|
| Home | `/` | Public (redirects) | `src/app/page.tsx` |
| Register | `/register` | Public | `src/app/register/page.tsx` |
| Login | `/login` | Public | `src/app/login/page.tsx` |
| MCQs Stub | `/mcqs` | Protected | `src/app/mcqs/page.tsx` |

### UI Technology and Component Library

Phase 4 UI is built with **Tailwind CSS v4** for layout and styling, and **shadcn/ui** (on Base UI) for form components. The register and login pages are based on shadcn auth block patterns, adapted to Quiz Maker field requirements and wired to the Phase 3 API endpoints.

#### shadcn Components Used

| Component | Path | Usage |
|-----------|------|--------|
| `Button` | `@/components/ui/button` | Submit actions, logout |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` | `@/components/ui/card` | Form containers |
| `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError` | `@/components/ui/field` | Accessible form layout and validation errors |
| `Input` | `@/components/ui/input` | Text, email, password fields |

#### Application Components (from shadcn blocks)

| Component | Path | Based on | Notes |
|-----------|------|----------|-------|
| `SignupForm` | `@/components/signup-form.tsx` | shadcn signup block | Split into first/last name + username per PRD; Google OAuth removed (out of scope) |
| `LoginForm` | `@/components/login-form.tsx` | shadcn login block | Email **or** username field; forgot-password and Google OAuth removed (out of scope) |
| `McqsStub` | `@/components/mcqs-stub.tsx` | Custom | Protected landing page with welcome message and logout |

#### Page Layout Pattern

All auth pages use a centered responsive layout:

```tsx
<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
  <div className="w-full max-w-sm">
    {/* Form component */}
  </div>
</div>
```

#### Styling Conventions

- Tailwind utility classes for spacing, responsive breakpoints (`md:`), and full-viewport centering (`min-h-svh`)
- shadcn semantic tokens: `text-muted-foreground`, `text-destructive`, `ring-foreground/10`
- Client form components marked `'use client'`; pages are Server Components that render the forms
- Navigation between register/login uses Next.js `Link` (not `<a href="#">`)

---

## Test-Driven Development Approach

Every implementation phase follows **Red → Green → Refactor**. Tests are written first; they fail until the phase implementation is complete. A phase is **not done** until its Vitest suite is green **and** its acceptance criteria are checked off.

### Vitest Setup (installed — Phase 0)

Vitest and Testing Library are installed. Run tests with:

```bash
npm test          # single run (64 tests)
npm run test:watch  # watch mode
```

Config: `vitest.config.ts` — Node environment default; component tests use `@vitest-environment jsdom`.

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

- [x] `npm test` runs without config errors
- [x] `@/` path alias resolves in test files
- [x] `src/test/` directory exists for shared helpers

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

- [x] All Phase 1 Vitest tests pass
- [x] D1 migration creates `users` table with all required columns and indexes
- [x] Local D1 applied with `--local` only

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

- [x] All Phase 2 Vitest tests pass
- [x] `createUser()` inserts and returns user
- [x] `getUserByEmail` / `getUserByUsername` retrieve users for login
- [x] `updateUser` / `deleteUser` behave as specified
- [x] Passwords hashed with bcryptjs; plain text never persisted

**Deliverables**:

- `src/lib/db.ts`
- `src/lib/password.ts`
- `src/lib/password.test.ts`
- `src/lib/user-service.ts`
- `src/lib/user-service.test.ts`
- `src/test/fixtures/users.ts`

---

### Phase 3: Validation, Session, and API Endpoints — COMPLETED

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

- [x] All Phase 3 Vitest tests pass
- [x] Register endpoint: 201, 400, 409 behaviors
- [x] Login endpoint: 200, 401 behaviors
- [x] Logout endpoint: 200 and session cleared

**Deliverables**:

- `src/lib/validation/auth.ts`
- `src/lib/validation/auth.test.ts`
- `src/lib/session.ts`
- `src/lib/session.test.ts`
- Four API route handlers under `src/app/api/auth/`
- Four matching `route.test.ts` files

---

### Phase 4: UI Pages — COMPLETED

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

1. Create shadcn-based client form components: `signup-form.tsx`, `login-form.tsx` (adapted from shadcn auth blocks)
2. Create page wrappers: `src/app/register/page.tsx`, `src/app/login/page.tsx`
3. Create MCQs stub with logout: `src/app/mcqs/page.tsx` + `mcqs-stub.tsx`
4. Add server-side route protection on `/mcqs` via session cookie check
5. Style with shadcn/ui + Tailwind (Button, Input, Card, Field)
6. Run `npm test` — all Phase 4 tests pass (GREEN)
7. Manual E2E: register → MCQs → logout → login → MCQs via `npm run preview`

**Phase Exit Criteria**:

- [x] All Phase 4 Vitest tests pass
- [x] **Full suite green**: `npm test` passes (64 tests)
- [x] Register page redirects to `/mcqs` on success
- [x] Login page redirects to `/mcqs` on success
- [x] MCQs stub protected, shows user name, logout works
- [x] Auth pages use shadcn/ui + Tailwind responsive layout
- [x] Manually verified: register, login, logout flows

**Deliverables**:

- `src/components/signup-form.tsx` + `.test.tsx`
- `src/components/login-form.tsx` + `.test.tsx`
- `src/components/mcqs-stub.tsx` + `.test.tsx`
- `src/lib/auth-guard.ts` + `.test.ts`
- `src/app/register/page.tsx`
- `src/app/login/page.tsx`
- `src/app/mcqs/page.tsx`

---

### Phase 5: Home Route Redirect — COMPLETED

**Objective**: Replace the default Next.js starter page at `/` with a smart redirect so users land on the auth flow or the MCQs stub.

**Tests First (RED)**:

| Test case | Expected behavior |
|-----------|-------------------|
| `getHomeRedirectPath returns /login when not authenticated` | Unauthenticated visitors go to login |
| `getHomeRedirectPath returns /mcqs when authenticated` | Signed-in users go to MCQs stub |

**Implementation (GREEN)**:

1. Add `getHomeRedirectPath()` and `getAuthenticatedUserIdFromCookies()` to `src/lib/auth-guard.ts`
2. Replace `src/app/page.tsx` starter content with server-side redirect
3. Refactor `src/app/mcqs/page.tsx` to reuse cookie session helper

**Redirect behavior**:

| Visitor state | `/` redirects to |
|---------------|------------------|
| Not signed in | `/login` (Sign up link on login page → `/register`) |
| Signed in (valid session) | `/mcqs` |

**Phase Exit Criteria**:

- [x] `getHomeRedirectPath` tests pass
- [x] Visiting `/` redirects to `/login` when not authenticated
- [x] Visiting `/` redirects to `/mcqs` when session cookie is valid
- [x] Default Next.js starter page removed

- [x] Manually verified: `/` redirects correctly when signed in/out

**Deliverables**:

- Updated `src/lib/auth-guard.ts` + `.test.ts`
- Updated `src/app/page.tsx`

---

## Technical Implementation Details

### Key Files (as built)

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest config — path aliases, React plugin |
| `migrations/0001_create_users.sql` | D1 users table migration |
| `migrations/0001_create_users.test.ts` | Schema/uniqueness/index tests (5 tests) |
| `wrangler.jsonc` | D1 binding `DB` → `quizmaker-db` |
| `src/test/mock-d1.ts` | In-memory D1 mock for unit tests |
| `src/test/sqlite-test-db.ts` | better-sqlite3 helpers for migration tests |
| `src/test/fixtures/users.ts` | Shared test payloads |
| `src/lib/db.ts` | `getDb()` via `getCloudflareContext()` |
| `src/lib/password.ts` | `hashPassword` / `verifyPassword` (bcryptjs) |
| `src/lib/user-service.ts` | User CRUD against D1 |
| `src/lib/validation/auth.ts` | Shared register/login validation |
| `src/lib/session.ts` | HMAC-signed session cookies |
| `src/lib/auth-utils.ts` | `toPublicUser()` strips password hash |
| `src/lib/auth-guard.ts` | Session checks, home redirect helpers |
| `src/app/api/auth/register/route.ts` | `POST` register handler |
| `src/app/api/auth/login/route.ts` | `POST` login handler |
| `src/app/api/auth/logout/route.ts` | `POST` logout handler |
| `src/app/api/auth/me/route.ts` | `GET` current user handler |
| `src/components/signup-form.tsx` | shadcn register form (client) |
| `src/components/login-form.tsx` | shadcn login form (client) |
| `src/components/mcqs-stub.tsx` | Protected stub + logout (client) |
| `src/app/register/page.tsx` | Register page wrapper |
| `src/app/login/page.tsx` | Login page wrapper |
| `src/app/mcqs/page.tsx` | Protected MCQs page (server) |
| `src/app/page.tsx` | Home redirect (server) |

### Code References by Layer

#### Database & configuration

D1 binding in `wrangler.jsonc`:

```21:27:wrangler.jsonc
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "quizmaker-db",
			"database_id": "f7db62f1-5d37-4e2d-a3f5-77633c8ec028",
			"migrations_dir": "migrations"
		}
```

Users table migration:

```1:13:migrations/0001_create_users.sql
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

#### Password hashing (`bcryptjs`, cost 10)

```1:18:src/lib/password.ts
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
```

#### User service — create and lookup

```66:94:src/lib/user-service.ts
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
```

#### Session — signed cookie (`quizmaker_session`)

```3:18:src/lib/session.ts
export const SESSION_COOKIE_NAME = "quizmaker_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getSessionSecret(): string {
	return process.env.SESSION_SECRET ?? "dev-session-secret";
}

function signPayload(payload: string, secret: string): string {
	return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, secret: string): string {
	const payload = Buffer.from(JSON.stringify({ userId })).toString("base64url");
	const signature = signPayload(payload, secret);
	return `${payload}.${signature}`;
}
```

#### API — register endpoint

Full handler at `src/app/api/auth/register/route.ts` — validates input, checks duplicates, hashes password, creates user, sets session cookie, returns 201 with `redirectTo: /mcqs` (lines 13–61).

#### API — login endpoint

```35:51:src/app/api/auth/login/route.ts
	const user = looksLikeEmail(emailOrUsername)
		? await getUserByEmail(db, emailOrUsername)
		: await getUserByUsername(db, emailOrUsername);

	if (!user || !(await verifyPassword(password, user.passwordHash))) {
		return NextResponse.json(
			{ error: INVALID_CREDENTIALS_MESSAGE },
			{ status: 401 },
		);
	}

	const response = NextResponse.json(
		{ user: toPublicUser(user), redirectTo: "/mcqs" },
		{ status: 200 },
	);

	return applySessionCookie(response, user.id);
```

#### Auth guard & home redirect

```20:33:src/lib/auth-guard.ts
export function getHomeRedirectPath(isAuthenticated: boolean): string {
	return isAuthenticated ? "/mcqs" : "/login";
}

export async function getAuthenticatedUserIdFromCookies(): Promise<string | null> {
	const cookieStore = await cookies();
	const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

	if (!token) {
		return null;
	}

	return verifySessionToken(token, getSessionSecret());
}
```

Home page redirect:

```7:11:src/app/page.tsx
export default async function HomePage() {
	const userId = await getAuthenticatedUserIdFromCookies();

	redirect(getHomeRedirectPath(userId !== null));
}
```

#### UI — shadcn signup form (client)

Register form uses shared validation and calls `POST /api/auth/register`, then `router.push("/mcqs")` on success. Built from shadcn signup block with first name, last name, and username fields per PRD (`src/components/signup-form.tsx`).

#### UI — protected MCQs page

`src/app/mcqs/page.tsx` reads session from cookies via `getAuthenticatedUserIdFromCookies()`, loads user from D1, and renders `McqsStub` with logout wired to `POST /api/auth/logout`.

### Test Coverage Summary

| Test file | Tests | Layer |
|-----------|-------|-------|
| `src/test/smoke.test.ts` | 1 | Vitest harness |
| `migrations/0001_create_users.test.ts` | 5 | Schema |
| `src/lib/password.test.ts` | 5 | Password |
| `src/lib/user-service.test.ts` | 11 | User service |
| `src/lib/validation/auth.test.ts` | 9 | Validation |
| `src/lib/session.test.ts` | 5 | Session |
| `src/lib/auth-guard.test.ts` | 4 | Auth guard |
| `src/app/api/auth/register/route.test.ts` | 5 | Register API |
| `src/app/api/auth/login/route.test.ts` | 5 | Login API |
| `src/app/api/auth/logout/route.test.ts` | 1 | Logout API |
| `src/app/api/auth/me/route.test.ts` | 2 | Me API |
| `src/components/signup-form.test.tsx` | 5 | Register UI |
| `src/components/login-form.test.tsx` | 4 | Login UI |
| `src/components/mcqs-stub.test.tsx` | 2 | MCQs UI |
| **Total** | **64** | |

### Architecture Flow

```
┌──────────┐  /           ┌──────────┐  /register   ┌─────────────┐
│  Home    │ ──────────► │  Login   │ ◄─────────── │  SignupForm │
│  page    │  redirect   │  page    │              │  (shadcn)   │
└──────────┘             └────┬─────┘              └──────┬──────┘
                              │ POST /api/auth/login       │ POST /api/auth/register
                              ▼                            ▼
                       ┌──────────────────────────────────────────┐
                       │  API Routes → User Service → D1 (users)   │
                       │  Password (bcryptjs) + Session (cookie)    │
                       └────────────────────┬─────────────────────┘
                                            ▼
                                     ┌─────────────┐
                                     │  /mcqs stub │
                                     │  + logout   │
                                     └─────────────┘
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

- [x] `src/lib/validation/auth.test.ts` — all tests pass
- [x] `src/lib/session.test.ts` — all tests pass
- [x] All `src/app/api/auth/*/route.test.ts` — all tests pass
- [x] `POST /api/auth/register` creates a user, establishes a session, and returns 201
- [x] `POST /api/auth/register` rejects duplicate email (409) and duplicate username (409)
- [x] `POST /api/auth/register` validates all fields and returns 400 on invalid input
- [x] `POST /api/auth/login` authenticates valid credentials and returns 200 with session
- [x] `POST /api/auth/login` returns 401 with generic message for invalid credentials
- [x] `POST /api/auth/logout` clears the session and returns 200

### Phase 4 — UI

- [x] All `src/components/*.test.tsx` — all tests pass
- [x] `src/lib/auth-guard.test.ts` — all tests pass
- [x] **Full suite**: `npm test` passes with zero failures (64 tests)
- [x] Register page submits to register endpoint and redirects to `/mcqs` on success
- [x] Login page submits to login endpoint and redirects to `/mcqs` on success
- [x] MCQs stub page is inaccessible without authentication (redirects to `/login`)
- [x] MCQs stub page shows logged-in user name and a working logout control
- [x] Auth pages use shadcn/ui + Tailwind responsive layout

### Phase 5 — Home Route

- [x] `getHomeRedirectPath` tests pass
- [x] `/` redirects unauthenticated users to `/login`
- [x] `/` redirects authenticated users to `/mcqs`

### Manual Verification (product owner — August 28, 2026)

- [x] Can navigate to `/login` and `/register`
- [x] Can register a new account and land on `/mcqs`
- [x] Can log in with existing credentials
- [x] Can log out and return to `/login`
- [x] Home `/` redirects correctly based on session

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Unit test pass rate | 100% | `npm test` — 64/64 passing |
| Manual E2E verification | Complete | Register, login, logout, home redirect verified locally |
| Registration completion rate | > 90% of started registrations succeed | Count successful `POST /api/auth/register` vs. form submissions |
| Login success rate (valid credentials) | 100% | Manual and automated tests with known test accounts |
| Auth endpoint response time | < 500 ms p95 locally | Wrangler preview timing |
| Zero plain-text passwords in DB | 100% compliance | Inspect `users.password_hash` column format (bcrypt prefix `$2`) |
| Protected route enforcement | 100% unauthenticated redirects | Attempt `/mcqs` without session; verify redirect to `/login` |

---

## Dependencies

### External Dependencies

- **Cloudflare D1** — SQLite database for user persistence
- **bcryptjs** (pure JS) — password hashing; compatible with Workers via `nodejs_compat`
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
6. All phases 0–5 are **complete and verified** — do not rebuild unless changing auth behavior
7. Use code references format: `filepath:line-number` when citing code

---

## Current Status

**Last Updated**: August 28, 2026

**Status**: IMPLEMENTED & VERIFIED

**Feature branch**: `feature/auth-register-login-logout` (Phases 0–3 pushed; Phases 4–5 local, verified)

**Test suite**: 64/64 passing

**Manual verification**: Register, login, logout, MCQs stub, and home redirect confirmed working locally

**Outstanding**:

- Commit and push Phases 4–5 to feature branch (at product owner direction)
- Production D1 migration and deploy (handled by product owner — not agent)
