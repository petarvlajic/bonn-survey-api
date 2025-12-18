import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.endsWith('@ukbonn.de');
};

export const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({
      error: 'Missing required fields',
      code: 'MISSING_FIELDS',
      details: { required: ['email', 'password', 'firstName', 'lastName'] },
    });
    return;
  }

  if (!validateEmail(email)) {
    res.status(400).json({
      error: 'Email must end with @ukbonn.de',
      code: 'INVALID_EMAIL',
    });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({
      error: 'Password must be at least 6 characters',
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

