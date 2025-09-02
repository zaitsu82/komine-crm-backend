import { Router } from 'express';
import { getContractorHistories, createContractorHistory } from './contractorHistoryController';
import { authenticate } from '../middleware/auth';

const router = Router();

// すべての契約者履歴APIに認証を適用
router.use(authenticate);

// Contract-specific contractor history routes
router.get('/contracts/:contract_id/contractor-histories', getContractorHistories);
router.post('/contracts/:contract_id/contractor-histories', createContractorHistory);

export default router;