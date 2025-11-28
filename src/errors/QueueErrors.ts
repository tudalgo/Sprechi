export class QueueError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "QueueError"
    }
}

export class QueueNotFoundError extends QueueError {
    constructor(queueName: string) {
        super(`Queue "${queueName}" not found`)
        this.name = "QueueNotFoundError"
    }
}

export class QueueLockedError extends QueueError {
    constructor(queueName: string) {
        super(`Queue "${queueName}" is locked`)
        this.name = "QueueLockedError"
    }
}

export class AlreadyInQueueError extends QueueError {
    constructor(queueName: string) {
        super(`Already in queue "${queueName}"`)
        this.name = "AlreadyInQueueError"
    }
}

export class NotInQueueError extends QueueError {
    constructor(queueName: string) {
        super(`Not in queue "${queueName}"`)
        this.name = "NotInQueueError"
    }
}

export class SessionAlreadyActiveError extends QueueError {
    constructor() {
        super("You already have an active session")
        this.name = "SessionAlreadyActiveError"
    }
}
