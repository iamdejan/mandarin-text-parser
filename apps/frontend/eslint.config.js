import js from "@eslint/js";
import solid from "eslint-plugin-solid/configs/typescript";
import * as tsParser from "@typescript-eslint/parser";
import tseslint from "typescript-eslint";
import globals from "globals";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  {
    ignores: ["node_modules/", "dist/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    ...solid,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "tsconfig.json",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    // TypeScript-specific rules go here
    rules: {
      // Enforces explicit return types on all functions
      "@typescript-eslint/explicit-function-return-type": "error",
    },
  },
  {
    // Apply the rule to all your JavaScript and TypeScript files
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "func-style": ["error", "declaration", { allowArrowFunctions: true }],
      // Forces nested variable-assigned arrow functions to be traditional functions
      "no-restricted-syntax": [
        "error",
        {
          selector: "VariableDeclarator[init.type='ArrowFunctionExpression']",
          message:
            "Use a function declaration instead of assigning an arrow function to a constant.",
        },
      ],
    },
  },
  eslintPluginPrettierRecommended,
];
