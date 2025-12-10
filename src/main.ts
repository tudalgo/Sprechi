import "reflect-metadata"
import { dirname, importx } from "@discordx/importer"
import { bot } from "@/bot"
import { migrateDb } from "@/migrate"
import { container } from "tsyringe"
import { DIService, tsyringeDependencyRegistryEngine } from "discordx"
import { MissingBotTokenError } from "@errors/ConfigErrors"

// Enable DI
DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container)

async function run() {
  await migrateDb()
  // The following syntax should be used in the commonjs environment
  //
  // await importx(__dirname + "/{events,commands}/**/*.{ts,js}");

  // The following syntax should be used in the ECMAScript environment
  await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`)

  // Let's start the bot
  if (!process.env.BOT_TOKEN) {
    throw new MissingBotTokenError()
  }

  // Log in with your bot token
  await bot.login(process.env.BOT_TOKEN)
}

void run()
