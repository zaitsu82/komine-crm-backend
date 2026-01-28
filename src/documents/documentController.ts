/**
 * 書類管理コントローラー
 */

import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  uploadFile,
  downloadFile,
  deleteFile,
  getDownloadUrl,
  generateFileKey,
  generatePdfFromTemplate,
  isAllowedMimeType,
  isAllowedFileSize,
  TemplateType,
  InvoiceTemplateData,
  PostcardTemplateData,
} from './documentService';

const prisma = new PrismaClient();

// 型定義（Prisma生成後にenumからインポート可能）
type DocumentType = 'invoice' | 'postcard' | 'contract' | 'permit' | 'other';
type DocumentStatus = 'draft' | 'generated' | 'sent' | 'archived';

// リクエスト型定義
interface CreateDocumentBody {
  contractPlotId?: string;
  customerId?: string;
  type: DocumentType;
  name: string;
  description?: string;
  templateType?: string;
  templateData?: Record<string, unknown>;
  notes?: string;
}

interface UpdateDocumentBody {
  name?: string;
  description?: string;
  status?: DocumentStatus;
  templateData?: Record<string, unknown>;
  notes?: string;
}

interface DocumentListQuery {
  contractPlotId?: string;
  customerId?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface GeneratePdfBody {
  templateType: TemplateType;
  templateData: InvoiceTemplateData | PostcardTemplateData;
  documentId?: string;
  name?: string;
  contractPlotId?: string;
  customerId?: string;
}

/**
 * 書類一覧取得
 */
export const getDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      contractPlotId,
      customerId,
      type,
      status,
      page = '1',
      limit = '20',
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query as DocumentListQuery;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // フィルター条件構築
    const where: {
      deleted_at: null;
      contract_plot_id?: string;
      customer_id?: string;
      type?: DocumentType;
      status?: DocumentStatus;
    } = {
      deleted_at: null,
    };

    if (contractPlotId) where.contract_plot_id = contractPlotId;
    if (customerId) where.customer_id = customerId;
    if (type) where.type = type;
    if (status) where.status = status;

    // ソート設定
    const allowedSortFields = ['created_at', 'updated_at', 'name', 'type', 'status'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const orderBy = { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' };

    // データ取得
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          contractPlot: {
            select: {
              id: true,
              physicalPlot: {
                select: {
                  plot_number: true,
                  area_name: true,
                },
              },
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              name_kana: true,
            },
          },
        },
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.document.count({ where }),
    ]);

    // レスポンス形式に変換
    const items = documents.map((doc) => ({
      id: doc.id,
      contractPlotId: doc.contract_plot_id,
      customerId: doc.customer_id,
      type: doc.type,
      name: doc.name,
      description: doc.description,
      status: doc.status,
      fileName: doc.file_name,
      fileSize: doc.file_size,
      mimeType: doc.mime_type,
      templateType: doc.template_type,
      generatedAt: doc.generated_at?.toISOString() || null,
      sentAt: doc.sent_at?.toISOString() || null,
      createdBy: doc.created_by,
      notes: doc.notes,
      createdAt: doc.created_at.toISOString(),
      updatedAt: doc.updated_at.toISOString(),
      contractPlot: doc.contractPlot
        ? {
            id: doc.contractPlot.id,
            plotNumber: doc.contractPlot.physicalPlot.plot_number,
            areaName: doc.contractPlot.physicalPlot.area_name,
          }
        : null,
      customer: doc.customer
        ? {
            id: doc.customer.id,
            name: doc.customer.name,
            nameKana: doc.customer.name_kana,
          }
        : null,
    }));

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '書類一覧の取得に失敗しました',
      },
    });
  }
};

/**
 * 書類詳細取得
 */
export const getDocumentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findFirst({
      where: { id, deleted_at: null },
      include: {
        contractPlot: {
          select: {
            id: true,
            contract_area_sqm: true,
            contract_date: true,
            physicalPlot: {
              select: {
                id: true,
                plot_number: true,
                area_name: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            name_kana: true,
            postal_code: true,
            address: true,
            phone_number: true,
            email: true,
          },
        },
      },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '書類が見つかりません',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: document.id,
        contractPlotId: document.contract_plot_id,
        customerId: document.customer_id,
        type: document.type,
        name: document.name,
        description: document.description,
        status: document.status,
        fileKey: document.file_key,
        fileName: document.file_name,
        fileSize: document.file_size,
        mimeType: document.mime_type,
        templateType: document.template_type,
        templateData: document.template_data,
        generatedAt: document.generated_at?.toISOString() || null,
        sentAt: document.sent_at?.toISOString() || null,
        createdBy: document.created_by,
        notes: document.notes,
        createdAt: document.created_at.toISOString(),
        updatedAt: document.updated_at.toISOString(),
        contractPlot: document.contractPlot
          ? {
              id: document.contractPlot.id,
              contractAreaSqm: Number(document.contractPlot.contract_area_sqm),
              contractDate: document.contractPlot.contract_date?.toISOString() || null,
              physicalPlot: {
                id: document.contractPlot.physicalPlot.id,
                plotNumber: document.contractPlot.physicalPlot.plot_number,
                areaName: document.contractPlot.physicalPlot.area_name,
              },
            }
          : null,
        customer: document.customer
          ? {
              id: document.customer.id,
              name: document.customer.name,
              nameKana: document.customer.name_kana,
              postalCode: document.customer.postal_code,
              address: document.customer.address,
              phoneNumber: document.customer.phone_number,
              email: document.customer.email,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '書類の取得に失敗しました',
      },
    });
  }
};

/**
 * 書類メタデータ作成
 */
export const createDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CreateDocumentBody;
    const {
      contractPlotId,
      customerId,
      type,
      name,
      description,
      templateType,
      templateData,
      notes,
    } = body;

    // 必須フィールド検証
    if (!type || !name) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'type と name は必須です',
        },
      });
      return;
    }

    // 関連データの存在確認
    if (contractPlotId) {
      const contractPlot = await prisma.contractPlot.findFirst({
        where: { id: contractPlotId, deleted_at: null },
      });
      if (!contractPlot) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '指定された契約区画が見つかりません',
          },
        });
        return;
      }
    }

    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, deleted_at: null },
      });
      if (!customer) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '指定された顧客が見つかりません',
          },
        });
        return;
      }
    }

    const document = await prisma.document.create({
      data: {
        contract_plot_id: contractPlotId || null,
        customer_id: customerId || null,
        type,
        name,
        description: description || null,
        template_type: templateType || null,
        template_data: templateData
          ? (templateData as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        notes: notes || null,
        created_by: req.user?.name || req.user?.email || 'system',
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: document.id,
        contractPlotId: document.contract_plot_id,
        customerId: document.customer_id,
        type: document.type,
        name: document.name,
        description: document.description,
        status: document.status,
        templateType: document.template_type,
        templateData: document.template_data,
        notes: document.notes,
        createdBy: document.created_by,
        createdAt: document.created_at.toISOString(),
        updatedAt: document.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '書類の作成に失敗しました',
      },
    });
  }
};

/**
 * 書類更新
 */
export const updateDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body as UpdateDocumentBody;
    const { name, description, status, templateData, notes } = body;

    const existingDocument = await prisma.document.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existingDocument) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '書類が見つかりません',
        },
      });
      return;
    }

    const updateData: Prisma.DocumentUpdateInput = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'sent' && !existingDocument.sent_at) {
        updateData.sent_at = new Date();
      }
    }
    if (templateData !== undefined) {
      updateData.template_data = templateData
        ? (templateData as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (notes !== undefined) updateData.notes = notes || null;

    const document = await prisma.document.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      data: {
        id: document.id,
        contractPlotId: document.contract_plot_id,
        customerId: document.customer_id,
        type: document.type,
        name: document.name,
        description: document.description,
        status: document.status,
        fileName: document.file_name,
        fileSize: document.file_size,
        mimeType: document.mime_type,
        templateType: document.template_type,
        templateData: document.template_data,
        generatedAt: document.generated_at?.toISOString() || null,
        sentAt: document.sent_at?.toISOString() || null,
        notes: document.notes,
        createdAt: document.created_at.toISOString(),
        updatedAt: document.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '書類の更新に失敗しました',
      },
    });
  }
};

/**
 * 書類削除（論理削除）
 */
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingDocument = await prisma.document.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existingDocument) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '書類が見つかりません',
        },
      });
      return;
    }

    // ストレージからファイルも削除
    if (existingDocument.file_key) {
      const deleteResult = await deleteFile(existingDocument.file_key);
      if (!deleteResult.success) {
        console.warn('Failed to delete file:', deleteResult.error);
        // 削除失敗はログのみで続行
      }
    }

    await prisma.document.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    res.status(200).json({
      success: true,
      data: { message: '書類を削除しました' },
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '書類の削除に失敗しました',
      },
    });
  }
};

/**
 * ファイルアップロード
 */
export const uploadDocumentFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'];
    const file = req.file;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'IDが指定されていません',
        },
      });
      return;
    }

    if (!file) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ファイルが指定されていません',
        },
      });
      return;
    }

    // MIMEタイプ検証
    if (!isAllowedMimeType(file.mimetype)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '許可されていないファイル形式です',
        },
      });
      return;
    }

    // ファイルサイズ検証
    if (!isAllowedFileSize(file.size)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ファイルサイズが10MBを超えています',
        },
      });
      return;
    }

    const document = await prisma.document.findFirst({
      where: { id, deleted_at: null },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '書類が見つかりません',
        },
      });
      return;
    }

    // 古いファイルがあれば削除
    if (document.file_key) {
      await deleteFile(document.file_key);
    }

    // ストレージにアップロード
    const fileKey = generateFileKey(id, file.originalname);
    const uploadResult = await uploadFile(fileKey, file.buffer, file.mimetype, file.originalname);

    if (!uploadResult.success) {
      res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: uploadResult.error || 'ファイルのアップロードに失敗しました',
        },
      });
      return;
    }

    // データベース更新
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        file_key: fileKey,
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        status: 'generated',
        generated_at: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      data: {
        id: updatedDocument.id,
        fileName: updatedDocument.file_name,
        fileSize: updatedDocument.file_size,
        mimeType: updatedDocument.mime_type,
        status: updatedDocument.status,
        generatedAt: updatedDocument.generated_at?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ファイルのアップロードに失敗しました',
      },
    });
  }
};

/**
 * ダウンロードURL取得
 */
export const getDocumentDownloadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findFirst({
      where: { id, deleted_at: null },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '書類が見つかりません',
        },
      });
      return;
    }

    if (!document.file_key) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'ファイルがアップロードされていません',
        },
      });
      return;
    }

    // ベースURLを構築（ローカルストレージ用）
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    const urlResult = await getDownloadUrl(document.file_key, baseUrl);

    if (!urlResult.success) {
      res.status(500).json({
        success: false,
        error: {
          code: 'URL_GENERATION_ERROR',
          message: urlResult.error || 'ダウンロードURLの生成に失敗しました',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        url: urlResult.url,
        fileName: document.file_name,
        mimeType: document.mime_type,
        expiresIn: urlResult.storage === 's3' ? 900 : null, // S3のみ有効期限あり
        storage: urlResult.storage,
      },
    });
  } catch (error) {
    console.error('Error getting download URL:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ダウンロードURLの取得に失敗しました',
      },
    });
  }
};

/**
 * PDF生成
 */
export const generatePdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as GeneratePdfBody;
    const { templateType, templateData, documentId, name, contractPlotId, customerId } = body;

    // 必須フィールド検証
    if (!templateType || !templateData) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'templateType と templateData は必須です',
        },
      });
      return;
    }

    // テンプレートタイプ検証
    if (!['invoice', 'postcard'].includes(templateType)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '無効なテンプレートタイプです。invoice または postcard を指定してください。',
        },
      });
      return;
    }

    // PDF生成
    const pdfResult = await generatePdfFromTemplate(
      templateType,
      templateData as InvoiceTemplateData | PostcardTemplateData
    );

    if (!pdfResult.success || !pdfResult.buffer) {
      res.status(500).json({
        success: false,
        error: {
          code: 'PDF_GENERATION_ERROR',
          message: pdfResult.error || 'PDF生成に失敗しました',
        },
      });
      return;
    }

    // documentIdが指定されている場合は既存書類を更新
    if (documentId) {
      const existingDocument = await prisma.document.findFirst({
        where: { id: documentId, deleted_at: null },
      });

      if (!existingDocument) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '書類が見つかりません',
          },
        });
        return;
      }

      // ストレージにアップロード
      const fileName = `${existingDocument.name}_${Date.now()}.pdf`;
      const fileKey = generateFileKey(documentId, fileName);
      const uploadResult = await uploadFile(fileKey, pdfResult.buffer, 'application/pdf', fileName);

      if (uploadResult.success) {
        // 古いファイルがあれば削除
        if (existingDocument.file_key) {
          await deleteFile(existingDocument.file_key);
        }

        await prisma.document.update({
          where: { id: documentId },
          data: {
            file_key: fileKey,
            file_name: fileName,
            file_size: pdfResult.buffer.length,
            mime_type: 'application/pdf',
            status: 'generated',
            generated_at: new Date(),
            template_data: templateData as unknown as Prisma.InputJsonValue,
          },
        });
      }

      // PDFをBase64で返す
      res.status(200).json({
        success: true,
        data: {
          documentId,
          pdf: pdfResult.buffer.toString('base64'),
          mimeType: 'application/pdf',
          fileSize: pdfResult.buffer.length,
        },
      });
      return;
    }

    // 新規書類を作成
    const documentType: DocumentType = templateType === 'invoice' ? 'invoice' : 'postcard';
    const documentName =
      name || `${templateType === 'invoice' ? '請求書' : 'はがき'}_${Date.now()}`;

    const newDocument = await prisma.document.create({
      data: {
        contract_plot_id: contractPlotId || null,
        customer_id: customerId || null,
        type: documentType,
        name: documentName,
        status: 'generated',
        mime_type: 'application/pdf',
        file_size: pdfResult.buffer.length,
        template_type: templateType,
        template_data: templateData as unknown as Prisma.InputJsonValue,
        generated_at: new Date(),
        created_by: req.user?.name || req.user?.email || 'system',
      },
    });

    // ストレージにアップロード
    const fileName = `${documentName}.pdf`;
    const fileKey = generateFileKey(newDocument.id, fileName);
    const uploadResult = await uploadFile(fileKey, pdfResult.buffer, 'application/pdf', fileName);

    if (uploadResult.success) {
      await prisma.document.update({
        where: { id: newDocument.id },
        data: {
          file_key: fileKey,
          file_name: fileName,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        documentId: newDocument.id,
        pdf: pdfResult.buffer.toString('base64'),
        mimeType: 'application/pdf',
        fileSize: pdfResult.buffer.length,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'PDF生成に失敗しました',
      },
    });
  }
};

/**
 * ローカルファイルダウンロード（ローカルストレージ用）
 */
export const downloadLocalFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileKey = req.params['fileKey'];

    if (!fileKey) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ファイルキーが指定されていません',
        },
      });
      return;
    }

    const decodedFileKey = decodeURIComponent(fileKey);
    const result = await downloadFile(decodedFileKey);

    if (!result.success || !result.buffer) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: result.error || 'ファイルが見つかりません',
        },
      });
      return;
    }

    // Content-Dispositionヘッダーでダウンロードを促す
    const fileName = decodedFileKey.split('/').pop() || 'download';
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', result.buffer.length);
    res.send(result.buffer);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ファイルのダウンロードに失敗しました',
      },
    });
  }
};
