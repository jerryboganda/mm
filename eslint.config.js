// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
  {
    files: ["server/**/*.{ts,js}", "scripts/**/*.{ts,js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: [
      "scripts/*.bundle.cjs",
      "scripts/*.bundle.js",
      "scripts/*.bundle.mjs",
      "scripts/*bundle*",
      "dist/**",
      "server_dist/**",
      "web_dist/**",
      "admin_dist/**",
      "website_dist/**",
      "coverage/**",
      ".agents/**",
      "eslint_report.json",
    ],
  },
]);


