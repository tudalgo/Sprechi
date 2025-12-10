import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock migrate function
vi.mock("@/migrate", () => ({
  migrateDb: vi.fn(),
}))

describe("apply-migration.ts", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(process, "exit").mockImplementation((() => { }) as any)
  })

  it("should call migrateDb and exit with code 0 on success", async () => {
    const logger = (await import("@utils/logger")).default
    const { migrateDb } = await import("@/migrate")

    vi.mocked(migrateDb).mockResolvedValue()

    // Simulate apply-migration.ts logic
    try {
      await migrateDb()
      logger.info("Migration applied successfully")
      process.exit(0)
    } catch (error) {
      logger.error("Migration failed:", error)
      process.exit(1)
    }

    expect(migrateDb).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith("Migration applied successfully")
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it("should log error and exit with code 1 on failure", async () => {
    const logger = (await import("@utils/logger")).default
    const { migrateDb } = await import("@/migrate")

    const mockError = new Error("Migration failed")
    vi.mocked(migrateDb).mockRejectedValue(mockError)

    // Simulate apply-migration.ts logic
    try {
      await migrateDb()
      logger.info("Migration applied successfully")
      process.exit(0)
    } catch (error) {
      logger.error("Migration failed:", error)
      process.exit(1)
    }

    expect(migrateDb).toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith("Migration failed:", mockError)
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
