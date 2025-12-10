import { describe, it, expect, vi, beforeEach } from "vitest"
import { run } from "../src/main"
import { bot } from "@/bot"
import { migrateDb } from "@/migrate"
import { MissingBotTokenError } from "@errors/ConfigErrors"

// Mock dependencies
vi.mock("@/bot", () => ({
  bot: {
    login: vi.fn(),
    wait: vi.fn(),
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
    vi.clearAllMocks()
  })

  it("should throw MissingBotTokenError when BOT_TOKEN is not set", async () => {
    vi.unstubAllEnvs()
    delete process.env.BOT_TOKEN

    await expect(run()).rejects.toThrow(MissingBotTokenError)
    expect(bot.login).not.toHaveBeenCalled()
  })

  it("should call migrateDb and bot.login when BOT_TOKEN is set", async () => {
    vi.stubEnv("BOT_TOKEN", "test-token-123")

    await run()

    expect(migrateDb).toHaveBeenCalled()
    expect(bot.login).toHaveBeenCalledWith("test-token-123")
  })
})
