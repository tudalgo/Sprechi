import { defineConfig } from "eslint/config"
import stylistic from "@stylistic/eslint-plugin"
import js from "@eslint/js"
import tseslint from "typescript-eslint"
import globals from "globals"

export default defineConfig([
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      js,
      tseslint,
      stylistic,
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      stylistic.configs.recommended,
    ],
    rules: {
      "no-unused-vars": "off",
      "no-undef": "warn",
      "@stylistic/indent": ["error", 2],
      "@stylistic/quotes": ["error", "double"],
      "@stylistic/semi": ["error", "never"],
      "@stylistic/brace-style": ["error", "1tbs"],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_", // Ignore arguments that start with an underscore
          varsIgnorePattern: "^_", // Ignore variables that start with an underscore
          caughtErrorsIgnorePattern: "^_", // Also good practice for catching errors
        },
      ],
    },
  },
])
