export default {
  displayName: 'raco-llm-gateway',
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
  coverageDirectory: '../../../coverage/backend/services/raco-llm-gateway',
  testMatch: ['**/__tests__/**/*.test.ts'],
};
