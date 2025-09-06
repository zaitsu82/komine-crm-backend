// Prismaクライアントのモックは__mocks__ディレクトリで設定
jest.mock('@prisma/client');

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