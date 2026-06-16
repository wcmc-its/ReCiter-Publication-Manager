module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['<rootDir>/__tests__/components/**/*.test.(ts|tsx|js)'],
  moduleNameMapper: {
    '\\.module\\.css$': '<rootDir>/__tests__/__mocks__/styleMock.js',
    '\\.css$': '<rootDir>/__tests__/__mocks__/styleMock.js',
  },
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
}
