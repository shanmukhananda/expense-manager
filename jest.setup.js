// jest.setup.js
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// If you already have setup for @testing-library/jest-dom, you can keep it here or in jest.config.js
// For instance, if you had: import '@testing-library/jest-dom';
// You can either put it here, or ensure jest.config.js loads both setup files.
// For simplicity, if @testing-library/jest-dom is the only other one,
// modifying jest.config.js to include both is cleaner.
// If this file only contains the polyfill, that's also fine.
// Let's assume @testing-library/jest-dom is handled by jest.config.js for now.
