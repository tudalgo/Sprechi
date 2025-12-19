/**
 * Manager messages
 */

// =============================================================================
// MANAGERS
// =============================================================================

export const managers = {
  queue: {
    logs: {
      userRejoined: (username: string, userId: string) => `User **${username}** (<@${userId}>) rejoined the queue (restored position).`,
      userJoined: (username: string, userId: string) => `User **${username}** (<@${userId}>) joined the queue.`,
      userLeftGracePeriod: (username: string, userId: string) => `User **${username}** (<@${userId}>) left the queue (grace period started).`,
      userLeft: (username: string, userId: string) => `User **${username}** (<@${userId}>) left the queue.`,
      userPicked: (studentUsername: string, studentId: string, tutorUsername: string, tutorId: string) => `User **${studentUsername}** (<@${studentId}>) was picked by **${tutorUsername}** (<@${tutorId}>).`,
      tutorStarted: (tutorUsername: string, tutorId: string) => `Tutor **${tutorUsername}** (<@${tutorId}>) started a session.`,
      tutorEnded: (tutorUsername: string, tutorId: string) => `Tutor **${tutorUsername}** (<@${tutorId}>) ended their session.`,
      sessionTerminatedAdmin: (tutorUsername: string, tutorId: string) => `Session for **${tutorUsername}** (<@${tutorId}>) was forcefully terminated by admin.`,
      sessionTerminatedAll: (tutorUsername: string, tutorId: string) =>
        `Session for **${tutorUsername}** (<@${tutorId}>) was forcefully terminated by admin (Terminate All).`,
      queueLockStatePublic: (queueName: string, lockState: string) => `Die **${queueName}**-Warteschlange ist jetzt **${lockState === "locked" ? "gesperrt" : "entsperrt"}**. Eine Übersicht der Sprechstundenzeiten befindet sich in den Pins.\n---\nThe **${queueName}**-queue is now **${lockState}**. A list of available tutoring times can be found in the pinned messages.`,
      queueLockStatePrivate: (queueName: string, lockState: string) => `Queue **${queueName}** is now **${lockState}**.`,
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
