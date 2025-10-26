import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import plotRoutes from './plots/plotRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// 区画情報ルート
app.use('/api/v1/plots', plotRoutes);

// サーバー起動処理
app.listen(PORT, () => {
  console.log(`Cemetery CRM Server is running on http://localhost:${PORT}`);
});
