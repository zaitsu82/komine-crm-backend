import { Router } from 'express';
import { getStaff, getPaymentMethods, getGraveTypes, getReligiousSects } from './mastersController';
import { authenticate } from '../middleware/auth';

const router = Router();

// すべてのマスターデータAPIに認証を適用
router.use(authenticate);

router.get('/staff', getStaff);
router.get('/payment-methods', getPaymentMethods);
router.get('/grave-types', getGraveTypes);
router.get('/religious-sects', getReligiousSects);

export default router;