module.exports = {
  testEnvironment: 'jsdom', // or 'jsdom' if testing DOM manipulation directly
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.js?(x)', '**/?(*.)+(spec|test).js?(x)'],
};
