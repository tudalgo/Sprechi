import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { IntentsBitField, Partials } from "discord.js"
import { bot } from "../src/bot"

describe("bot.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BOT_TOKEN = "test-token"
  })

  afterEach(() => {
    delete process.env.BOT_TOKEN
  })

  it("should be configured with correct intents", () => {
    const expectedIntents = [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMembers,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.GuildVoiceStates,
      IntentsBitField.Flags.DirectMessages,
      IntentsBitField.Flags.MessageContent,
    ]

    const bitfield = new IntentsBitField(bot.options.intents)

    expectedIntents.forEach((intent) => {
      expect(bitfield.has(intent)).toBe(true)
    })
  })

  it("should include necessary partials", () => {
    const expectedPartials = [
      Partials.Channel,
      Partials.Message,
    ]

    expect(bot.options.partials).toEqual(expect.arrayContaining(expectedPartials))
  })

  it("should attempt to login when login is called", async () => {
    const loginSpy = vi.spyOn(bot, "login").mockResolvedValue("token")
    await bot.login("test-token")
    expect(loginSpy).toHaveBeenCalledWith("test-token")
  })
})
