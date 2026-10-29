module.exports = {
  displayName: 'core-notifications',
  rootDir: '../../..',
  testEnvironment: 'node',
  moduleNameMapper: { '^~/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false }],
  },
  testMatch: ['<rootDir>/src/modules/notifications/__tests__/*.spec.ts'],
};
