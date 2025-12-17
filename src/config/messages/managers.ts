/**
 * Manager messages
 */

// =============================================================================
// MANAGERS
// =============================================================================

export const managers = {
  queue: {
    logs: {
      userRejoined: (userId: string) => `User <@${userId}> rejoined the queue (restored position).`,
      userJoined: (userId: string) => `User <@${userId}> joined the queue.`,
      userLeftGracePeriod: (userId: string) => `User <@${userId}> left the queue (grace period started).`,
      userLeft: (userId: string) => `User <@${userId}> left the queue.`,
      userPicked: (userId: string, tutorId: string) => `User <@${userId}> was picked by <@${tutorId}>.`,
      tutorStarted: (tutorId: string) => `Tutor <@${tutorId}> started a session.`,
      tutorEnded: (tutorId: string) => `Tutor <@${tutorId}> ended their session.`,
      sessionTerminatedAdmin: (tutorId: string) => `Session for <@${tutorId}> was forcefully terminated by admin.`,
      sessionTerminatedAll: (tutorId: string) =>
        `Session for <@${tutorId}> was forcefully terminated by admin (Terminate All).`,
      queueLockState: (queueName: string, lockState: string) => `Queue **${queueName}** is now **${lockState}**.`,
    },
    dms: {
      joinedQueue: {
        title: (queueName: string) => `Joined Queue: ${queueName}`,
        description: (queueName: string, position: number, joinedAtSeconds: number) =>
          `You have joined the queue **${queueName}**.\n\n**Position:** ${position}\n**Joined:** <t:${joinedAtSeconds}:R>`,
        buttons: {
          refreshStatus: "Refresh Status",
          leaveQueue: "Leave Queue",
        },
      },
      leftQueue: {
        title: "Left Queue",
        description: (queueName: string) =>
          `You have left the queue **${queueName}**.\n\nYou have **1 minute** to rejoin without losing your spot.`,
        button: "Rejoin Queue",
      },
      picked: {
        title: "You have been picked!",
        description: (tutorId: string, channelId: string) =>
          `You have been picked by <@${tutorId}> for a tutoring session.\nPlease join the voice channel: <#${channelId}>`,
      },
    },
    disconnectReason: "Left the queue",
    studentPicked: {
      title: "Student Picked",
      description: (studentId: string, channelId: string) => `Picked <@${studentId}>. Created room <#${channelId}>.`,
    },
    embeds: {
      queueLog: {
        title: (queueName: string) => `Queue Update: ${queueName}`,
        fields: {
          membersInQueue: "Members in Queue",
          activeSessions: "Active Sessions",
        },
      },
      publicLog: {
        title: (queueName: string) => `Sprechstundensystem: ${queueName}`,
      },
      queueSummary: {
        title: (queueName: string) => `Queue Summary: ${queueName}`,
        descriptionFallback: "No description.",
        fields: {
          studentsInQueue: "Students in Queue",
          activeSessions: "Active Sessions",
          locked: "Locked",
        },
        footer: (queueId: string) => `Queue ID: ${queueId}`,
      },
      queueList: {
        title: (queueName: string) => `Queue: ${queueName}`,
        emptyDescription: "The queue is empty.",
        emptyFooter: "Total: 0",
        description: (
          members: Array<{ userId: string }>,
          formatMember: (m: { userId: string }, i: number) => string,
        ) => members.map(formatMember).join("\n"),
        footer: (count: number) => `Showing top ${count} members`,
      },
    },
    errors: {
      noQueues: "No queues found in this server.",
      multipleQueues: "Multiple queues found. Please specify a queue name.",
      alreadyLocked: (queueName: string, isLocked: boolean) =>
        `Queue "${queueName}" is already ${isLocked ? "locked" : "unlocked"}.`,
      roomCreationFailed: "Failed to create session room.",
    },
  },
}
