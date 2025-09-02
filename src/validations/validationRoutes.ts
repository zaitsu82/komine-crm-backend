import { Router } from 'express';
import { checkContractNumber, validateContractData } from './validationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// すべてのバリデーションAPIに認証を適用
router.use(authenticate);

router.get('/contract-number', checkContractNumber);
router.post('/contract', validateContractData);

export default router;