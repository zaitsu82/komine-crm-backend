import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import customerRoutes from './customer/customerRoutes';
import authRoutes from './auth/authRoutes';
import userRoutes from './user/userRoutes';
import contractRoutes from './contract/contractRoutes';
import invoiceRoutes from './invoice/invoiceRoutes';
import inquiryRoutes from './inquiry/inquiryRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 認証ルート
app.use('/api/auth', authRoutes);

// 顧客ルート
app.use('/api/customers', customerRoutes);

// ユーザールート
app.use('/api/users', userRoutes);

// 契約ルート
app.use('/api/contracts', contractRoutes);

// 問い合わせルート
app.use('/api/inquiries', inquiryRoutes);

// 請求ルート
app.use('/api/invoices', invoiceRoutes);

// サーバー起動処理
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
