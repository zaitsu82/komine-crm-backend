// Prismaクライアントのモックは__mocks__ディレクトリで設定
jest.mock('@prisma/client');

// pinoロガーのモック
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis(),
  silent: jest.fn(),
};

jest.mock('../src/utils/logger', () => ({
  logger: { ...mockLogger, child: jest.fn(() => ({ ...mockLogger })) },
  loggerStorage: {
    getStore: jest.fn(() => undefined),
    run: jest.fn((store: unknown, fn: () => void) => fn()),
  },
  getRequestLogger: jest.fn(() => mockLogger),
}));

// 環境変数の設定
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

// テスト前後のクリーンアップ
beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  // テスト終了後のクリーンアップ処理
});
