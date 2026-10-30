module.exports = {
  displayName: 'frontline-widgets',

  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleNameMapper: {
    '^erxes-ui$': '<rootDir>/../../frontend/libs/erxes-ui/src/index.ts',
  },
  testRegex: 'widget-survey[.]spec[.]tsx$',

  testPathIgnorePatterns: [],
};
