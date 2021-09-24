module.exports = {
  // bracketSpacing: false,
  // jsxBracketSameLine: true,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  overrides: [
    {
      files: '*.sol',
      options: {
        printWidth: 145,
        tabWidth: 4,
        useTabs: false,
        singleQuote: false,
        bracketSpacing: false,
        explicitTypes: 'always',
      },
    },
  ],
};
