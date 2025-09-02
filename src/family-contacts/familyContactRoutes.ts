import { Router } from 'express';
import { getFamilyContacts, createFamilyContact, updateFamilyContact, deleteFamilyContact } from './familyContactController';
import { authenticate } from '../middleware/auth';

const router = Router();

// すべての家族連絡先APIに認証を適用
router.use(authenticate);

// Contract-specific family contact routes
router.get('/contracts/:contract_id/family-contacts', getFamilyContacts);
router.post('/contracts/:contract_id/family-contacts', createFamilyContact);

// Individual family contact routes
router.put('/family-contacts/:contact_id', updateFamilyContact);
router.delete('/family-contacts/:contact_id', deleteFamilyContact);

export default router;