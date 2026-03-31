import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Web dev standards: strict equality, handle errors, no empty catch
  {
    rules: {
      eqeqeq: ["error", "always"],
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },
  // Disable ESLint rules that conflict with Prettier
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
