import { describe, it, expect, vi, beforeEach } from "vitest"
import { run } from "../src/apply-migration"
import { migrateDb } from "@/migrate"
import logger from "@utils/logger"

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
    vi.clearAllMocks()
    vi.spyOn(process, "exit").mockImplementation((() => { }) as any)
  })

  it("should call migrateDb and exit with code 0 on success", async () => {
    vi.mocked(migrateDb).mockResolvedValue()

    await run()

    expect(migrateDb).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith("Migration complete")
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it("should log error and exit with code 1 on failure", async () => {
    const mockError = new Error("Migration failed")
    vi.mocked(migrateDb).mockRejectedValue(mockError)

    await run()

    expect(migrateDb).toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith("Migration failed", mockError)
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
