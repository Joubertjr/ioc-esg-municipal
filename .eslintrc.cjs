/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  rules: {
    // Zero `any` — regra do CLAUDE.md
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",

    // Prefer unknown over any
    "@typescript-eslint/no-unsafe-argument": "error",

    // Unused vars — allow underscore prefix for intentional ignores
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],

    // Async safety
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "no-return-await": "off",
    "@typescript-eslint/return-await": ["error", "in-try-catch"],

    // Console — use Winston logger
    "no-console": ["warn", { allow: ["warn", "error"] }],

    // General quality
    "no-var": "error",
    "prefer-const": "error",
    eqeqeq: ["error", "always"],
    "no-throw-literal": "error",
  },
  ignorePatterns: [
    "dist/",
    "node_modules/",
    "frontend/",
    "*.js",
    "*.cjs",
    "*.mjs",
    "!.eslintrc.cjs",
  ],
};
