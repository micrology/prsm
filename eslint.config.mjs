import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["js/modernizr*"],
}, ...compat.extends("eslint:recommended", "prettier"), {
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.amd,
            ...globals.node,
            Atomics: "readonly",
            SharedArrayBuffer: "readonly",
        },

        ecmaVersion: 2021,
        sourceType: "module",
    },

    rules: {
        "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    },
}];