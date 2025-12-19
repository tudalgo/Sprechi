/**
 * Queue command messages
 */

import { managers } from "./managers"

export const queueCommands = {
  join: {
    description: "Join a queue",
    optionName: "The name of the queue to join",
    success: {
      title: "Joined Queue",
      description: (queueName: string) => `You have joined the queue **${queueName}**.`,
    },
    errors: {
      default: "Failed to join queue.",
      notFound: (name: string) => `Queue **${name}** not found.`,
      locked: (name: string) => `Queue **${name}** is locked.`,
      alreadyInQueue: (name: string) => `You are already in queue **${name}**.`,
      tutorSessionConflict: "You cannot join a queue while you have an active tutor session.",
      title: "Error",
    },
  },
  leave: {
    description: "Leave a queue",
    optionName: "The name of the queue to leave",
    success: {
      title: managers.queue.dms.leftQueue.title,
      description: managers.queue.dms.leftQueue.description,
    },
    errors: {
      default: "Failed to leave queue.",
      notFound: (name: string) => `Queue **${name}** not found.`,
      notInQueue: (name: string | null) => `You are not in queue **${name ?? "any queue"}**.`,
      title: "Error",
    },
  },
  list: {
    groupDescription: "Queue commands",
    description: "List all available queues",
    emptyState: {
      title: "No Queues Found",
      description: "There are no queues in this server.",
    },
    listTitle: "Available Queues",
    queueEntry: (name: string, isLocked: boolean, description: string, memberCount: number) =>
      `**${name}** ${isLocked ? "🔒" : ""}\n${description}\nMembers: ${memberCount}`,
  },
  summary: {
    groupDescription: "Manage queues",
    description: "Show summary of your current queue",
    notInQueue: {
      title: "Not in Queue",
      description: "You are not currently in any queue.",
    },
    summaryTitle: (queueName: string) => `Queue Summary: ${queueName}`,
    fields: {
      totalEntries: "Total Entries",
      yourPosition: "Your Position",
      joined: "Joined",
    },
    errors: {
      default: "An error occurred.",
      title: "Error",
    },
  },
  help: {
    description: "Get help with queue commands",
    optionQueue: "The name of the queue to get waiting room info for (optional)",
    embed: {
      title: "📚 Queue Help - Student Commands",
      description: "Here are the available commands for managing your queue membership:",
      fields: {
        join: {
          name: "📝 Join a Queue",
          value:
            "`/queue join [name]`\nJoin a queue. If no name is provided, you'll join the default queue.",
        },
        leave: {
          name: "🚪 Leave a Queue",
          value: "`/queue leave`\nLeave the queue you're currently in.",
        },
        list: {
          name: "📋 List Queues",
          value: "`/queue list`\nView all available queues and their current status.",
        },
        summary: {
          name: "📊 Queue Summary",
          value:
            "`/queue summary [name]`\nView detailed information about a specific queue, including members and wait times.",
        },
        waitingRoom: (queueName: string, waitingRoomId: string) => ({
          name: "🎤 Waiting Room",
          value: `You can also join the queue **${queueName}** by joining the waiting room voice channel: <#${waitingRoomId}>`,
        }),
      },
    },
    errors: {
      title: "Error",
      description: "Failed to display help information.",
    },
  },
}
