import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './auth/authRoutes';
import mastersRoutes from './masters/mastersRoutes';
import validationRoutes from './validations/validationRoutes';
import familyContactRoutes from './family-contacts/familyContactRoutes';
import burialRoutes from './burials/burialRoutes';
import constructionRoutes from './constructions/constructionRoutes';
import gravestoneRoutes from './gravestones/gravestoneRoutes';
import applicantRoutes from './applicants/applicantRoutes';
import contractorRoutes from './contractors/contractorRoutes';
import usageFeeRoutes from './usage-fees/usageFeeRoutes';
import managementFeeRoutes from './management-fees/managementFeeRoutes';
import billingInfoRoutes from './billing-infos/billingInfoRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// 認証ルート（認証不要）
app.use('/api/v1/auth', authRoutes);

// マスターデータルート
app.use('/api/v1/masters', mastersRoutes);

// バリデーションルート
app.use('/api/v1/validations', validationRoutes);

// 墓石管理ルート
app.use('/api/v1/gravestones', gravestoneRoutes);

// 申込者管理ルート
app.use('/api/v1/applicants', applicantRoutes);

// 契約者管理ルート
app.use('/api/v1/contractors', contractorRoutes);

// 使用料管理ルート
app.use('/api/v1/usage-fees', usageFeeRoutes);

// 管理料管理ルート
app.use('/api/v1/management-fees', managementFeeRoutes);

// 請求情報管理ルート
app.use('/api/v1/billing-infos', billingInfoRoutes);

// 家族連絡先ルート
app.use('/api/v1/family-contacts', familyContactRoutes);

// 埋葬者情報ルート
app.use('/api/v1/burials', burialRoutes);

// 工事情報ルート
app.use('/api/v1/constructions', constructionRoutes);

// サーバー起動処理
app.listen(PORT, () => {
    console.log(`Cemetery CRM Server is running on http://localhost:${PORT}`);
});
