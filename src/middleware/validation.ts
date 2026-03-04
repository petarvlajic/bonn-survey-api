import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';

const WEAK_PASSWORD_MESSAGE =
  'Password must be at least 8 characters and contain uppercase, lowercase, number and special character';

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.endsWith('@ukbonn.de');
};

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: WEAK_PASSWORD_MESSAGE };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: WEAK_PASSWORD_MESSAGE };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: WEAK_PASSWORD_MESSAGE };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: WEAK_PASSWORD_MESSAGE };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: WEAK_PASSWORD_MESSAGE };
  }
  return { valid: true };
}

export const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password || !firstName || !lastName) {
    console.log('[Auth] validateRegister – 400 Missing required fields');
    res.status(400).json({
      error: 'Missing required fields',
      code: 'MISSING_FIELDS',
      details: { required: ['email', 'password', 'firstName', 'lastName'] },
    });
    return;
  }

  if (!validateEmail(email)) {
    console.log('[Auth] validateRegister – 400 Invalid email (not @ukbonn.de):', email);
    res.status(400).json({
      error: 'Email must end with @ukbonn.de',
      code: 'INVALID_EMAIL',
    });
    return;
  }

  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    console.log('[Auth] validateRegister – 400 Weak password');
    res.status(400).json({
      error: passwordCheck.error || WEAK_PASSWORD_MESSAGE,
      code: 'WEAK_PASSWORD',
    });
    return;
  }

  next();
};

export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      error: 'Email and password are required',
      code: 'MISSING_FIELDS',
    });
    return;
  }

  next();
};

