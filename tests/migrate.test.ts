import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { migrateDb } from "@/migrate"
import logger from "@utils/logger"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Client } from "pg"

const { mockClient } = vi.hoisted(() => {
  return {
    mockClient: {
      connect: vi.fn(),
      end: vi.fn(),
    },
  }
})

vi.mock("pg", () => {
  return {
    Client: vi.fn(function () {
      return mockClient
    }),
  }
})

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn(() => ({})),
}))

vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: vi.fn(),
}))

vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe("migrate.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
    vi.spyOn(process, "exit").mockImplementation((() => { }) as any)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("should connect to database and run migrations", async () => {
    vi.mocked(migrate).mockResolvedValue(undefined)
    mockClient.connect.mockResolvedValue(undefined)
    mockClient.end.mockResolvedValue(undefined)

    await migrateDb()

    expect(Client).toHaveBeenCalledWith({
      connectionString: "postgresql://test:test@localhost:5432/test",
    })
    expect(mockClient.connect).toHaveBeenCalled()
    expect(migrate).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith("Database migrated successfully.")
    expect(mockClient.end).toHaveBeenCalled()
  })

  it("should log error and exit on migration failure", async () => {
    const mockError = new Error("Migration failed")
    vi.mocked(migrate).mockRejectedValue(mockError)

    await migrateDb()

    expect(logger.error).toHaveBeenCalledWith("Database migration error:", mockError)
    expect(process.exit).toHaveBeenCalledWith(1)
    expect(mockClient.end).toHaveBeenCalled()
  })

  it("should handle connection failure", async () => {
    const mockError = new Error("Connection failed")
    mockClient.connect.mockRejectedValue(mockError)

    await migrateDb()

    expect(logger.error).toHaveBeenCalledWith("Database migration error:", mockError)
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it("should handle missing DATABASE_URL", async () => {
    vi.unstubAllEnvs()
    delete process.env.DATABASE_URL

    await migrateDb()

    expect(Client).toHaveBeenCalledWith({
      connectionString: undefined,
    })
  })
})
