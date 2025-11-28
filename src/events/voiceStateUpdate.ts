import { ArgsOf, Discord, On } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"
import { AlreadyInQueueError } from "../errors/QueueErrors"

@Discord()
export class VoiceStateUpdate {
    private queueManager = new QueueManager()

    @On()
    async voiceStateUpdate([oldState, newState]: ArgsOf<"voiceStateUpdate">): Promise<void> {
        // User joined a channel
        if (!oldState.channelId && newState.channelId && newState.guild) {
            const channelId = newState.channelId
            const guildId = newState.guild.id
            const userId = newState.member?.id

            if (!userId) return

            try {
                const queue = await this.queueManager.getQueueByWaitingRoom(guildId, channelId)
                if (queue) {
                    await this.queueManager.joinQueue(guildId, queue.name, userId)
                    // We don't need to send a reply here as joinQueue logs to the channel
                }
            } catch (error: any) {
                // If they are already in the queue, we can ignore it or log it
                if (!(error instanceof AlreadyInQueueError)) {
                    logger.error(`Failed to auto - join queue for user ${userId}: `, error)
                }
            }
        }
    }
}
