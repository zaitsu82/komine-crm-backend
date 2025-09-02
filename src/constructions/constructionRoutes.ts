import { Router } from 'express';
import { getConstructions, createConstruction, updateConstruction, deleteConstruction } from './constructionController';
import { authenticate } from '../middleware/auth';

const router = Router();

// すべての工事情報APIに認証を適用
router.use(authenticate);

// Contract-specific construction routes
router.get('/contracts/:contract_id/constructions', getConstructions);
router.post('/contracts/:contract_id/constructions', createConstruction);

// Individual construction routes
router.put('/constructions/:construction_id', updateConstruction);
router.delete('/constructions/:construction_id', deleteConstruction);

export default router;