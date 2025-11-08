import { Discord, On, type ArgsOf } from "discordx"
import logger from "@utils/logger"

@Discord()
export class Example {
  @On()
  messageCreate([message]: ArgsOf<"messageCreate">): void {
    logger.info(message.author.username, "said:", message.content)
  }
}
