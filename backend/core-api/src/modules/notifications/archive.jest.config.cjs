module.exports = {
  displayName: 'core-notification-archive',
  rootDir: '../../..',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/modules/$1',
  },
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false }],
  },
  testMatch: ['<rootDir>/src/modules/notifications/__tests__/archive.spec.ts'],
};
