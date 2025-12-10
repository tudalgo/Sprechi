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

export class TutorCannotJoinQueueError extends QueueError {
  constructor() {
    super("Tutors with active sessions cannot join queues")
    this.name = "TutorCannotJoinQueueError"
  }
}

export class StudentCannotStartSessionError extends QueueError {
  constructor() {
    super("Students in a queue cannot start a session")
    this.name = "StudentCannotStartSessionError"
  }
}

export class QueueScheduleValidationError extends QueueError {
  constructor(message: string) {
    super(message)
    this.name = "QueueScheduleValidationError"
  }
}

export class InvalidQueueScheduleDayError extends QueueScheduleValidationError {
  constructor(day: string) {
    super(`Invalid day of week: "${day}". Please use full English names (e.g. Monday).`)
    this.name = "InvalidQueueScheduleDayError"
  }
}

export class InvalidTimeFormatError extends QueueScheduleValidationError {
  constructor() {
    super("Invalid time format. Please use HH:mm (24-hour format).")
    this.name = "InvalidTimeFormatError"
  }
}

export class InvalidTimeRangeError extends QueueScheduleValidationError {
  constructor() {
    super("Start time must be before end time.")
    this.name = "InvalidTimeRangeError"
  }
}
