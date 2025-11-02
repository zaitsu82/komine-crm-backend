import { Request, Response, NextFunction } from 'express';
import {
  ROLES,
  requirePermission,
  checkApiPermission,
  hasPermission,
  checkResourceAction,
  API_PERMISSIONS,
  Role
} from '../../src/middleware/permission';

// Express Request型の拡張定義
// src/middleware/auth.ts で定義されているグローバル型拡張をテストファイルでも使用できるようにする
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        role: string;
        is_active: boolean;
        supabase_uid: string;
      };
    }
  }
}

describe('Permission Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'operator',
        is_active: true,
        supabase_uid: 'test-supabase-uid'
      },
      method: 'GET',
      path: '/test',
      route: { path: '/test' }
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('ROLES constant', () => {
    it('should have correct role definitions', () => {
      expect(ROLES.VIEWER).toBe('viewer');
      expect(ROLES.OPERATOR).toBe('operator');
      expect(ROLES.MANAGER).toBe('manager');
      expect(ROLES.ADMIN).toBe('admin');
    });
  });

  describe('requirePermission', () => {
    it('should allow access when user has required permission', () => {
      mockRequest.user = { id: 1, email: 'test@example.com', name: 'Test User', role: 'operator', is_active: true, supabase_uid: 'test-supabase-uid' };
      const middleware = requirePermission(['operator', 'manager']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access when user has higher permission level', () => {
      mockRequest.user = { id: 1, email: 'admin@example.com', name: 'Admin User', role: 'admin', is_active: true, supabase_uid: 'admin-supabase-uid' };
      const middleware = requirePermission(['operator']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access when user lacks required permission', () => {
      mockRequest.user = { id: 1, email: 'viewer@example.com', name: 'Viewer User', role: 'viewer', is_active: true, supabase_uid: 'viewer-supabase-uid' };
      const middleware = requirePermission(['operator', 'manager']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '権限が不足しています',
          details: [{
            message: '必要な権限: operator, manager、現在の権限: viewer'
          }]
        }
      });
    });

    it('should deny access when user is not authenticated', () => {
      mockRequest.user = undefined;
      const middleware = requirePermission(['operator']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: []
        }
      });
    });

    it('should handle viewer role correctly', () => {
      mockRequest.user = { id: 1, email: 'viewer@example.com', name: 'Viewer User', role: 'viewer', is_active: true, supabase_uid: 'viewer-supabase-uid' };
      const middleware = requirePermission(['viewer']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle manager role with all permissions', () => {
      mockRequest.user = { id: 1, email: 'manager@example.com', name: 'Manager User', role: 'manager', is_active: true, supabase_uid: 'manager-supabase-uid' };
      const middleware = requirePermission(['viewer', 'operator']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle admin role with all permissions', () => {
      mockRequest.user = { id: 1, email: 'admin@example.com', name: 'Admin User', role: 'admin', is_active: true, supabase_uid: 'admin-supabase-uid' };
      const middleware = requirePermission(['viewer', 'operator', 'manager']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle undefined user role', () => {
      mockRequest.user = { id: 1, email: 'test@example.com', name: 'Test User', role: undefined as any, is_active: true, supabase_uid: 'test-supabase-uid' };
      const middleware = requirePermission(['viewer']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should handle multiple required roles', () => {
      mockRequest.user = { id: 1, email: 'test@example.com', name: 'Test User', role: 'operator', is_active: true, supabase_uid: 'test-supabase-uid' };
      const middleware = requirePermission(['manager', 'admin']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '権限が不足しています',
          details: [{
            message: '必要な権限: manager, admin、現在の権限: operator'
          }]
        }
      });
    });

    it('should handle empty required roles array', () => {
      mockRequest.user = { id: 1, email: 'viewer@example.com', name: 'Viewer User', role: 'viewer', is_active: true, supabase_uid: 'viewer-supabase-uid' };
      const middleware = requirePermission([]);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('checkApiPermission', () => {
    it('should allow access for defined API with correct permission', () => {
      mockRequest.user = { id: 1, email: 'test@example.com', name: 'Test User', role: 'operator', is_active: true, supabase_uid: 'test-supabase-uid' };
      mockRequest.method = 'POST';
      mockRequest.route = { path: '/applicants' };
      const middleware = checkApiPermission();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for defined API with insufficient permission', () => {
      mockRequest.user = { id: 1, email: 'viewer@example.com', name: 'Viewer User', role: 'viewer', is_active: true, supabase_uid: 'viewer-supabase-uid' };
      mockRequest.method = 'POST';
      mockRequest.route = { path: '/applicants' };
      const middleware = checkApiPermission();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should require admin for undefined API routes', () => {
      mockRequest.user = { id: 1, email: 'test@example.com', name: 'Test User', role: 'operator', is_active: true, supabase_uid: 'test-supabase-uid' };
      mockRequest.method = 'POST';
      mockRequest.route = { path: '/undefined-route' };
      const middleware = checkApiPermission();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should allow admin for undefined API routes', () => {
      mockRequest.user = { id: 1, email: 'admin@example.com', name: 'Admin User', role: 'admin', is_active: true, supabase_uid: 'admin-supabase-uid' };
      mockRequest.method = 'POST';
      mockRequest.route = { path: '/undefined-route' };
      const middleware = checkApiPermission();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle path parameters correctly', () => {
      mockRequest.user = { id: 1, email: 'viewer@example.com', name: 'Viewer User', role: 'viewer', is_active: true, supabase_uid: 'viewer-supabase-uid' };
      mockRequest.method = 'GET';
      mockRequest.route = { path: '/applicants/:id' };
      const middleware = checkApiPermission();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle multiple path parameters', () => {
      mockRequest.user = { id: 1, email: 'manager@example.com', name: 'Manager User', role: 'manager', is_active: true, supabase_uid: 'manager-supabase-uid' };
      mockRequest.method = 'DELETE';
      mockRequest.route = { path: '/applicants/:id' };
      const middleware = checkApiPermission();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access when user is not authenticated', () => {
      mockRequest.user = undefined;
      mockRequest.method = 'GET';
      mockRequest.route = { path: '/applicants' };
      const middleware = checkApiPermission();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: []
        }
      });
    });

    it('should handle missing route path', () => {
      mockRequest.user = { id: 1, email: 'admin@example.com', name: 'Admin User', role: 'admin', is_active: true, supabase_uid: 'admin-supabase-uid' };
      mockRequest.method = 'GET';
      mockRequest.route = undefined;
      const mockRequestWithPath = { ...mockRequest, path: '/test-path' } as Request;
      const middleware = checkApiPermission();

      middleware(mockRequestWithPath, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle auth endpoints correctly', () => {
      mockRequest.user = { id: 1, email: 'viewer@example.com', name: 'Viewer User', role: 'viewer', is_active: true, supabase_uid: 'viewer-supabase-uid' };
      mockRequest.method = 'GET';
      mockRequest.route = { path: '/auth/me' };
      const middleware = checkApiPermission();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle gravestone management endpoints', () => {
      mockRequest.user = { id: 1, email: 'test@example.com', name: 'Test User', role: 'operator', is_active: true, supabase_uid: 'test-supabase-uid' };
      mockRequest.method = 'POST';
      mockRequest.route = { path: '/gravestones' };
      const middleware = checkApiPermission();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should deny gravestone deletion for operator', () => {
      mockRequest.user = { id: 1, email: 'test@example.com', name: 'Test User', role: 'operator', is_active: true, supabase_uid: 'test-supabase-uid' };
      mockRequest.method = 'DELETE';
      mockRequest.route = { path: '/gravestones/:id' };
      const middleware = checkApiPermission();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has required permission', () => {
      const result = hasPermission('operator', ['operator']);
      expect(result).toBe(true);
    });

    it('should return true when user has higher permission', () => {
      const result = hasPermission('admin', ['operator']);
      expect(result).toBe(true);
    });

    it('should return false when user lacks permission', () => {
      const result = hasPermission('viewer', ['operator']);
      expect(result).toBe(false);
    });

    it('should return true for viewer with viewer permission', () => {
      const result = hasPermission('viewer', ['viewer']);
      expect(result).toBe(true);
    });

    it('should return true for manager with operator permission', () => {
      const result = hasPermission('manager', ['operator']);
      expect(result).toBe(true);
    });

    it('should return true for admin with any permission', () => {
      const result = hasPermission('admin', ['viewer', 'operator', 'manager']);
      expect(result).toBe(true);
    });

    it('should return false for undefined role', () => {
      const result = hasPermission(undefined as any, ['viewer']);
      expect(result).toBe(false);
    });

    it('should handle multiple required roles correctly', () => {
      const result = hasPermission('operator', ['manager', 'admin']);
      expect(result).toBe(false);
    });

    it('should handle empty required roles array', () => {
      const result = hasPermission('admin', []);
      expect(result).toBe(false);
    });
  });

  describe('checkResourceAction', () => {
    it('should allow gravestone read for viewer', () => {
      const result = checkResourceAction('viewer', 'gravestone', 'read');
      expect(result).toBe(true);
    });

    it('should deny gravestone create for viewer', () => {
      const result = checkResourceAction('viewer', 'gravestone', 'create');
      expect(result).toBe(false);
    });

    it('should allow gravestone create for operator', () => {
      const result = checkResourceAction('operator', 'gravestone', 'create');
      expect(result).toBe(true);
    });

    it('should deny gravestone delete for operator', () => {
      const result = checkResourceAction('operator', 'gravestone', 'delete');
      expect(result).toBe(false);
    });

    it('should allow gravestone delete for manager', () => {
      const result = checkResourceAction('manager', 'gravestone', 'delete');
      expect(result).toBe(true);
    });

    it('should allow all actions for admin', () => {
      expect(checkResourceAction('admin', 'gravestone', 'read')).toBe(true);
      expect(checkResourceAction('admin', 'gravestone', 'create')).toBe(true);
      expect(checkResourceAction('admin', 'gravestone', 'update')).toBe(true);
      expect(checkResourceAction('admin', 'gravestone', 'delete')).toBe(true);
    });

    it('should handle contractor permissions correctly', () => {
      expect(checkResourceAction('viewer', 'contractor', 'read')).toBe(true);
      expect(checkResourceAction('operator', 'contractor', 'create')).toBe(true);
      expect(checkResourceAction('operator', 'contractor', 'transfer')).toBe(false);
      expect(checkResourceAction('manager', 'contractor', 'transfer')).toBe(true);
    });

    it('should handle master data permissions correctly', () => {
      expect(checkResourceAction('viewer', 'master', 'read')).toBe(true);
      expect(checkResourceAction('manager', 'master', 'create')).toBe(false);
      expect(checkResourceAction('admin', 'master', 'create')).toBe(true);
    });

    it('should handle user management permissions correctly', () => {
      expect(checkResourceAction('operator', 'user', 'read')).toBe(false);
      expect(checkResourceAction('manager', 'user', 'read')).toBe(true);
      expect(checkResourceAction('manager', 'user', 'manage')).toBe(false);
      expect(checkResourceAction('admin', 'user', 'manage')).toBe(true);
    });

    it('should handle system admin permissions correctly', () => {
      expect(checkResourceAction('manager', 'system', 'admin')).toBe(false);
      expect(checkResourceAction('admin', 'system', 'admin')).toBe(true);
    });

    it('should require admin for undefined resource actions', () => {
      expect(checkResourceAction('manager', 'undefined', 'action')).toBe(false);
      expect(checkResourceAction('admin', 'undefined', 'action')).toBe(true);
    });

    it('should handle undefined role for resource actions', () => {
      const result = checkResourceAction(undefined as any, 'gravestone', 'read');
      expect(result).toBe(false);
    });
  });

  describe('API_PERMISSIONS constant', () => {
    it('should have correct auth endpoint permissions', () => {
      expect(API_PERMISSIONS['GET /auth/me']).toEqual(['viewer', 'operator', 'manager', 'admin']);
      expect(API_PERMISSIONS['POST /auth/logout']).toEqual(['viewer', 'operator', 'manager', 'admin']);
    });

    it('should have correct gravestone endpoint permissions', () => {
      expect(API_PERMISSIONS['GET /gravestones']).toEqual(['viewer', 'operator', 'manager', 'admin']);
      expect(API_PERMISSIONS['POST /gravestones']).toEqual(['operator', 'manager', 'admin']);
      expect(API_PERMISSIONS['DELETE /gravestones/*']).toEqual(['manager', 'admin']);
    });

    it('should have correct applicant endpoint permissions', () => {
      expect(API_PERMISSIONS['GET /applicants/*']).toEqual(['viewer', 'operator', 'manager', 'admin']);
      expect(API_PERMISSIONS['POST /applicants']).toEqual(['operator', 'manager', 'admin']);
      expect(API_PERMISSIONS['DELETE /applicants/*']).toEqual(['manager', 'admin']);
    });

    it('should have correct usage and management fee permissions', () => {
      expect(API_PERMISSIONS['POST /usage-fees']).toEqual(['operator', 'manager', 'admin']);
      expect(API_PERMISSIONS['POST /management-fees/calculate']).toEqual(['operator', 'manager', 'admin']);
    });

    it('should have correct admin-only permissions', () => {
      expect(API_PERMISSIONS['POST /masters/*']).toEqual(['admin']);
      expect(API_PERMISSIONS['PUT /users/*/role']).toEqual(['admin']);
      expect(API_PERMISSIONS['POST /import']).toEqual(['admin']);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete permission flow for viewer', () => {
      // Viewer should be able to read but not modify
      expect(hasPermission('viewer', ['viewer'])).toBe(true);
      expect(hasPermission('viewer', ['operator'])).toBe(false);
      expect(checkResourceAction('viewer', 'gravestone', 'read')).toBe(true);
      expect(checkResourceAction('viewer', 'gravestone', 'create')).toBe(false);
    });

    it('should handle complete permission flow for operator', () => {
      // Operator should be able to read and create but not delete
      expect(hasPermission('operator', ['viewer', 'operator'])).toBe(true);
      expect(hasPermission('operator', ['manager'])).toBe(false);
      expect(checkResourceAction('operator', 'gravestone', 'create')).toBe(true);
      expect(checkResourceAction('operator', 'gravestone', 'delete')).toBe(false);
    });

    it('should handle complete permission flow for manager', () => {
      // Manager should have most permissions except admin-only
      expect(hasPermission('manager', ['viewer', 'operator', 'manager'])).toBe(true);
      expect(hasPermission('manager', ['admin'])).toBe(false);
      expect(checkResourceAction('manager', 'gravestone', 'delete')).toBe(true);
      expect(checkResourceAction('manager', 'master', 'create')).toBe(false);
    });

    it('should handle complete permission flow for admin', () => {
      // Admin should have all permissions
      expect(hasPermission('admin', ['viewer', 'operator', 'manager', 'admin'])).toBe(true);
      expect(checkResourceAction('admin', 'gravestone', 'delete')).toBe(true);
      expect(checkResourceAction('admin', 'master', 'create')).toBe(true);
      expect(checkResourceAction('admin', 'system', 'admin')).toBe(true);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed user object', () => {
      mockRequest.user = { id: 1, supabase_uid: 'test-uid' } as any; // Missing role
      const middleware = requirePermission(['viewer']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should handle invalid role types', () => {
      const result = hasPermission('invalid_role' as Role, ['viewer']);
      expect(result).toBe(false);
    });

    it('should handle null and undefined inputs', () => {
      expect(hasPermission(null as any, ['viewer'])).toBe(false);
      expect(() => hasPermission('viewer', null as any)).toThrow();
      expect(checkResourceAction(null as any, 'gravestone', 'read')).toBe(false);
      expect(checkResourceAction('viewer', null as any, 'read')).toBe(false);
      expect(checkResourceAction('viewer', 'gravestone', null as any)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(hasPermission('' as Role, ['viewer'])).toBe(false);
      expect(checkResourceAction('' as Role, 'gravestone', 'read')).toBe(false);
      expect(checkResourceAction('viewer', '', 'read')).toBe(false);
      expect(checkResourceAction('viewer', 'gravestone', '')).toBe(false);
    });
  });
});