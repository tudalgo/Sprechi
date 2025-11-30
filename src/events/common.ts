import { Discord, On, type ArgsOf } from "discordx"
import logger from "@utils/logger"

@Discord()
export class Example {
  @On()
  messageCreate([message]: ArgsOf<"messageCreate">): void {
    logger.info(`Message from ${message.author.tag} (${message.author.id}): ${message.content}`)
  }
}
