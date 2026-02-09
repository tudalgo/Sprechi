import { defineConfig } from "eslint/config"
import stylistic from "@stylistic/eslint-plugin"
import js from "@eslint/js"
import tseslint from "typescript-eslint"
import pluginImport from "eslint-plugin-import"
import globals from "globals"

export default defineConfig([
  {
    ignores: ["build/**", "coverage/**", "node_modules/**", "*.config.ts"],
  },
  {
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      js,
      tseslint,
      stylistic,
      import: pluginImport,
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      stylistic.configs.recommended,
    ],
    rules: {
      "import/no-unresolved": "error",
      "no-unused-vars": "off",
      "no-undef": "warn",
      "no-console": "error",
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
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
])
