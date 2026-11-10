module.exports = {
  displayName: 'core-app-query-permissions',
  rootDir: '../../..',
  testEnvironment: 'node',
  moduleNameMapper: { '^~/(.*)$': '<rootDir>/src/$1' },
  transform: { '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false }] },
  testMatch: ['<rootDir>/src/modules/apps/__tests__/*.spec.ts'],
};
