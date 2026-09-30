import { z } from 'zod';
import { AppError } from '../utils/errors.js';

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
});

export function parseBody(schema, body) {
  const parsed = schema.safeParse(body || {});
  if (!parsed.success) {
    throw new AppError('AUTHENTICATION_ERROR', 'Check the submitted fields', {
      status: 400,
      stage: 'authentication',
      recoverable: true,
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}
