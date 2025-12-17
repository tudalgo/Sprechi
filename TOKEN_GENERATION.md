# Token Generation

This document explains how to generate verification tokens for users.

## Setup

1. **Configure environment variables** in `.env`:
   ```env
   TOKEN_ENCRYPTION_SECRET=your_secret_key_here
   SERVER_ID=your_discord_server_id_here
   ```

   - `TOKEN_ENCRYPTION_SECRET`: Secret key used for encrypting tokens (keep this secure!)
   - `SERVER_ID`: The Discord server ID for which tokens are generated

2. **Create a CSV file** named `report.csv` in the project root with the following format:
   ```csv
   id_tu,id_moodle
   tu12345,1001
   tu67890,1002
   ```

   The CSV should have:
   - `id_tu`: TU (University) ID of the student
   - `id_moodle`: Moodle ID of the student

## Generate Tokens

Run the token generation script:

```bash
pnpm generate-tokens
```

## Output

The script will:

1. **Create `result.json`**: Contains only the new tokens generated in this run
   ```json
   [
     {
       "moodleId": "1001",
       "token": "encrypted_token_string_here"
     }
   ]
   ```

2. **Create/Update `result.json.bak`**: Backup file containing all previously generated tokens
   - This ensures that running the script again only generates tokens for new students
   - **Do not delete this file** unless you want to regenerate all tokens

## Distribution

After generating tokens, you can:

1. Share the `result.json` file with the appropriate system for distribution
2. The tokens in `result.json` are ready to be sent to students
3. Students can verify by:
   - DMing the bot with their token
   - Using the `/verify` command with their token

## Security Notes

- **Keep `TOKEN_ENCRYPTION_SECRET` secure** - if compromised, all tokens can be decrypted
- **Do not commit** `result.json` or `result.json.bak` to version control (already in `.gitignore`)
- **Distribute tokens securely** - each token should only be given to the corresponding student
- Tokens are tied to the specific Discord server ID and cannot be used on other servers

## Troubleshooting

### "CSV file not found"
Make sure `report.csv` exists in the project root directory.

### "Skipping X moodleIds"
This is normal - it means X tokens have already been generated for these students in previous runs.

### Invalid moodle IDs are skipped
The script automatically filters out any non-numeric Moodle IDs.
