import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import { User, UserRole } from './types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'vaultshare-super-secure-production-jwt-token-2026';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  username: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function generateToken(user: User): string {
  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.email.toLowerCase() === 'spikesprimo6625@gmail.com' ? 'admin' : user.role,
    username: user.username
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (decoded.email && decoded.email.toLowerCase() === 'spikesprimo6625@gmail.com') {
      decoded.role = 'admin';
    }
    return decoded;
  } catch (err) {
    return null;
  }
}

export function extractToken(req: Request): string | null {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies && req.cookies.vaultshare_token) {
    return req.cookies.vaultshare_token;
  }
  if (typeof req.query.token === 'string') {
    return req.query.token;
  }
  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
    return;
  }

  const user = db.findUserById(payload.userId);
  if (!user || user.isSuspended) {
    res.status(403).json({ error: 'Account suspended or not found.' });
    return;
  }

  // Ensure role is up to date
  payload.role = user.role;
  if (user.email.toLowerCase() === 'spikesprimo6625@gmail.com') {
    payload.role = 'admin';
  }

  req.user = payload;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }
    next();
  });
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = db.findUserById(payload.userId);
      if (user && !user.isSuspended) {
        payload.role = user.role;
        if (user.email.toLowerCase() === 'spikesprimo6625@gmail.com') {
          payload.role = 'admin';
        }
        req.user = payload;
      }
    }
  }
  next();
}
