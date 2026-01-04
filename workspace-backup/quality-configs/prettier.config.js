/** @type {import("prettier").Config} */
export default {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-sql'],
  overrides: [
    {
      files: '*.sql',
      options: {
        language: 'postgresql',
        keywordCase: 'upper',
        dataTypeCase: 'upper',
        functionCase: 'lower',
      },
    },
  ],
};
