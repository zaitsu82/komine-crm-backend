import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'secret_key';

// トークン生成
export function generateToken(payload: object) {
    return jwt.sign(payload, SECRET, { expiresIn: '1d' });
}

// トークン検証
export function verifyToken(token: string) {
    return jwt.verify(token, SECRET);
}
