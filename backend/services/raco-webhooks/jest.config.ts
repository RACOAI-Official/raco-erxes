export default {
  displayName: 'raco-webhooks',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../../coverage/backend/services/raco-webhooks',
  testMatch: ['**/__tests__/**/*.test.ts'],
};
