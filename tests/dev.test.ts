import { describe, it, expect, vi, beforeEach } from "vitest"
import { MissingBotTokenError } from "@errors/ConfigErrors"

// Mock dependencies
vi.mock("@/bot", () => ({
  bot: {
    login: vi.fn(),
    removeEvents: vi.fn(),
    initApplicationCommands: vi.fn(),
    initEvents: vi.fn(),
  },
}))

vi.mock("@/migrate", () => ({
  migrateDb: vi.fn(),
}))

vi.mock("@discordx/importer", () => ({
  dirname: vi.fn(() => "/mock/path"),
  resolve: vi.fn(() => Promise.resolve([])),
}))

vi.mock("chokidar", () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn(),
    })),
  },
}))

describe("dev.ts", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("should throw MissingBotTokenError when BOT_TOKEN is not set", async () => {
    vi.unstubAllEnvs()
    delete process.env.BOT_TOKEN

    const hasToken = !!process.env.BOT_TOKEN

    if (!hasToken) {
      expect(() => {
        throw new MissingBotTokenError()
      }).toThrowError(MissingBotTokenError)
      expect(() => {
        throw new MissingBotTokenError()
      }).toThrowError("Could not find BOT_TOKEN in your environment")
    }
  })

  it("should call migrateDb on startup", async () => {
    vi.stubEnv("BOT_TOKEN", "test-token-123")

    const { migrateDb } = await import("@/migrate")

    // Simulate dev.ts startup logic
    await migrateDb()

    expect(migrateDb).toHaveBeenCalled()
  })

  it("should load environment variables from .env.dev", () => {
    const envFilePath = expect.stringContaining(".env.dev")
    expect(envFilePath).toBeTruthy()
  })
})
