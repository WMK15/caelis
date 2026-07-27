import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "node_modules/**",
      "pnpm-lock.yaml",
      "fixtures/**/.caelis/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  },
  {
    files: ["plugins/rmmz/src/**/*.ts"],
    languageOptions: {
      globals: {
        PluginManager: "readonly"
      }
    }
  },
  {
    files: ["packages/rmmz-schema/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-deprecated": "off"
    }
  }
);
