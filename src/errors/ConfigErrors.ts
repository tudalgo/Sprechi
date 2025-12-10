export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConfigError"
  }
}

export class MissingBotTokenError extends ConfigError {
  constructor() {
    super("Could not find BOT_TOKEN in your environment")
    this.name = "MissingBotTokenError"
  }
}
