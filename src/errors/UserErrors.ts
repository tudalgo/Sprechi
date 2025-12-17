export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UserError"
  }
}

export class InvalidTokenError extends UserError {
  constructor() {
    super("Invalid token provided")
    this.name = "InvalidTokenError"
  }
}

export class TokenAlreadyUsedError extends UserError {
  constructor() {
    super("This token has already been used by another user")
    this.name = "TokenAlreadyUsedError"
  }
}

export class WrongServerError extends UserError {
  constructor(expectedServerId: string) {
    super(`This token is for a different server (ID: ${expectedServerId})`)
    this.name = "WrongServerError"
  }
}

export class UserNotInGuildError extends UserError {
  constructor() {
    super("User is not a member of this guild")
    this.name = "UserNotInGuildError"
  }
}

export class UserNotVerifiedError extends UserError {
  constructor() {
    super("User is not verified on this server")
    this.name = "UserNotVerifiedError"
  }
}
