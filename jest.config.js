const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/*.test.(ts|tsx|js)'],
}

module.exports = createJestConfig(customConfig)
