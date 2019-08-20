module.exports = {
  env: {
    node: true,
    es6: true,
  },
  parser: 'babel-eslint',
  plugins: ['prettier', 'babel'],
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    ecmaVersion: 9,
    sourceType: 'module',
  },
  rules: {
    'require-await': 'error',
    eqeqeq: 'error',
    strict: 'error',
    'prettier/prettier': ['warn', {}, { usePrettierrc: true }],
    'no-var': 'error',
    'no-console': 'off',
    'no-empty': 'off',
  },
}
