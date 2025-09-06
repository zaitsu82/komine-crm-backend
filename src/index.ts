import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './auth/authRoutes';
import contractRoutes from './contract/contractRoutes';
import mastersRoutes from './masters/mastersRoutes';
import validationRoutes from './validations/validationRoutes';
import familyContactRoutes from './family-contacts/familyContactRoutes';
import burialRoutes from './burials/burialRoutes';
import constructionRoutes from './constructions/constructionRoutes';
import contractorHistoryRoutes from './contractor-histories/contractorHistoryRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 認証ルート（認証不要）
app.use('/api/v1/auth', authRoutes);

// マスターデータルート
app.use('/api/v1/masters', mastersRoutes);

// バリデーションルート
app.use('/api/v1/validations', validationRoutes);

// 契約関連API（v1）
app.use('/api/v1/contracts', contractRoutes);

// 家族連絡先ルート
app.use('/api/v1', familyContactRoutes);

// 埋葬情報ルート
app.use('/api/v1', burialRoutes);

// 工事情報ルート
app.use('/api/v1', constructionRoutes);

// 契約者履歴ルート
app.use('/api/v1', contractorHistoryRoutes);

// サーバー起動処理
app.listen(PORT, () => {
    console.log(`Cemetery CRM Server is running on http://localhost:${PORT}`);
});
