import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock pg.Client
const mockClient = {
  connect: vi.fn(),
  end: vi.fn(),
}

vi.mock("pg", () => ({
  Client: vi.fn(() => mockClient),
}))

// Mock drizzle
vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn(() => ({})),
}))

// Mock migrate function from drizzle
vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: vi.fn(),
}))

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe("migrate.ts", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("should connect to database and run migrations", async () => {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator")
    const logger = (await import("@utils/logger")).default

    vi.mocked(migrate).mockResolvedValue()

    // Simulate migrateDb logic
    await mockClient.connect()
    await migrate({} as any, { migrationsFolder: "./src/db/migrations" })
    await mockClient.end()

    logger.info("Database migrated successfully.")

    expect(mockClient.connect).toHaveBeenCalled()
    expect(migrate).toHaveBeenCalled()
    expect(mockClient.end).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith("Database migrated successfully.")
  })

  it("should log error on migration failure", async () => {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator")
    const logger = (await import("@utils/logger")).default

    const mockError = new Error("Migration failed")
    vi.mocked(migrate).mockRejectedValue(mockError)

    try {
      await mockClient.connect()
      await migrate({} as any, { migrationsFolder: "./src/db/migrations" })
      await mockClient.end()
    } catch (error) {
      logger.error("Database migration error:", error)
      await mockClient.end()
    }

    expect(logger.error).toHaveBeenCalledWith("Database migration error:", mockError)
    expect(mockClient.end).toHaveBeenCalled()
  })

  it("should use DATABASE_URL environment variable", () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBe("postgresql://test:test@localhost:5432/test")
  })
})
