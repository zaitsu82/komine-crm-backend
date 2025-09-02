import { Router } from 'express';
import { getBurials, createBurial, updateBurial, deleteBurial } from './burialController';
import { authenticate } from '../middleware/auth';

const router = Router();

// すべての埋葬情報APIに認証を適用
router.use(authenticate);

// Contract-specific burial routes
router.get('/contracts/:contract_id/burials', getBurials);
router.post('/contracts/:contract_id/burials', createBurial);

// Individual burial routes
router.put('/burials/:burial_id', updateBurial);
router.delete('/burials/:burial_id', deleteBurial);

export default router;