import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import eslintComments from "eslint-plugin-eslint-comments";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "packages/beynac/src/vendor/**",
      "laravel/**",
      "packages/website/**",
      "packages/create-beynac/**",
      "eslint.config.mjs",
      "progress/**",
      "test-apps/**",
    ],
  },
  {
    files: ["packages/*/src/**/*.ts", "packages/*/src/**/*.tsx", "packages/*/src/**/*.mts"],
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
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "no-public",
        },
      ],
      "prefer-const": [
        "error",
        {
          destructuring: "all",
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.test.mts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
  prettier,
);
