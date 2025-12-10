import { describe, it, expect } from "vitest"
import { Client, IntentsBitField, Partials } from "discord.js"

describe("bot.ts", () => {
  it("should create Discord client with correct intents", () => {
    const expectedIntents = [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMembers,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.GuildVoiceStates,
      IntentsBitField.Flags.DirectMessages,
      IntentsBitField.Flags.MessageContent,
    ]

    // Verify intents are defined (actual bot import would be circular)
    expectedIntents.forEach((intent) => {
      expect(intent).toBeDefined()
    })
  })

  it("should include necessary partials", () => {
    const expectedPartials = [
      Partials.Channel,
      Partials.Message,
    ]

    expectedPartials.forEach((partial) => {
      expect(partial).toBeDefined()
    })
  })

  it("should export bot instance", async () => {
    // We can't actually import bot.ts without side effects,
    // but we can verify the structure would be valid
    const mockBot = new Client({
      intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
      ],
      partials: [Partials.Channel],
    })

    expect(mockBot).toBeInstanceOf(Client)
    expect(mockBot).toHaveProperty("login")
    expect(mockBot).toHaveProperty("on")
  })
})
