import { Client, EmbedBuilder, Colors } from "discord.js"
import logger from "@utils/logger"

export class DmManager {
    async sendDm(client: Client, userId: string, content: string | EmbedBuilder) {
        try {
            const user = await client.users.fetch(userId)
            if (content instanceof EmbedBuilder) {
                await user.send({ embeds: [content] })
            } else {
                await user.send(content)
            }
            return true
        } catch (error) {
            logger.error(`Failed to send DM to user ${userId}:`, error)
            return false
        }
    }
}
