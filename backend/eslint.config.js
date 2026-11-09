import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      "lines-between-class-members": [
        "error",
        "always",
        { exceptAfterSingleLine: false },
      ],
      "padding-line-between-statements": [
        "error",
        {
          blankLine: "always",
          prev: ["function", "export", "const"],
          next: ["function", "export", "const"],
        },
      ],
    },
  },
);
