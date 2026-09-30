import jwt from 'jsonwebtoken';
import { getConfig } from '../config/env.js';
import { getStore } from '../models/store.js';
import { AppError } from '../utils/errors.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      throw new AppError('AUTHENTICATION_ERROR', 'Authentication is required', {
        status: 401,
        stage: 'authentication',
        recoverable: true,
      });
    }

    const config = getConfig();
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw new AppError('AUTHENTICATION_ERROR', 'The session is invalid or has expired', {
        status: 401,
        stage: 'authentication',
        recoverable: true,
      });
    }

    if (!payload?.sub || !payload?.jti) {
      throw new AppError('AUTHENTICATION_ERROR', 'The session is invalid or has expired', {
        status: 401,
        stage: 'authentication',
        recoverable: true,
      });
    }

    if (await getStore().isTokenRevoked(payload.jti)) {
      throw new AppError('AUTHENTICATION_ERROR', 'The session has ended', {
        status: 401,
        stage: 'authentication',
        recoverable: true,
      });
    }

    req.user = { sub: payload.sub, email: payload.email, name: payload.name, jti: payload.jti, exp: payload.exp };
    next();
  } catch (error) {
    next(error);
  }
}
