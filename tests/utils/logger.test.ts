import { describe, it, expect } from "vitest"
import logger from "@utils/logger"

describe("Logger Utility", () => {
  it("should create a tagged consola instance", () => {
    expect(logger).toBeDefined()
    expect(logger).toHaveProperty("info")
    expect(logger).toHaveProperty("warn")
    expect(logger).toHaveProperty("error")
    expect(logger).toHaveProperty("success")
    expect(logger).toHaveProperty("debug")
  })

  it("should have all standard logging methods", () => {
    const methods = ["info", "warn", "error", "success", "debug", "log"]
    methods.forEach((method) => {
      expect(typeof logger[method as keyof typeof logger]).toBe("function")
    })
  })

  it("should not throw when calling logging methods", () => {
    expect(() => logger.info("test message")).not.toThrow()
    expect(() => logger.warn("test warning")).not.toThrow()
    expect(() => logger.error("test error")).not.toThrow()
  })

  it("should support tag scoping with withTag", () => {
    const taggedLogger = logger.withTag("CustomTag")

    expect(taggedLogger).toBeDefined()
    expect(taggedLogger).toHaveProperty("info")
    expect(taggedLogger).toHaveProperty("warn")
    expect(taggedLogger).toHaveProperty("error")

    // Should not throw when calling methods on tagged logger
    expect(() => taggedLogger.info("tagged message")).not.toThrow()
  })
})
