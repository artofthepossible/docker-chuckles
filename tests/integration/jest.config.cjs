const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '../..'),
  testMatch: ['<rootDir>/tests/integration/**/*.test.cjs'],
  testEnvironment: 'node',
  testTimeout: 600_000,
  maxWorkers: 1,
  verbose: true,
};
