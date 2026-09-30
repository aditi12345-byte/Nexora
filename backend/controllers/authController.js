import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config/env.js';
import { getStore } from '../models/store.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { loginSchema, parseBody, registerSchema } from '../validators/authValidators.js';

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export async function register(req, res, next) {
  try {
    const input = parseBody(registerSchema, req.body);
    const email = input.email.toLowerCase();
    const store = getStore();
    const existing = await store.findUserByEmail(email);
    if (existing) {
      throw new AppError('AUTHENTICATION_ERROR', 'An account with this email already exists', {
        status: 409,
        stage: 'authentication',
        recoverable: true,
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await store.createUser({
      id: crypto.randomUUID(),
      email,
      name: input.name,
      passwordHash,
      createdAt: new Date().toISOString(),
    });
    if (!user) {
      throw new AppError('AUTHENTICATION_ERROR', 'An account with this email already exists', {
        status: 409,
        stage: 'authentication',
        recoverable: true,
      });
    }

    sendSuccess(res, { user: publicUser(user) }, 'Registration completed successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const input = parseBody(loginSchema, req.body);
    const user = await getStore().findUserByEmail(input.email.toLowerCase());
    const matches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !matches) {
      throw new AppError('AUTHENTICATION_ERROR', 'Invalid email or password', {
        status: 401,
        stage: 'authentication',
        recoverable: true,
      });
    }

    const config = getConfig();
    const token = jwt.sign(
      { email: user.email, name: user.name },
      config.jwtSecret,
      { subject: user.id, expiresIn: config.jwtExpiresIn, jwtid: crypto.randomUUID() },
    );

    sendSuccess(res, { token, user: publicUser(user) }, 'Login completed successfully');
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const expiresAt = new Date((req.user.exp || 0) * 1000).toISOString();
    await getStore().revokeToken(req.user.jti, expiresAt);
    sendSuccess(res, {}, 'Logout completed successfully');
  } catch (error) {
    next(error);
  }
}
