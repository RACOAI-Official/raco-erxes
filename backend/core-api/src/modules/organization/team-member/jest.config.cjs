module.exports = {
  displayName: 'core-member-invitations',
  rootDir: '../../../..',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/modules/$1',
    '^erxes-api-shared/(.*)$': '<rootDir>/../erxes-api-shared/src/$1',
  },
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false }],
  },
  testMatch: ['<rootDir>/src/modules/organization/team-member/__tests__/*.spec.ts'],
};
