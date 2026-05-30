module.exports = {
    preset: 'jest-expo',
    collectCoverage: true,
    collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
        '!**/node_modules/**',
        '!**/vendor/**',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        '!src/__mocks__/**',
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    setupFilesAfterEnv: ['./jest.setup.js'],
};
