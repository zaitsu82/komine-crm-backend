// jwtをモック化
const mockJwt = {
  sign: jest.fn(),
  verify: jest.fn(),
};

jest.mock('jsonwebtoken', () => mockJwt);

describe('JWT Utils', () => {
  let jwtUtils: any;

  const mockPayload = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin'
  };

  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';

  beforeEach(async () => {
    jest.clearAllMocks();

    // 環境変数を確実に設定
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_EXPIRES_IN = '7d';

    // モジュールキャッシュをクリアして動的にインポート
    delete require.cache[require.resolve('../../src/utils/jwt')];
    jwtUtils = await import('../../src/utils/jwt');
  });

  describe('generateToken', () => {
    it('should generate token successfully', () => {
      mockJwt.sign.mockReturnValue(mockToken);

      const result = jwtUtils.generateToken(mockPayload);

      expect(result).toBe(mockToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        mockPayload,
        'test-secret-key',
        { expiresIn: '7d' }
      );
    });

    it('should use default values when environment variables are not set', async () => {
      const originalSecret = process.env.JWT_SECRET;
      const originalExpires = process.env.JWT_EXPIRES_IN;

      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRES_IN;

      // モジュールキャッシュをクリアして再インポート
      jest.resetModules();
      delete require.cache[require.resolve('../../src/utils/jwt')];
      const freshJwtUtils = await import('../../src/utils/jwt');

      mockJwt.sign.mockReturnValue(mockToken);

      const result = freshJwtUtils.generateToken(mockPayload);

      expect(result).toBe(mockToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        mockPayload,
        'cemetery-crm-secret-key',
        { expiresIn: '7d' }
      );

      // 環境変数を復元
      if (originalSecret !== undefined) process.env.JWT_SECRET = originalSecret;
      if (originalExpires !== undefined) process.env.JWT_EXPIRES_IN = originalExpires;
    });

    it('should handle payload with different properties', () => {
      const differentPayload = {
        id: 999,
        email: 'admin@example.com',
        name: 'Admin User'
      };

      mockJwt.sign.mockReturnValue(mockToken);

      const result = jwtUtils.generateToken(differentPayload);

      expect(result).toBe(mockToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        differentPayload,
        'cemetery-crm-secret-key',
        { expiresIn: '7d' }
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify token successfully', () => {
      mockJwt.verify.mockReturnValue(mockPayload);

      const result = jwtUtils.verifyToken(mockToken);

      expect(result).toEqual(mockPayload);
      expect(mockJwt.verify).toHaveBeenCalledWith(mockToken, 'cemetery-crm-secret-key');
    });

    it('should throw error when token is invalid', () => {
      const error = new Error('JsonWebTokenError');
      mockJwt.verify.mockImplementation(() => {
        throw error;
      });

      expect(() => jwtUtils.verifyToken('invalid-token')).toThrow('Invalid token');
      expect(mockJwt.verify).toHaveBeenCalledWith('invalid-token', 'cemetery-crm-secret-key');
    });

    it('should throw error when token is expired', () => {
      const error = new Error('TokenExpiredError');
      mockJwt.verify.mockImplementation(() => {
        throw error;
      });

      expect(() => jwtUtils.verifyToken(mockToken)).toThrow('Invalid token');
      expect(mockJwt.verify).toHaveBeenCalledWith(mockToken, 'cemetery-crm-secret-key');
    });

    it('should use default secret when environment variable is not set', async () => {
      const originalSecret = process.env.JWT_SECRET;

      delete process.env.JWT_SECRET;

      // モジュールキャッシュをクリアして再インポート
      jest.resetModules();
      delete require.cache[require.resolve('../../src/utils/jwt')];
      const freshJwtUtils = await import('../../src/utils/jwt');

      mockJwt.verify.mockReturnValue(mockPayload);

      const result = freshJwtUtils.verifyToken(mockToken);

      expect(result).toEqual(mockPayload);
      expect(mockJwt.verify).toHaveBeenCalledWith(mockToken, 'cemetery-crm-secret-key');

      // 環境変数を復元
      if (originalSecret !== undefined) process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const authHeader = `Bearer ${mockToken}`;

      const result = jwtUtils.extractTokenFromHeader(authHeader);

      expect(result).toBe(mockToken);
    });

    it('should throw error when auth header is undefined', () => {
      expect(() => jwtUtils.extractTokenFromHeader(undefined)).toThrow('Authorization header is required');
    });

    it('should throw error when auth header is empty string', () => {
      expect(() => jwtUtils.extractTokenFromHeader('')).toThrow('Authorization header is required');
    });

    it('should throw error when auth header does not start with Bearer', () => {
      const invalidHeader = `Basic ${mockToken}`;

      expect(() => jwtUtils.extractTokenFromHeader(invalidHeader)).toThrow('Invalid authorization header format');
    });

    it('should throw error when auth header is only Bearer without space', () => {
      const invalidHeader = `Bearer${mockToken}`;

      expect(() => jwtUtils.extractTokenFromHeader(invalidHeader)).toThrow('Invalid authorization header format');
    });

    it('should extract token when header has extra spaces', () => {
      const authHeader = `Bearer    ${mockToken}`;

      const result = jwtUtils.extractTokenFromHeader(authHeader);

      expect(result).toBe(`   ${mockToken}`);
    });

    it('should handle Bearer with empty token', () => {
      const authHeader = 'Bearer ';

      const result = jwtUtils.extractTokenFromHeader(authHeader);

      expect(result).toBe('');
    });
  });
});