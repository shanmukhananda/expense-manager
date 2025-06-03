module.exports = {
  testEnvironment: 'jsdom', // This is primarily for frontend tests. Node tests will run in a Node env.
  setupFilesAfterEnv: [
    '@testing-library/jest-dom', // For DOM assertions in UI tests
    './jest.setup.js'            // For global setups like polyfills
  ],
};
