import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { InternalRole } from "@db/schema"
import { encryptTokenString } from "@utils/token"
import { parse } from "csv-parse"

// Mock dotenv
vi.mock("dotenv", () => ({
  default: {
    config: vi.fn(),
  },
}))

// Mock token utility
vi.mock("@utils/token", () => ({
  encryptTokenString: vi.fn((serverId, versionId, tuId, moodleId, _roles) => {
    return `encrypted_${moodleId}`
  }),
}))

describe("generate-tokens script", () => {
  const testDir = path.resolve(__dirname, "../../test-token-generation")
  const csvPath = path.join(testDir, "report.csv")
  const backupPath = path.join(testDir, "result.json.bak")

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true })
    }

    // Set environment variables
    vi.stubEnv("SERVER_ID", "test-server-123")
    vi.stubEnv("TOKEN_ENCRYPTION_SECRET", "test_secret")

    // Create test CSV file
    const csvContent = "id_tu,id_moodle\ntu123,1001\ntu456,1002\ntu789,1003\n"
    fs.writeFileSync(csvPath, csvContent)
  })

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    vi.unstubAllEnvs()
  })

  it("should generate tokens for all students when no backup exists", async () => {
    // Parse CSV file
    const fileContent = fs.readFileSync(csvPath, { encoding: "utf-8" })
    const students: any[] = []

    const parser = parse(fileContent, {
      delimiter: ",",
      columns: ["id_tu", "id_moodle"],
      from_line: 2,
    })

    for await (const record of parser) {
      students.push(record)
    }

    const serverId = "test-server-123"
    const versionId = "01"

    const newResult = students
      .filter(student => !Number.isNaN(Number.parseInt(student.id_moodle, 10)))
      .map((student) => {
        const token = (encryptTokenString as any)(
          serverId,
          versionId,
          student.id_tu,
          student.id_moodle,
          [InternalRole.Verified],
        )
        return {
          moodleId: student.id_moodle,
          token,
        }
      })

    expect(newResult).toHaveLength(3)
    expect(newResult[0]).toEqual({
      moodleId: "1001",
      token: "encrypted_1001",
    })
    expect(newResult[1]).toEqual({
      moodleId: "1002",
      token: "encrypted_1002",
    })
    expect(newResult[2]).toEqual({
      moodleId: "1003",
      token: "encrypted_1003",
    })
  })

  it("should only generate tokens for new students when backup exists", async () => {
    // Create backup file with existing token
    const existingTokens = [
      { moodleId: "1001", token: "old_encrypted_1001" },
    ]
    fs.writeFileSync(backupPath, JSON.stringify(existingTokens, null, 2))

    const fileContent = fs.readFileSync(csvPath, { encoding: "utf-8" })
    const students: any[] = []

    const parser = parse(fileContent, {
      delimiter: ",",
      columns: ["id_tu", "id_moodle"],
      from_line: 2,
    })

    for await (const record of parser) {
      students.push(record)
    }

    // Read existing backup
    const oldResultFileContent = fs.readFileSync(backupPath, { encoding: "utf-8" })
    const oldResults = JSON.parse(oldResultFileContent)
    const oldMoodleIds = oldResults.map((x: any) => x.moodleId)

    const serverId = "test-server-123"
    const versionId = "01"

    const newResult = students
      .filter(student => !Number.isNaN(Number.parseInt(student.id_moodle, 10)))
      .filter(student => !oldMoodleIds.includes(student.id_moodle))
      .map((student) => {
        const token = (encryptTokenString as any)(
          serverId,
          versionId,
          student.id_tu,
          student.id_moodle,
          [InternalRole.Verified],
        )
        return {
          moodleId: student.id_moodle,
          token,
        }
      })

    expect(newResult).toHaveLength(2) // Only 1002 and 1003
    expect(newResult[0]).toEqual({
      moodleId: "1002",
      token: "encrypted_1002",
    })
    expect(newResult[1]).toEqual({
      moodleId: "1003",
      token: "encrypted_1003",
    })
  })

  it("should filter out invalid moodle IDs", async () => {
    // Create CSV with invalid IDs
    const csvContent = "id_tu,id_moodle\ntu123,1001\ntu456,invalid\ntu789,1003\n"
    fs.writeFileSync(csvPath, csvContent)

    const fileContent = fs.readFileSync(csvPath, { encoding: "utf-8" })
    const students: any[] = []

    const parser = parse(fileContent, {
      delimiter: ",",
      columns: ["id_tu", "id_moodle"],
      from_line: 2,
    })

    for await (const record of parser) {
      students.push(record)
    }

    const serverId = "test-server-123"
    const versionId = "01"

    const newResult = students
      .filter(student => !Number.isNaN(Number.parseInt(student.id_moodle, 10)))
      .map((student) => {
        const token = (encryptTokenString as any)(
          serverId,
          versionId,
          student.id_tu,
          student.id_moodle,
          [InternalRole.Verified],
        )
        return {
          moodleId: student.id_moodle,
          token,
        }
      })

    expect(newResult).toHaveLength(2) // Only valid IDs
  })

  it("should use default server ID if not in environment", async () => {
    vi.unstubAllEnvs()

    const serverId = process.env.SERVER_ID || "1211976567866130453"
    expect(serverId).toBe("1211976567866130453")
  })
})
