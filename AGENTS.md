# Sprechi AI Agent Guide

## Project Overview

Sprechi-v2 is a Discord bot for managing and scheduling tutoring sessions (verification, scheduling, queueing, voice channels).
* **Core Execution**: `src/main.ts`
* **Database**: Schema and config in `src/db/index.ts`
* **Key Services**: User verification, session scheduling, student queue management, ephemeral voice room creation.

---

## Technology Stack

* **Framework**: DiscordX (Discord.js wrapper)
* **Database**: Drizzle ORM (type-safe queries, schema in `src/db/schema.ts`)
* **Runtime**: Node.js with TypeScript
* **Package Manager**: pnpm
* **Testing**: Vitest

---

## Project Architecture Rules

The primary distinction is between **Commands** (Discord interaction) and **Managers** (Business Logic).

### Commands (`src/commands/`)

* **Role**: Parse user input (options, buttons) and delegate all work to Managers.
* **Structure**: One command per file, grouped by category (`admin/`, `tutor/`, `queue/`, `verify.ts`).
* **Convention**: Most responses should be ephemeral (visible only to the user).

### Managers (`src/managers/`)

* **Role**: Contain all shared business logic, database operations, and utility functions.
* **Key Managers**: `QueueManager`, `RoomManager`, `SessionManager`, `UserManager`, `DmManager`, `GuildManager`.
* **Convention**: Managers are injected into Commands/Events via constructors (**Dependency Injection**).

### Data & Events

* **Schema**: `src/db/schema.ts` defines all database tables using Drizzle ORM.
* **Events**: Handlers in `src/events/` for Discord events (`ready.ts`, `voiceStateUpdate.ts`, `messageCreate.ts`, `QueueButtons.ts`, etc.).
* **Utilities**: Standard helpers (`logger.ts`, `encryption.ts`, `constants.ts`).

---

## Agent Development Priority List

1.  **Code Quality**: **MUST** run `pnpm run lint:fix` and fix all remaining errors before completing work.
2.  **Logic Location**: **NEVER** put business logic or database queries directly into a command file. Use or create a Manager.
3.  **Testing**: New source files **MUST** have a corresponding test file in `tests/` that mirrors the structure of `src/`.
4.  **Type Safety**: Avoid `any`; use explicit types or `unknown` with type guards.
5.  **Error Handling**: Use custom error classes defined in errors folder (e.g., `QueueNotFoundError`, `TutorCannotJoinQueueError`).
6.  **Logging**: Use the logger utility (`src/utils/logger.ts`) with appropriate log levels.
7.  **Naming**: Classes use PascalCase, functions/variables use camelCase, commands use kebab-case.

---

*Last updated: 2025-12-10*
