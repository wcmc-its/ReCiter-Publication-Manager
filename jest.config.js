/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/*.test.(ts|tsx|js)'],
  transform: {
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  }
}
