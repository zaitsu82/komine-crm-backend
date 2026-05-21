/**
 * getGraveClassifications コントローラーのテスト
 */

import { Request, Response, NextFunction } from 'express';

// モックプリズマインスタンス
const mockPrisma: any = {
  contractPlot: {
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { getGraveClassifications } from '../../src/plots/controllers/getGraveClassifications';

describe('getGraveClassifications', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;
  let mockNext: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnThis();
    mockRequest = {};
    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  it('should return distinct grave classification values', async () => {
    mockPrisma.contractPlot.findMany
      .mockResolvedValueOnce([{ grave_kind: 1 }, { grave_kind: 2 }])
      .mockResolvedValueOnce([{ grave_kubun: 3 }, { grave_kubun: 5 }, { grave_kubun: 9 }])
      .mockResolvedValueOnce([{ grave_type: 1 }]);

    await getGraveClassifications(
      mockRequest as Request,
      mockResponse as Response,
      mockNext as NextFunction
    );

    expect(responseStatus).toHaveBeenCalledWith(200);
    expect(responseJson).toHaveBeenCalledWith({
      success: true,
      data: {
        graveKinds: [1, 2],
        graveKubuns: [3, 5, 9],
        graveTypes: [1],
      },
    });
  });

  it('should filter out null values returned by Prisma', async () => {
    mockPrisma.contractPlot.findMany
      .mockResolvedValueOnce([{ grave_kind: 1 }, { grave_kind: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ grave_type: null }, { grave_type: 7 }]);

    await getGraveClassifications(
      mockRequest as Request,
      mockResponse as Response,
      mockNext as NextFunction
    );

    expect(responseJson).toHaveBeenCalledWith({
      success: true,
      data: {
        graveKinds: [1],
        graveKubuns: [],
        graveTypes: [7],
      },
    });
  });

  it('should pass error to next on Prisma failure', async () => {
    const dbErr = new Error('db boom');
    mockPrisma.contractPlot.findMany.mockRejectedValueOnce(dbErr);

    await getGraveClassifications(
      mockRequest as Request,
      mockResponse as Response,
      mockNext as NextFunction
    );

    expect(mockNext).toHaveBeenCalledWith(dbErr);
  });
});
