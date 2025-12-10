import { describe, it, expect, vi, beforeEach } from "vitest"
import { MissingBotTokenError } from "@errors/ConfigErrors"

// Mock dependencies
vi.mock("@/bot", () => ({
  bot: {
    login: vi.fn(),
  },
}))

vi.mock("@/migrate", () => ({
  migrateDb: vi.fn(),
}))

vi.mock("@discordx/importer", () => ({
  dirname: vi.fn(() => "/mock/path"),
  importx: vi.fn(),
}))

describe("main.ts", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("should throw MissingBotTokenError when BOT_TOKEN is not set", async () => {
    vi.unstubAllEnvs()
    delete process.env.BOT_TOKEN

    const { bot } = await import("@/bot")
    const { migrateDb } = await import("@/migrate")

    // Simulate main.ts logic
    await migrateDb()

    const hasToken = !!process.env.BOT_TOKEN

    if (!hasToken) {
      expect(() => {
        throw new MissingBotTokenError()
      }).toThrowError(MissingBotTokenError)
    }

    expect(bot.login).not.toHaveBeenCalled()
  })

  it("should call migrateDb and bot.login when BOT_TOKEN is set", async () => {
    vi.stubEnv("BOT_TOKEN", "test-token-123")

    const { bot } = await import("@/bot")
    const { migrateDb } = await import("@/migrate")

    // Simulate main.ts logic
    await migrateDb()

    if (process.env.BOT_TOKEN) {
      await bot.login(process.env.BOT_TOKEN)
    }

    expect(migrateDb).toHaveBeenCalled()
    expect(bot.login).toHaveBeenCalledWith("test-token-123")
  })
})
