-- AlterEnum: 書類タイプに封筒書・封筒台を追加
ALTER TYPE "DocumentType" ADD VALUE 'envelope_letter';
ALTER TYPE "DocumentType" ADD VALUE 'envelope_base';
