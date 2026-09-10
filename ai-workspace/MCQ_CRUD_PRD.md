Date created: September 10, 2026
Date last modified: September 10, 2026 (schema: `question` + `created_by_user_id`)

# Multiple Choice Questions (MCQ) CRUD — Technical PRD

## Overview/Problem

Quiz Maker already has authentication: teachers can register, log in, and land on a protected MCQs stub page at `/mcqs`. That stub confirms identity but offers no way to build the shared test bank the product is meant for.

Teachers need to create, view, edit, and delete multiple-choice questions, each with a configurable set of answer choices (two to six). They also need a way to preview a question and record practice attempts (which choice was selected and whether it was correct). Without this capability, the application cannot deliver its core value — a collaborative MCQ test bank.

This PRD defines the **MCQ CRUD feature**: three D1 tables (`mcqs`, `mcq_choices`, `mcq_attempts`), an MCQ service layer, authenticated API endpoints, and shadcn/ui pages that replace the stub with a list table, create/edit form, preview flow, and row-level actions.

---

## Hypothesis

We believe that implementing MCQ create/read/update/delete with a persisted choices model, attempt tracking, and a shadcn table-based management UI will let authenticated teachers start building and validating the shared test bank immediately after login.

---

## Scope

### In Scope

What will be built in this feature:

- D1 migration for three tables: `mcqs`, `mcq_choices`, `mcq_attempts`
- `mcqs` table: `id`, `name`, `question`, `created_by_user_id`, `created_at`, `updated_at`
- `mcq_choices` table: choices linked to an MCQ via foreign key; 2–6 choices per question; exactly one marked correct
- `mcq_attempts` table: records `mcq_id`, `user_id`, selected `choice_id`, and `is_correct`
- MCQ service layer in `src/lib/mcq-service.ts` (mirrors `user-service.ts` patterns)
- Validation module for MCQ create/update payloads and attempt submissions
- Authenticated API routes under `/api/mcqs/` (all require valid session)
- Replace MCQs stub at `/mcqs` with a **list page** showing all questions in a shadcn **Table**
- **Create** button on list page → `/mcqs/new`
- Row **Actions** column with vertical-ellipsis (**DropdownMenu**) offering **Edit**, **Preview**, and **Delete**
- Shared **create/edit page** at `/mcqs/new` (create) and `/mcqs/[id]/edit` (edit) with **Save** and **Cancel**
- **Preview page** at `/mcqs/[id]/preview` — read-only question display; user selects a choice and submits an attempt
- Delete confirmation dialog before removing a question
- Cascade delete: removing an MCQ deletes its choices and attempts
- **Vitest** TDD workflow: tests written first for each phase (Red → Green → Refactor)
- Continue **Tailwind CSS v4** + **shadcn/ui** component patterns from auth

### Out of Scope

What is explicitly not being built now but may be considered later:

- Per-user or per-teacher ownership of MCQs (all authenticated users see and edit the full shared bank)
- Role-based access control (admin vs teacher)
- Bulk import/export of questions
- Question categories, tags, or difficulty levels
- Rich text / images in question or choice text
- Randomized choice order on preview
- Timed quizzes or multi-question assessments
- Attempt history UI or analytics dashboard
- Soft delete / archive for MCQs
- Real-time collaboration or co-editing locks
- Search, filter, sort, or pagination beyond a simple full list (acceptable for initial volume)
- Display of creator name on list/detail (only `created_by_user_id` is stored; no join UI in this phase)
- Audit log of who edited each question

### Cut

Things that were considered during planning but deliberately removed (and why):

- **Separate create and edit page components** — One shared `McqForm` component handles both `/mcqs/new` and `/mcqs/[id]/edit` to reduce duplication; only route param and initial data differ.
- **Inline table editing** — Edit navigates to a dedicated page for clearer validation and choice management.
- **Multiple correct answers** — Exactly one `is_correct` choice per MCQ keeps preview/attempt logic simple; multi-select can be a future schema change.
- **Editable `created_by_user_id`** — Set once on create from the authenticated session; never updated on edit.
- **Dedicated `GET /api/mcqs/:id/attempts` list endpoint** — Attempts are written on preview submit only; listing history is out of scope.

---

## Technical Requirements

### Database Schema

The application continues to use **Cloudflare D1** (SQLite). Schema changes are delivered through Wrangler migrations (`migrations/0002_create_mcq_tables.sql`).

#### Table: `mcqs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID hex string (same pattern as `users`) |
| `name` | TEXT | NOT NULL | Short title or label for the MCQ (e.g. topic name) |
| `question` | TEXT | NOT NULL | The actual question text shown to the user |
| `created_by_user_id` | TEXT | NOT NULL, FK → `users(id)` | User who created the MCQ; set from session on create |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Row creation time |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**

- `idx_mcqs_created_at` on `created_at` — supports default list ordering (newest first)
- `idx_mcqs_created_by_user_id` on `created_by_user_id` — supports future filtering by creator

#### Table: `mcq_choices`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID hex string |
| `mcq_id` | TEXT | NOT NULL, FK → `mcqs(id)` ON DELETE CASCADE | Parent question |
| `choice_text` | TEXT | NOT NULL | Display text for this option |
| `is_correct` | INTEGER | NOT NULL DEFAULT 0 | SQLite boolean: `1` = correct, `0` = incorrect |
| `sort_order` | INTEGER | NOT NULL | Display order (0-based); stable ordering in UI |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Row creation time |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**

- `idx_mcq_choices_mcq_id` on `mcq_id` — fast load of choices for a question

**Constraints (enforced in service + validation, not DB triggers):**

- 2–6 choices per `mcq_id`
- Exactly one choice with `is_correct = 1` per `mcq_id`

#### Table: `mcq_attempts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID hex string |
| `mcq_id` | TEXT | NOT NULL, FK → `mcqs(id)` ON DELETE CASCADE | Question attempted |
| `user_id` | TEXT | NOT NULL, FK → `users(id)` | Authenticated user |
| `choice_id` | TEXT | NOT NULL, FK → `mcq_choices(id)` | Selected answer |
| `is_correct` | INTEGER | NOT NULL | `1` if selected choice is correct, else `0` |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Attempt timestamp |

**Indexes:**

- `idx_mcq_attempts_mcq_id` on `mcq_id`
- `idx_mcq_attempts_user_id` on `user_id`

#### Migration SQL

```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_mcqs_created_at ON mcqs(created_at);
CREATE INDEX idx_mcqs_created_by_user_id ON mcqs(created_by_user_id);

CREATE TABLE mcq_choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  choice_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices(mcq_id);

CREATE TABLE mcq_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (choice_id) REFERENCES mcq_choices(id)
);

CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts(mcq_id);
CREATE INDEX idx_mcq_attempts_user_id ON mcq_attempts(user_id);
```

**Migration workflow:**

1. Create migration: `npx wrangler d1 migrations create quizmaker-db create_mcq_tables`
2. Apply locally: `npx wrangler d1 migrations apply quizmaker-db --local`
3. Run `npm run cf-typegen` if bindings change
4. Never apply to remote from the agent

---

### MCQ Service

The MCQ service centralizes all database access for questions, choices, and attempts. It lives in `src/lib/mcq-service.ts` and is called by API route handlers — not directly from UI components.

#### Types

```typescript
interface Mcq {
  id: string;
  name: string;
  question: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

interface McqChoice {
  id: string;
  mcqId: string;
  choiceText: string;
  isCorrect: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface McqWithChoices extends Mcq {
  choices: McqChoice[];
}

interface McqAttempt {
  id: string;
  mcqId: string;
  userId: string;
  choiceId: string;
  isCorrect: boolean;
  createdAt: string;
}

interface CreateMcqInput {
  name: string;
  question: string;
  createdByUserId: string;
  choices: CreateMcqChoiceInput[];
}

interface CreateMcqChoiceInput {
  choiceText: string;
  isCorrect: boolean;
}

interface UpdateMcqInput {
  name?: string;
  question?: string;
  choices?: CreateMcqChoiceInput[];
}

interface CreateAttemptInput {
  mcqId: string;
  userId: string;
  choiceId: string;
}
```

#### Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `listMcqs(db)` | Fetch all MCQs (summary, no choices) | `Mcq[]` |
| `getMcqById(db, id)` | Fetch MCQ with ordered choices | `McqWithChoices \| null` |
| `createMcq(db, input)` | Insert MCQ + choices in a transaction; persists `created_by_user_id` from input | `McqWithChoices` |
| `updateMcq(db, id, input)` | Update MCQ fields; replace all choices | `McqWithChoices \| null` |
| `deleteMcq(db, id)` | Delete MCQ (cascades choices + attempts) | `boolean` |
| `createAttempt(db, input)` | Record attempt; compute `is_correct` from choice | `McqAttempt` |

**Implementation notes:**

- All queries use D1 prepared statements with numbered placeholders (`?1`, `?2`)
- Access D1 via `getDb()` from `src/lib/db.ts`
- `createMcq` / `updateMcq` validate choice count (2–6) and exactly one correct answer before writing
- `createMcq` requires `createdByUserId` — API route sets this from the authenticated session, not from the client body
- `updateMcq` never changes `created_by_user_id` (immutable after create)
- `updateMcq` deletes existing choices for the MCQ and re-inserts from payload (simpler than per-row patch)
- `createAttempt` verifies `choice_id` belongs to `mcq_id` before insert
- Use `db.batch()` or explicit transaction pattern for multi-statement create/update

---

### Validation

Shared validation in `src/lib/validation/mcq.ts` (used by API routes and optionally client forms).

#### MCQ create/update rules

| Field | Rules |
|-------|-------|
| `name` | Required; 1–200 characters; trimmed |
| `question` | Required; 1–2000 characters; trimmed |
| `choices` | Required array; length 2–6 |
| `choices[].choiceText` | Required; 1–500 characters; trimmed; non-empty |
| `choices[].isCorrect` | Boolean |
| Correct count | Exactly one choice must have `isCorrect: true` |

#### Attempt rules

| Field | Rules |
|-------|-------|
| `choiceId` | Required; non-empty string |

---

### API Endpoints

All MCQ endpoints require an authenticated session (same cookie as auth). Unauthenticated requests return **401**.

#### GET /api/mcqs

List all multiple-choice questions (summary only — no choices).

**Response:**

- Success (200):

```json
{
  "mcqs": [
    {
      "id": "abc123",
      "name": "Photosynthesis",
      "question": "What do plants use to make food?",
      "createdByUserId": "user1",
      "createdAt": "2026-09-10T10:00:00.000Z",
      "updatedAt": "2026-09-10T10:00:00.000Z"
    }
  ]
}
```

- Error (401): Not authenticated
- Error (500): Server error

---

#### GET /api/mcqs/[id]

Fetch a single MCQ with its choices (ordered by `sort_order`).

**Response:**

- Success (200):

```json
{
  "mcq": {
    "id": "abc123",
    "name": "Photosynthesis",
    "question": "What do plants use to make food?",
    "createdByUserId": "user1",
    "createdAt": "2026-09-10T10:00:00.000Z",
    "updatedAt": "2026-09-10T10:00:00.000Z",
    "choices": [
      {
        "id": "choice1",
        "mcqId": "abc123",
        "choiceText": "Sunlight",
        "isCorrect": true,
        "sortOrder": 0,
        "createdAt": "2026-09-10T10:00:00.000Z",
        "updatedAt": "2026-09-10T10:00:00.000Z"
      },
      {
        "id": "choice2",
        "mcqId": "abc123",
        "choiceText": "Moonlight",
        "isCorrect": false,
        "sortOrder": 1,
        "createdAt": "2026-09-10T10:00:00.000Z",
        "updatedAt": "2026-09-10T10:00:00.000Z"
      }
    ]
  }
}
```

- Error (401): Not authenticated
- Error (404): MCQ not found
- Error (500): Server error

---

#### POST /api/mcqs

Create a new MCQ with choices.

**Request Body:**

```json
{
  "name": "Photosynthesis",
  "question": "What do plants use to make food?",
  "choices": [
    { "choiceText": "Sunlight", "isCorrect": true },
    { "choiceText": "Moonlight", "isCorrect": false }
  ]
}
```

**Server behavior:**

1. Validate session; resolve `userId` from session
2. Validate payload (name, question, choices 2–6, exactly one correct)
3. Call `createMcq()` with `createdByUserId` set from session (not from request body)
4. Return created MCQ with choices

**Response:**

- Success (201): Full `mcq` object (same shape as GET single)
- Error (400): Validation error with field-level messages
- Error (401): Not authenticated
- Error (500): Server error

---

#### PUT /api/mcqs/[id]

Update an existing MCQ. Replaces all choices when `choices` is provided.

**Request Body:**

```json
{
  "name": "Photosynthesis (updated)",
  "question": "What do plants use to make food? (revised)",
  "choices": [
    { "choiceText": "Sunlight", "isCorrect": true },
    { "choiceText": "Water only", "isCorrect": false },
    { "choiceText": "Moonlight", "isCorrect": false }
  ]
}
```

**Response:**

- Success (200): Updated `mcq` object
- Error (400): Validation error
- Error (401): Not authenticated
- Error (404): MCQ not found
- Error (500): Server error

---

#### DELETE /api/mcqs/[id]

Delete an MCQ and all related choices and attempts (CASCADE).

**Response:**

- Success (200):

```json
{
  "message": "MCQ deleted successfully"
}
```

- Error (401): Not authenticated
- Error (404): MCQ not found
- Error (500): Server error

---

#### POST /api/mcqs/[id]/attempts

Record a practice attempt from the preview page.

**Request Body:**

```json
{
  "choiceId": "choice2"
}
```

**Server behavior:**

1. Validate session; resolve `userId` from session
2. Validate `choiceId` is present
3. Load MCQ and verify `choiceId` belongs to this `mcq_id`
4. Set `is_correct` from the choice's `is_correct` flag
5. Call `createAttempt()`
6. Return attempt result (include whether correct — safe for preview UX)

**Response:**

- Success (201):

```json
{
  "attempt": {
    "id": "attempt1",
    "mcqId": "abc123",
    "userId": "user1",
    "choiceId": "choice2",
    "isCorrect": false,
    "createdAt": "2026-09-10T11:00:00.000Z"
  }
}
```

- Error (400): Validation error or choice does not belong to MCQ
- Error (401): Not authenticated
- Error (404): MCQ not found
- Error (500): Server error

---

### User Interface Requirements

All MCQ pages are **protected** — unauthenticated users redirect to `/login` (reuse `getAuthenticatedUserIdFromCookies()` from `auth-guard.ts`).

#### MCQ List Page (`/mcqs`)

Replaces the current `McqsStub` placeholder.

**Layout:**

- Page header with app context and logged-in user welcome (retain logout)
- Primary action: **Create MCQ** button (`Button`, default variant) → navigates to `/mcqs/new`
- shadcn **Table** listing all MCQs

**Table columns:**

| Column | Content |
|--------|---------|
| Name | `mcq.name` (truncate with tooltip if long) |
| Question | `mcq.question` (truncate with tooltip if long) |
| Actions | Vertical ellipsis trigger → **DropdownMenu** |

**Row actions (DropdownMenu):**

| Action | Behavior |
|--------|----------|
| Edit | Navigate to `/mcqs/[id]/edit` |
| Preview | Navigate to `/mcqs/[id]/preview` |
| Delete | Open **AlertDialog** confirmation; on confirm `DELETE /api/mcqs/[id]`; refresh list |

**Empty state:** When no MCQs exist, show message and prominent Create button.

**Data loading:** Server Component fetches list via service, or client fetches `GET /api/mcqs` on mount — prefer server fetch for initial render consistency with auth pages.

---

#### MCQ Create / Edit Page (`/mcqs/new`, `/mcqs/[id]/edit`)

Single shared form component: `McqForm`.

**Form fields:**

| Field | Control | Validation |
|-------|---------|------------|
| Name | `Input` | Required, 1–200 chars |
| Question | `Textarea` | Required, 1–2000 chars |
| Choices | Dynamic list (default **2** rows) | 2–6 rows; each text required |
| Correct answer | `RadioGroup` (one per question) | Exactly one selected |

**Choice row actions:**

- **Add choice** — visible while count &lt; 6; appends empty row
- **Remove choice** — visible while count &gt; 2; removes row and re-validates correct selection

**Footer actions:**

| Button | Behavior |
|--------|----------|
| Save | `POST /api/mcqs` (create) or `PUT /api/mcqs/[id]` (edit); on success redirect to `/mcqs` |
| Cancel | Navigate to `/mcqs` without saving |

**Edit mode:** Page loads existing MCQ via `GET /api/mcqs/[id]` or server-side `getMcqById()`; pre-fills form including correct radio selection.

**Loading / error states:** Show loading while fetching edit data; show not-found message if MCQ missing.

---

#### MCQ Preview Page (`/mcqs/[id]/preview`)

Read-only view of question for practice.

**Display:**

- MCQ name (optional subheading or metadata)
- Question text (primary prompt)
- Choices as **RadioGroup** (select one)
- **Submit answer** button

**On submit:**

- `POST /api/mcqs/[id]/attempts` with selected `choiceId`
- Show result feedback: correct vs incorrect (e.g. `Badge` or inline message)
- Do not reveal other choices as correct/incorrect until after submit (optional: highlight selected choice only)

**Navigation:**

- **Back to list** link/button → `/mcqs`

---

#### Route Summary

| Page | Route | Access | Component |
|------|-------|--------|-----------|
| MCQ List | `/mcqs` | Protected | `src/app/mcqs/page.tsx` + `mcq-list.tsx` |
| MCQ Create | `/mcqs/new` | Protected | `src/app/mcqs/new/page.tsx` + `mcq-form.tsx` |
| MCQ Edit | `/mcqs/[id]/edit` | Protected | `src/app/mcqs/[id]/edit/page.tsx` + `mcq-form.tsx` |
| MCQ Preview | `/mcqs/[id]/preview` | Protected | `src/app/mcqs/[id]/preview/page.tsx` + `mcq-preview.tsx` |

---

### UI Technology and Component Library

Continue **Tailwind CSS v4** + **shadcn/ui** (Base UI) patterns from auth.

#### shadcn Components — Existing

| Component | Path | Usage |
|-----------|------|--------|
| `Button` | `@/components/ui/button` | Create, Save, Cancel, Submit, logout |
| `Card` | `@/components/ui/card` | Page sections, preview container |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` | `@/components/ui/table` | MCQ list |
| `Input` | `@/components/ui/input` | Name, choice text |
| `Field`, `FieldGroup`, `FieldLabel`, `FieldError` | `@/components/ui/field` | Form layout and validation |
| `Dialog` | `@/components/ui/dialog` | Optional; prefer AlertDialog for delete |
| `Badge` | `@/components/ui/badge` | Correct/incorrect feedback on preview |

#### shadcn Components — To Add

| Component | Purpose |
|-----------|---------|
| `DropdownMenu` | Row actions (vertical ellipsis: Edit, Preview, Delete) |
| `AlertDialog` | Delete confirmation |
| `RadioGroup` + `RadioGroupItem` | Mark correct answer on form; select answer on preview |
| `Textarea` | Question text input on create/edit form |

Install via shadcn CLI as needed, matching existing `components/ui` conventions.

#### Application Components

| Component | Path | Purpose |
|-----------|------|---------|
| `McqList` | `src/components/mcq-list.tsx` | Table, create button, row actions, delete dialog |
| `McqForm` | `src/components/mcq-form.tsx` | Shared create/edit form |
| `McqPreview` | `src/components/mcq-preview.tsx` | Preview + attempt submit |
| `McqActionsMenu` | `src/components/mcq-actions-menu.tsx` | Optional extract of ellipsis dropdown |

**Deprecation:** `McqsStub` (`src/components/mcqs-stub.tsx`) is replaced by `McqList`; remove stub after list page ships.

---

## Test-Driven Development Approach

Every implementation phase follows **Red → Green → Refactor**, matching the auth feature. A phase is **not done** until Vitest is green for that phase and acceptance criteria are checked off.

### TDD Rules

1. **Write tests first** at the beginning of each phase — expect them to fail (RED).
2. **Implement the minimum code** to make those tests pass (GREEN).
3. **Refactor** only after green; re-run `npm test` after every refactor.
4. **Colocate tests** with source files.
5. **Mock at boundaries** — mock D1, session, and `fetch` in UI tests.
6. **Assert observable behavior** — HTTP status, returned shapes, rendered text, navigation.
7. **Cover failure paths** — validation errors, 404, 401, invalid choice on attempt.
8. **Phase exit gate** = phase tests pass + acceptance criteria marked complete.

### Shared Test Utilities

Extend `src/test/`:

| File | Purpose |
|------|---------|
| `src/test/fixtures/mcqs.ts` | Sample MCQ payloads, choices, valid/invalid forms |
| `src/test/mock-d1.ts` | Extend mock to support `mcqs`, `mcq_choices`, `mcq_attempts` tables |

### Test File Conventions

| Layer | Test file pattern |
|-------|-------------------|
| Migration | `migrations/0002_create_mcq_tables.test.ts` |
| Validation | `src/lib/validation/mcq.test.ts` |
| MCQ service | `src/lib/mcq-service.test.ts` |
| API routes | `src/app/api/mcqs/**/route.test.ts` |
| UI | `src/components/mcq-*.test.tsx` |

---

## Implementation Phases

Each phase lists **Tests First (RED)** before **Implementation (GREEN)**.

---

### Phase 1: Database and Migration — COMPLETED

**Objective:** Create D1 tables for MCQs, choices, and attempts — validated by migration tests.

**Tests First (RED):**

1. Create `migrations/0002_create_mcq_tables.test.ts`:

| Test case | Expected behavior |
|-----------|-------------------|
| `applies migration and creates mcqs table` | Migration SQL creates `mcqs` |
| `applies migration and creates mcq_choices table` | Table exists with FK to `mcqs` |
| `applies migration and creates mcq_attempts table` | Table exists with FKs |
| `mcqs table has required columns` | `id`, `name`, `question`, `created_by_user_id`, `created_at`, `updated_at` |
| `mcqs.created_by_user_id references users` | FK constraint to `users(id)` |
| `mcq_choices table has required columns` | Includes `mcq_id`, `choice_text`, `is_correct`, `sort_order` |
| `mcq_attempts table has required columns` | Includes `mcq_id`, `user_id`, `choice_id`, `is_correct` |
| `deleting mcq cascades to choices and attempts` | Child rows removed |

2. Run `npm test` — new migration tests fail (RED)

**Implementation (GREEN):**

1. Write `migrations/0002_create_mcq_tables.sql`
2. Apply locally: `npx wrangler d1 migrations apply quizmaker-db --local`
3. Run `npm test` — migration tests pass (GREEN)

**Phase Exit Criteria:**

- [x] All Phase 1 Vitest tests pass
- [x] Three tables created with indexes and CASCADE behavior

**Deliverables:**

- `migrations/0002_create_mcq_tables.sql`
- `migrations/0002_create_mcq_tables.test.ts`

---

### Phase 2: MCQ Service and Validation — COMPLETED

**Objective:** Implement validation and MCQ service CRUD + attempts — behavior driven by unit tests.

**Tests First (RED):**

1. Create `src/test/fixtures/mcqs.ts`
2. Create `src/lib/validation/mcq.test.ts`:

| Test case | Expected behavior |
|-----------|-------------------|
| `validateCreateMcqInput accepts valid payload` | Returns parsed object |
| `validateCreateMcqInput rejects empty name` | Field error |
| `validateCreateMcqInput rejects empty question` | Field error |
| `validateCreateMcqInput rejects fewer than 2 choices` | Field error |
| `validateCreateMcqInput rejects more than 6 choices` | Field error |
| `validateCreateMcqInput rejects zero correct answers` | Field error |
| `validateCreateMcqInput rejects multiple correct answers` | Field error |
| `validateCreateMcqInput rejects empty choice text` | Field error |
| `validateAttemptInput accepts valid choiceId` | Returns parsed object |
| `validateAttemptInput rejects missing choiceId` | Field error |

3. Create `src/lib/mcq-service.test.ts`:

| Test case | Expected behavior |
|-----------|-------------------|
| `listMcqs returns all mcqs ordered by created_at desc` | Array of summaries |
| `getMcqById returns mcq with ordered choices` | Choices sorted by `sort_order` |
| `getMcqById returns null when not found` | null |
| `createMcq inserts mcq and choices` | Returns full mcq with ids |
| `createMcq persists created_by_user_id` | Stored value matches input |
| `updateMcq does not change created_by_user_id` | Creator unchanged after edit |
| `createMcq assigns sort_order from array index` | 0, 1, 2, ... |
| `updateMcq updates fields and replaces choices` | New choices persisted |
| `updateMcq returns null for unknown id` | null |
| `deleteMcq removes mcq and returns true` | Row gone |
| `deleteMcq returns false for unknown id` | false |
| `createAttempt records is_correct from choice` | Correct flag matches choice |
| `createAttempt rejects choice not belonging to mcq` | Throws or returns error |

4. Run `npm test` — Phase 2 tests fail (RED)

**Implementation (GREEN):**

1. Create `src/lib/validation/mcq.ts`
2. Create `src/lib/mcq-service.ts`
3. Run `npm test` — Phase 2 tests pass (GREEN)

**Phase Exit Criteria:**

- [x] All Phase 2 Vitest tests pass
- [x] Service enforces 2–6 choices and exactly one correct answer

**Deliverables:**

- `src/lib/validation/mcq.ts` + `.test.ts`
- `src/lib/mcq-service.ts` + `.test.ts`
- `src/test/fixtures/mcqs.ts`

---

### Phase 3: API Endpoints — COMPLETED

**Objective:** Expose authenticated MCQ and attempt endpoints — each tested before and after implementation.

**Tests First (RED):**

Create route tests (mock mcq-service, session):

**`src/app/api/mcqs/route.test.ts`**

| Test case | Expected behavior |
|-----------|-------------------|
| `GET returns 200 and mcqs list when authenticated` | Array in body |
| `GET returns 401 when not authenticated` | Status 401 |
| `POST returns 201 and mcq on valid create` | Full mcq in body |
| `POST returns 400 on validation failure` | Field errors |
| `POST returns 401 when not authenticated` | Status 401 |

**`src/app/api/mcqs/[id]/route.test.ts`**

| Test case | Expected behavior |
|-----------|-------------------|
| `GET returns 200 and mcq with choices` | mcq object |
| `GET returns 404 when not found` | Status 404 |
| `PUT returns 200 on valid update` | Updated mcq |
| `PUT returns 404 when not found` | Status 404 |
| `DELETE returns 200 on success` | Success message |
| `DELETE returns 404 when not found` | Status 404 |

**`src/app/api/mcqs/[id]/attempts/route.test.ts`**

| Test case | Expected behavior |
|-----------|-------------------|
| `POST returns 201 and attempt on valid submit` | attempt with isCorrect |
| `POST returns 400 when choice invalid` | Status 400 |
| `POST returns 401 when not authenticated` | Status 401 |
| `POST returns 404 when mcq not found` | Status 404 |

**Implementation (GREEN):**

1. Create route handlers:
   - `src/app/api/mcqs/route.ts` — GET list, POST create
   - `src/app/api/mcqs/[id]/route.ts` — GET, PUT, DELETE
   - `src/app/api/mcqs/[id]/attempts/route.ts` — POST attempt
2. Add shared `requireAuthenticatedUserId()` helper (or extend auth-guard)
3. Run `npm test` — Phase 3 tests pass (GREEN)

**Phase Exit Criteria:**

- [x] All Phase 3 API route tests pass
- [x] All endpoints return 401 without session

**Deliverables:**

- Three API route files + matching `route.test.ts` files
- Auth helper for API routes

---

### Phase 4: UI — List, Form, Preview — COMPLETED

**Objective:** Replace MCQs stub with full management UI — component tests before wiring.

**Tests First (RED):**

1. `src/components/mcq-list.test.tsx`:

| Test case | Expected behavior |
|-----------|-------------------|
| `renders table with mcq rows` | Name and question visible |
| `create button navigates to /mcqs/new` | router.push called |
| `actions menu shows Edit, Preview, Delete` | Menu items present |
| `delete confirms and calls DELETE API` | fetch DELETE; list refreshes |
| `shows empty state when no mcqs` | Empty message + create CTA |

2. `src/components/mcq-form.test.tsx`:

| Test case | Expected behavior |
|-----------|-------------------|
| `renders with two default choice rows` | Two choice inputs |
| `add choice appends row up to six` | Row count increases |
| `remove choice disabled at two rows` | Cannot go below 2 |
| `shows validation errors on empty submit` | Errors displayed |
| `save calls POST on create` | fetch POST `/api/mcqs` |
| `save calls PUT on edit` | fetch PUT `/api/mcqs/:id` |
| `cancel navigates to /mcqs` | router.push `/mcqs` |

3. `src/components/mcq-preview.test.tsx`:

| Test case | Expected behavior |
|-----------|-------------------|
| `renders question and choices` | Name, question text, and choices visible |
| `submit calls attempts API` | POST `/api/mcqs/:id/attempts` |
| `shows correct feedback after submit` | Success message when isCorrect true |
| `shows incorrect feedback after submit` | Message when isCorrect false |

4. Run `npm test` — Phase 4 tests fail (RED)

**Implementation (GREEN):**

1. Add shadcn components: `DropdownMenu`, `AlertDialog`, `RadioGroup`, `Textarea`
2. Build `mcq-list.tsx`, `mcq-form.tsx`, `mcq-preview.tsx`
3. Create pages: `/mcqs`, `/mcqs/new`, `/mcqs/[id]/edit`, `/mcqs/[id]/preview`
4. Replace `McqsStub` usage in `src/app/mcqs/page.tsx`
5. Remove or archive `mcqs-stub.tsx` and update/remove its tests
6. Run `npm test` — full suite green (GREEN)
7. Manual smoke test via `npm run preview`

**Phase Exit Criteria:**

- [x] All Phase 4 component tests pass
- [x] Full `npm test` suite passes
- [ ] List, create, edit, preview, delete work end-to-end manually

**Deliverables:**

- `src/components/mcq-list.tsx` + `.test.tsx`
- `src/components/mcq-form.tsx` + `.test.tsx`
- `src/components/mcq-preview.tsx` + `.test.tsx`
- Four page files under `src/app/mcqs/`
- New shadcn UI primitives as needed

---

## Technical Implementation Details

### Key Files (planned)

| File | Purpose |
|------|---------|
| `migrations/0002_create_mcq_tables.sql` | D1 schema for mcqs, choices, attempts |
| `src/lib/mcq-service.ts` | MCQ CRUD + attempts against D1 |
| `src/lib/validation/mcq.ts` | Shared validation for MCQ payloads |
| `src/app/api/mcqs/route.ts` | List + create |
| `src/app/api/mcqs/[id]/route.ts` | Get + update + delete |
| `src/app/api/mcqs/[id]/attempts/route.ts` | Record attempt |
| `src/components/mcq-list.tsx` | Table list with actions |
| `src/components/mcq-form.tsx` | Create/edit form |
| `src/components/mcq-preview.tsx` | Preview + attempt |
| `src/app/mcqs/page.tsx` | Protected list page (replaces stub) |

### Architecture Flow

```
┌─────────────┐     GET /api/mcqs      ┌──────────────────────────────┐
│  /mcqs      │ ◄────────────────────► │  API Routes (auth required)   │
│  McqList    │                        │  → mcq-service → D1           │
│  (Table)    │                        │    mcqs | mcq_choices |       │
└──────┬──────┘                        │    mcq_attempts               │
       │ Create                        └──────────────────────────────┘
       ▼
┌─────────────┐     POST/PUT           ┌──────────────────────────────┐
│ /mcqs/new   │ ─────────────────────► │  createMcq / updateMcq        │
│ /mcqs/      │                        └──────────────────────────────┘
│ [id]/edit   │
│  McqForm    │
└─────────────┘

┌─────────────┐     POST attempts      ┌──────────────────────────────┐
│ /mcqs/      │ ─────────────────────► │  createAttempt              │
│ [id]/preview│                        └──────────────────────────────┘
│ McqPreview  │
└─────────────┘
```

### Important Notes

- D1 is only accessible from server code. Never import `mcq-service.ts` into `'use client'` components.
- Use numbered placeholders (`?1`, `?2`) in all D1 queries.
- Never apply migrations to remote database from the agent; local only (`--local`).
- Test against D1 with `npm run preview`, not `npm run dev`.
- Deleting an MCQ is irreversible in this phase (hard delete with CASCADE).
- Attempt `is_correct` is derived server-side from the selected choice — do not trust client-sent correctness flags.
- `created_by_user_id` is set only on create from the authenticated session — never accept it from the client request body.

---

## Acceptance Criteria

### Phase 1 — Database

- [x] `migrations/0002_create_mcq_tables.test.ts` — all tests pass
- [x] Three tables exist with correct columns, indexes, and CASCADE delete

### Phase 2 — Service

- [x] `src/lib/validation/mcq.test.ts` — all tests pass
- [x] `src/lib/mcq-service.test.ts` — all tests pass
- [x] `createMcq` persists name, question, `created_by_user_id`, and 2–6 choices with one correct
- [x] `updateMcq` does not change `created_by_user_id`
- [x] `updateMcq` replaces choices atomically
- [x] `createAttempt` records user, choice, and correctness

### Phase 3 — API

- [x] All `src/app/api/mcqs/**/route.test.ts` — all tests pass
- [x] Unauthenticated access to all MCQ endpoints returns 401
- [x] CRUD endpoints return correct status codes (201, 200, 404, 400)

### Phase 4 — UI

- [x] All `src/components/mcq-*.test.tsx` — all tests pass
- [x] **Full suite**: `npm test` passes with zero failures (125 tests)
- [x] `/mcqs` shows table of questions with name, question, and actions menu
- [x] Create button opens `/mcqs/new`; Save creates question and returns to list
- [x] Edit action opens `/mcqs/[id]/edit`; Save updates and returns to list
- [x] Cancel on form returns to `/mcqs` without saving
- [x] Preview action opens `/mcqs/[id]/preview`; submit records attempt
- [x] Delete action confirms then removes question from list
- [x] Form defaults to 2 choices; supports add up to 6 and remove down to 2
- [x] Exactly one correct answer required before Save
- [x] Unauthenticated access to MCQ pages redirects to `/login`

### Manual Verification

- [ ] Create MCQ with 2 choices; appears in list
- [ ] Edit MCQ: add third choice, change correct answer; changes persist
- [ ] Preview: submit correct and incorrect answers; feedback shown; attempts stored in DB
- [ ] Delete MCQ; removed from list; choices and attempts gone

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Unit test pass rate | 100% | `npm test` — all tests passing |
| MCQ create success rate | > 95% of valid submissions | API 201 vs 400 ratio in tests/manual runs |
| List page load | < 1s for &lt; 100 MCQs locally | Preview timing |
| Attempt recording accuracy | 100% | `is_correct` in DB matches selected choice |
| Protected route enforcement | 100% | `/mcqs` and sub-routes redirect when logged out |

---

## Dependencies

### External Dependencies

- **Cloudflare D1** — persistence for mcqs, choices, attempts
- **Wrangler** — migrations and local preview runtime
- **Vitest** + **Testing Library** — TDD workflow (already installed from auth)
- **shadcn/ui** — Table, Button, DropdownMenu, AlertDialog, RadioGroup, etc.
- **lucide-react** — icons (e.g. `MoreVertical` for ellipsis menu)

### Internal Dependencies

- **Auth session** — `src/lib/session.ts`, `src/lib/auth-guard.ts` (all MCQ routes require login)
- **`src/lib/db.ts`** — D1 access via `getDb()`
- **`users` table** — FK target for `mcqs.created_by_user_id` and `mcq_attempts.user_id`
- **Existing shadcn primitives** — Button, Table, Card, Field, Input, Dialog, Badge

### Environment Variables / Secrets

| Name | Purpose |
|------|---------|
| `SESSION_SECRET` | Session validation (unchanged from auth) |
| D1 binding `DB` | Configured in `wrangler.jsonc` |

---

## Risks and Mitigation

### Technical Risks

- **Risk:** Replacing choices on every update could lose attempt FK integrity if choice IDs change
- **Mitigation:** Attempts reference `choice_id`; replacing choices creates new IDs — old attempts may orphan if we kept them. CASCADE on MCQ delete clears attempts; for updates, deleting old choices CASCADE is not on choice FK from attempts. **Mitigation:** Delete attempts when replacing choices on update, or use soft-replace strategy. Document decision in implementation: simplest approach is delete `mcq_attempts` for that `mcq_id` before replacing choices on update.

- **Risk:** Transaction support in D1 batch for createMcq
- **Mitigation:** Use `db.batch()` for insert MCQ + inserts choices; add test that partial failure does not leave orphan MCQ without choices

- **Risk:** DropdownMenu and other shadcn components not yet installed
- **Mitigation:** Add components in Phase 4 before UI tests; follow existing `components/ui` patterns

### User Experience Risks

- **Risk:** Teachers accidentally delete questions
- **Mitigation:** AlertDialog with explicit confirm copy ("Delete this question permanently?")

- **Risk:** Confusion when fewer than two choices or no correct answer selected
- **Mitigation:** Inline validation on Save; disable Save until form valid (optional)

---

## Troubleshooting Guide

_(Populate during implementation.)_

### MCQ API returns 401

**Problem:** All MCQ endpoints return 401

**Cause:** Session cookie missing or expired

**Solution:** Log in again; verify `requireAuthenticatedUserId` reads same cookie as auth routes

### Choices not saving

**Problem:** MCQ created but choices empty on reload

**Cause:** Batch insert failure or validation skipped

**Solution:** Check `mcq-service` tests; verify `db.batch()` completes; inspect D1 locally

### Delete does not remove row from table

**Problem:** UI still shows deleted MCQ

**Cause:** Client cache or list not refetched after DELETE

**Solution:** Call `router.refresh()` or refetch `GET /api/mcqs` after successful delete

---

## Notes for AI Agents

When working with this PRD:

1. Read **Overview** and **Hypothesis** first — this replaces the auth stub with real MCQ functionality
2. Use **Scope (In/Out/Cut)** — do not build ownership, analytics, or pagination unless scope changes
3. Follow **Red → Green → Refactor** per phase; do not skip tests
4. Mirror patterns from `user-service.ts` and auth API routes
5. Update phase status markers and **Current Status** as work progresses
6. Mark acceptance criteria when verified
7. Add troubleshooting entries when bugs are found and fixed
8. Never import `mcq-service.ts` into client components

---

## Current Status

**Last Updated:** September 10, 2026  
**Current Phase:** Phase 4 — UI (List, Form, Preview)  
**Status:** COMPLETED (pending manual E2E verification)  
**Next Steps:** Manual smoke test via `npm run preview`; commit/push at product owner direction

**Baseline:** 125/125 tests passing. Phase 4 adds 16 UI component tests; `McqsStub` replaced with full MCQ management UI.
