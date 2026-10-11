import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './store.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SECRET_FILE = path.resolve(__dirname, '../../data/.jwt_secret');

function getJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
    return process.env.JWT_SECRET.trim();
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      return fs.readFileSync(SECRET_FILE, 'utf-8').trim();
    }
    const dir = path.dirname(SECRET_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
    return generated;
  } catch {
    return 'fallback-runtime-secret-personalizados-angel';
  }
}

const JWT_SECRET = getJwtSecret();
export const COOKIE_NAME = 'angel_admin_session';

// Revoked token IDs in memory to invalidate sessions immediately upon logout
const revokedTokens = new Set<string>();

export interface AdminTokenPayload {
  sub: string;
  username: string;
  email: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  admin?: AdminTokenPayload;
}

export function createSessionToken(admin: { id: string; username: string; email: string }): string {
  const jti = crypto.randomUUID();
  return jwt.sign(
    {
      sub: admin.id,
      username: admin.username,
      email: admin.email,
      jti,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function revokeSessionToken(token: string): void {
  try {
    const decoded = jwt.decode(token) as AdminTokenPayload | null;
    if (decoded?.jti) {
      revokedTokens.add(decoded.jti);
    }
  } catch {
    // ignore invalid token
  }
}

export function verifySessionToken(token: string): AdminTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
    if (decoded.jti && revokedTokens.has(decoded.jti)) {
      return null;
    }
    // Verify admin still exists in DB
    const db = getDb();
    const exists = db.admins.some((a) => a.id === decoded.sub);
    if (!exists) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function extractToken(req: Request): string | null {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Debes iniciar sesión como administrador.' });
  }
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesión inválida o expirada. Por favor inicia sesión nuevamente.' });
  }
  req.admin = payload;
  next();
}
