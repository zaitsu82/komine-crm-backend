module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 40,    // 実績: 40.31%
      functions: 65,   // 実績: 69.1%
      lines: 55,       // 実績: 56.33%
      statements: 55,  // 実績: 56.77%
    },
    // TODO: 区画管理リファクタリング後のテスト実装完了後、閾値を段階的に引き上げる
    // 最終目標: branches: 80, functions: 100, lines: 99, statements: 97
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  testTimeout: 10000,
};