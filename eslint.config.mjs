import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import eslintComments from "eslint-plugin-eslint-comments";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "laravel/**",
      "packages/website/**",
      "packages/create-beynac/**",
      "eslint.config.mjs",
      "port-progress.ts",
    ],
  },
  {
    files: [
      "packages/*/src/**/*.ts",
      "packages/*/src/**/*.tsx",
      "packages/*/src/**/*.mts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "eslint-comments": eslintComments,
    },
  },
  {
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ForInStatement",
          message:
            "for-in loops are not allowed. Use for-of or Object.keys/Object.entries instead.",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "eslint-comments/require-description": "error",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-namespace": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.test.mts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
  prettier
);
