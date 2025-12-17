# Sprechi-v2

<p align="center">
  <a href="https://github.com/tudalgo/Sprechi/actions/workflows/test.yml">
    <img src="https://github.com/tudalgo/Sprechi/actions/workflows/test.yml/badge.svg" alt="Test" />
  </a>
  <a href="https://github.com/tudalgo/Sprechi/actions/workflows/lint.yml">
    <img src="https://github.com/tudalgo/Sprechi/actions/workflows/lint.yml/badge.svg" alt="Lint" />
  </a>
  <a href="https://github.com/tudalgo/Sprechi/actions/workflows/build-container.yml">
    <img src="https://github.com/tudalgo/Sprechi/actions/workflows/build-container.yml/badge.svg" alt="Build Container" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-AGPL--3.0--only-blue" alt="License" />
  </a>
</p>

A Discord bot for managing and scheduling tutoring sessions. Sprechi handles student verification, session scheduling, queue management, and ephemeral voice channel creation for tutoring sessions.

## Features

- **Student Verification**: Token-based verification system for authenticating students
- **Queue Management**: Automated queue system for students waiting for help
- **Session Scheduling**: Schedule and manage tutoring sessions with auto-lock functionality
- **Voice Rooms**: Dynamic voice channel creation for tutor-student interactions
- **Statistics**: Comprehensive server and session statistics
- **DM Support**: Students can verify and receive notifications via direct messages

## Prerequisites

- Node.js >= 24.0.0
- pnpm >= 10.24.0
- PostgreSQL database
- Discord Bot Token

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tudalgo/Sprechi.git
   cd Sprechi
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Discord
   DISCORD_TOKEN=your_discord_bot_token
   
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/sprechi
   
   # Encryption (for token generation)
   ENCRYPTION_KEY=your_secret_encryption_key
   
   # Environment
   NODE_ENV=development
   ```

4. **Initialize the database**
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. **Generate verification tokens** (if needed)
   ```bash
   pnpm generate-tokens
   ```

## Development

Start the development server with hot reload:

```bash
pnpm dev
```

This runs the bot with debug logging enabled and automatic restart on file changes.

### Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Compile TypeScript to JavaScript
- `pnpm start` - Run the production build
- `pnpm preview` - Run production build with dev environment variables
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint errors automatically
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm test` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm db:generate` - Generate database migration files
- `pnpm db:migrate` - Apply database migrations

## Testing

The project uses Vitest for testing with comprehensive coverage requirements.

```bash
# Run tests in watch mode
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests with coverage UI
pnpm test:coverage:ui
```

Test files follow the same structure as source files, mirroring the `src/` directory in `tests/`.

## Docker

Build and run the bot using Docker:

```bash
# Build the image
docker build -t sprechi-v2 .

# Run the container
docker run -d \
  --name sprechi \
  -e DISCORD_TOKEN=your_token \
  -e DATABASE_URL=your_db_url \
  sprechi-v2
```

Or use Docker Compose:

```bash
docker-compose up -d
```

## Project Structure

```
sprechi-v2/
├── src/
│   ├── commands/        # Discord slash commands
│   │   ├── admin/       # Admin-only commands
│   │   ├── queue/       # Student queue commands
│   │   ├── tutor/       # Tutor commands
│   │   └── verify.ts    # Verification command
│   ├── managers/        # Business logic layer
│   │   ├── QueueManager.ts
│   │   ├── RoomManager.ts
│   │   ├── SessionManager.ts
│   │   ├── UserManager.ts
│   │   └── ...
│   ├── events/          # Discord event handlers
│   ├── db/              # Database schema and configuration
│   ├── utils/           # Utility functions
│   └── main.ts          # Application entry point
├── tests/               # Test files (mirrors src structure)
├── .github/workflows/   # CI/CD workflows
└── drizzle/            # Database migrations
```

### Architecture Principles

- **Commands**: Handle Discord interactions and delegate to Managers
- **Managers**: Contain all business logic and database operations
- **Dependency Injection**: Managers are injected into Commands/Events via constructors
- **Type Safety**: Strict TypeScript with Drizzle ORM for type-safe database queries

## Contributing

1. Follow the existing code style and conventions
2. Run `pnpm lint:fix` before committing
3. Add tests for new features
4. Update documentation as needed
5. Keep business logic in Managers, not Commands

### Code Quality Standards

- **Type Safety**: Avoid `any`, use explicit types or `unknown` with type guards
- **Error Handling**: Use custom error classes from the `errors/` directory
- **Testing**: All new code must include corresponding tests
- **Logging**: Use the logger utility (`src/utils/logger.ts`)

## License

This project is licensed under the AGPL-3.0-only License - see the [LICENSE](LICENSE) file for details.

## Technology Stack

- **Framework**: [DiscordX](https://discordx.js.org/) (Discord.js wrapper with decorators)
- **Database**: [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL
- **Runtime**: Node.js with TypeScript
- **Package Manager**: pnpm
- **Testing**: Vitest
- **Container**: Docker with multi-stage builds

## Additional Resources

- [DiscordX Documentation](https://discordx.js.org)
- [Discord.js Guide](https://discordjs.guide/)
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)

---

For detailed architecture information and development guidelines, see [agents.md](agents.md).
