module.exports = {
  displayName: 'raco-saas',
  rootDir: '../../..',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: { '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false }] },
  testMatch: ['<rootDir>/src/modules/raco-saas/__tests__/*.spec.ts'],
};
