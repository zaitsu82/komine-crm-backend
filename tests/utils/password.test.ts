import { hashPassword, comparePassword } from '../../src/utils/password';

// bcryptモジュール全体をモック化
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// bcryptをimportしてモック関数として型付け
import bcrypt from 'bcrypt';
const mockBcrypt = bcrypt as any;

describe('Password Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword123';
      
      mockBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });

    it('should throw error when bcrypt.hash fails', async () => {
      const password = 'testPassword123';
      const error = new Error('Bcrypt error');
      
      mockBcrypt.hash.mockRejectedValue(error);

      await expect(hashPassword(password)).rejects.toThrow('Failed to hash password');
      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });

    it('should handle empty password', async () => {
      const password = '';
      const hashedPassword = 'hashedEmptyPassword';
      
      mockBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });
  });

  describe('comparePassword', () => {
    it('should return true when passwords match', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword123';
      
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await comparePassword(password, hashedPassword);

      expect(result).toBe(true);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });

    it('should return false when passwords do not match', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'differentHashedPassword';
      
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await comparePassword(password, hashedPassword);

      expect(result).toBe(false);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });

    it('should throw error when bcrypt.compare fails', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword123';
      const error = new Error('Bcrypt error');
      
      mockBcrypt.compare.mockRejectedValue(error);

      await expect(comparePassword(password, hashedPassword)).rejects.toThrow('Failed to compare password');
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });

    it('should handle empty password and hash', async () => {
      const password = '';
      const hashedPassword = '';
      
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await comparePassword(password, hashedPassword);

      expect(result).toBe(false);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });
  });
});