module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js)'],
  moduleNameMapper: {
    '\\.module\\.css$': '<rootDir>/__tests__/__mocks__/styleMock.js',
    '\\.css$': '<rootDir>/__tests__/__mocks__/styleMock.js',
  },
}
