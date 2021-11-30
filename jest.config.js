module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/fixtures/', '.eslintrc.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/fixtures/'],
  resolver: './jest-resolver.js',
};
