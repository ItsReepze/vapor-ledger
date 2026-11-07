const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/", "dist/"] },
  js.configs.recommended,
  {
    // Extension files: plain browser scripts that share the VL global.
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, chrome: "readonly" },
    },
    rules: {
      // Functions are used from other files through VL, so only warn on
      // unused local variables and arguments.
      "no-unused-vars": ["error", { vars: "local", args: "none" }],
    },
  },
  {
    files: ["test/**/*.js", "scripts/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },
];
