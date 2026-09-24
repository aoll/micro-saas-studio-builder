/** @type {import('lint-staged').Configuration} */
export default {
  "*.{ts,tsx,js,mjs}": ["eslint --fix", "prettier --write"],
  "*.{json,css,md}": ["prettier --write"],
};
