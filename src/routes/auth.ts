import crypto from 'crypto';
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import {
  validateRegister,
  validateLogin,
  validatePasswordStrength,
  isValidEmailFormat,
  normalizeAuthEmail,
} from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { sendPasswordResetEmail } from '../utils/email';

const router = express.Router();
const RESET_TOKEN_EXPIRY_MS = 3600000; // 1 hour

function parseAdminEmailSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Any valid email when registrationAccountType is patient; staff must use @ukbonn.de (default type is staff)
 *               registrationAccountType:
 *                 type: string
 *                 enum: [patient, staff]
 *                 description: Optional; defaults to staff (SHK)
 *               password:
 *                 type: string
 *                 minLength: 6
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               avatar:
 *                 type: string
 *               position:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', validateRegister, async (req: Request, res: Response) => {
  console.log('[Auth] POST /register – request received');
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      avatar,
      position,
      examinerSignatureBase64,
    } = req.body;
    console.log('[Auth] POST /register – email:', email, 'firstName:', firstName);

    const emailNorm = normalizeAuthEmail(email);
    // Check if user already exists
    const existingUser = await User.findOne({ email: emailNorm });
    if (existingUser) {
      console.log('[Auth] POST /register – 400 User already exists:', email);
      res.status(400).json({
        error: 'User already exists',
        code: 'USER_EXISTS',
      });
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const profile: {
      firstName: string;
      lastName: string;
      phone?: string;
      avatar?: string;
      position?: string;
      examinerSignatureBase64?: string;
    } = {
      firstName,
      lastName,
      phone,
      avatar,
      position,
    };
    if (
      typeof examinerSignatureBase64 === 'string' &&
      examinerSignatureBase64.trim() &&
      examinerSignatureBase64.startsWith('data:')
    ) {
      profile.examinerSignatureBase64 = examinerSignatureBase64;
    }

    const user = new User({
      email: emailNorm,
      password: hashedPassword,
      profile,
    });

    await user.save();

    // Generate token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
    });

    // Return user without password
    const userObj = user.toObject();
    delete (userObj as any).password;

    console.log('[Auth] POST /register – 201 OK, user created:', email);
    res.status(201).json({
      user: userObj,
      token,
    });
  } catch (error: any) {
    console.warn('[Auth] POST /register – error:', error?.message || error);
    if (error.code === 11000) {
      res.status(400).json({
        error: 'Email already exists',
        code: 'DUPLICATE_EMAIL',
      });
      return;
    }
    throw error;
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', validateLogin, async (req: Request, res: Response) => {
  console.log('[Auth] POST /login – request received');
  try {
    const { email, password } = req.body;
    console.log('[Auth] POST /login – email:', email);

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log('[Auth] POST /login – 401 user not found:', email);
      res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      console.log('[Auth] POST /login – 401 invalid password:', email);
      res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    const adminEmails = parseAdminEmailSet();
    if (adminEmails.has(String(email).toLowerCase())) {
      const r = (user as { role?: string }).role;
      if (r !== 'admin') {
        user.role = 'admin';
        await user.save();
      }
    }

    console.log('[Auth] POST /login – 200 OK:', email);
    // Generate token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
    });

    // Return user without password
    const userObj = user.toObject();
    delete (userObj as any).password;

    res.json({
      user: userObj,
      token,
    });
  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent (if user exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  console.log('[Auth] POST /forgot-password – request received');
  try {
    const { email: emailRaw } = req.body;
    console.log('[Auth] POST /forgot-password – email:', emailRaw || '(missing)');

    if (!emailRaw || typeof emailRaw !== 'string') {
      res.status(400).json({
        error: 'Email is required',
        code: 'MISSING_EMAIL',
      });
      return;
    }

    const email = normalizeAuthEmail(emailRaw);
    if (!isValidEmailFormat(email)) {
      res.status(400).json({
        error: 'Invalid email address',
        code: 'INVALID_EMAIL',
      });
      return;
    }

    const user = await User.findOne({ email }).select('+passwordResetToken +passwordResetExpires');
    if (!user) {
      res.json({
        message: 'If the email exists, a password reset link has been sent',
      });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.set('passwordResetToken', token);
    user.set('passwordResetExpires', new Date(Date.now() + RESET_TOKEN_EXPIRY_MS));
    await user.save();

    const smtpReady = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
    if (!smtpReady) {
      console.warn('[Auth] POST /forgot-password – SMTP not configured');
      if (process.env.NODE_ENV === 'production') {
        res.status(503).json({
          error: 'Password reset email is not available. Contact support.',
          code: 'EMAIL_NOT_CONFIGURED',
        });
        return;
      }
    } else {
      try {
        await sendPasswordResetEmail(email, token);
        console.log('[Auth] POST /forgot-password – reset email sent to', email);
      } catch (emailErr: any) {
        console.error('[Auth] POST /forgot-password – failed to send email:', emailErr.message);
        res.status(500).json({
          error: 'Failed to send reset email. Please try again later.',
          code: 'EMAIL_SEND_FAILED',
        });
        return;
      }
    }

    const payload: { message: string; resetToken?: string; resetLink?: string } = {
      message: 'If the email exists, a password reset link has been sent',
    };
    if (!smtpReady || process.env.NODE_ENV !== 'production') {
      const scheme = (process.env.RESET_PASSWORD_APP_SCHEME || 'ukbonnsurvey').replace(/:\/\//, '');
      payload.resetLink = `${scheme}://reset-password?token=${encodeURIComponent(token)}`;
      if (!smtpReady) {
        payload.resetToken = token;
      }
    }
    res.json(payload);
  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  console.log('[Auth] POST /reset-password – request received');
  try {
    const { token, newPassword } = req.body;
    console.log('[Auth] POST /reset-password – token:', token ? 'present' : 'missing', 'newPassword:', newPassword ? 'present' : 'missing');

    if (!token || !newPassword) {
      res.status(400).json({
        error: 'Token and new password are required',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      res.status(400).json({
        error: passwordCheck.error || 'Password must be at least 8 characters and contain uppercase, lowercase, number and special character',
        code: 'WEAK_PASSWORD',
      });
      return;
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    })
      .select('+password +passwordResetToken +passwordResetExpires');

    if (!user) {
      res.status(400).json({
        error: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    const hashedPassword = await hashPassword(newPassword);
    await User.updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword },
        $unset: { passwordResetToken: 1, passwordResetExpires: 1 },
      }
    );

    res.json({
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  // In a stateless JWT system, logout is handled client-side
  // If you need server-side logout, implement token blacklisting
  res.json({
    message: 'Logged out successfully',
  });
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    const userObj = user.toObject();
    delete (userObj as any).password;

    res.json({
      user: userObj,
    });
  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update current user's profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Must end with @ukbonn.de if provided
 *               phone:
 *                 type: string
 *               position:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                 token:
 *                   type: string
 *                   description: Updated token (optional, only if email changed)
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, position, examinerSignatureBase64 } = req.body;

    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    let token: string | undefined;
    let emailChanged = false;

    // Update email if provided and different
    if (email && email !== user.email) {
      if (!isValidEmailFormat(email)) {
        res.status(400).json({
          error: 'Invalid email address',
          code: 'INVALID_EMAIL',
        });
        return;
      }

      // Check if email is already taken
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        res.status(400).json({
          error: 'Email already exists',
          code: 'DUPLICATE_EMAIL',
        });
        return;
      }

      user.email = email;
      emailChanged = true;
    }

    // Update profile fields
    // Ensure profile object exists
    if (!user.profile) {
      user.profile = {
        firstName: '',
        lastName: '',
      };
    }

    // Update profile fields - handle empty strings properly
    if (firstName !== undefined) {
      user.set('profile.firstName', firstName);
    }
    if (lastName !== undefined) {
      user.set('profile.lastName', lastName);
    }
    if (phone !== undefined) {
      // Allow empty string to clear the field
      user.set('profile.phone', phone === '' ? undefined : phone);
    }
    if (position !== undefined) {
      // Allow empty string to clear the field, otherwise set the value
      user.set('profile.position', position === '' ? undefined : position);
    }
    if (examinerSignatureBase64 !== undefined) {
      if (
        examinerSignatureBase64 !== null &&
        typeof examinerSignatureBase64 === 'string' &&
        examinerSignatureBase64.trim() &&
        !examinerSignatureBase64.startsWith('data:')
      ) {
        res.status(400).json({
          error: 'examinerSignatureBase64 must be a data:image/... payload',
          code: 'INVALID_SIGNATURE_FORMAT',
        });
        return;
      }
      user.set(
        'profile.examinerSignatureBase64',
        examinerSignatureBase64 === '' || examinerSignatureBase64 === null
          ? undefined
          : examinerSignatureBase64
      );
    }

    await user.save();

    // Generate new token if email changed
    if (emailChanged) {
      token = generateToken({
        userId: user._id.toString(),
        email: user.email,
      });
    }

    // Reload user to get fresh data after save
    const updatedUser = await User.findById(user._id);
    if (!updatedUser) {
      res.status(404).json({
        error: 'User not found after update',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    const userObj = updatedUser.toObject() as any;
    delete userObj.password;

    // Format response to match frontend expectations
    const response: any = {
      user: {
        id: userObj._id.toString(),
        firstName: (userObj.profile && userObj.profile.firstName) || '',
        lastName: (userObj.profile && userObj.profile.lastName) || '',
        email: userObj.email,
        phone: (userObj.profile && userObj.profile.phone) || '',
        position: (userObj.profile && userObj.profile.position) || '',
        role: userObj.role === 'admin' ? 'admin' : 'user',
      },
    };

    // Only include token if it was regenerated
    if (token) {
      response.token = token;
    }

    res.json(response);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        error: 'Email already exists',
        code: 'DUPLICATE_EMAIL',
      });
      return;
    }
    throw error;
  }
});

router.get('/admin/users', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  const users = await User.find({}, 'email profile role createdAt')
    .sort({ createdAt: -1 })
    .lean();
  res.json({
    users: users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      firstName: u.profile?.firstName,
      lastName: u.profile?.lastName,
      role: u.role === 'admin' ? 'admin' : 'user',
      createdAt: u.createdAt,
    })),
  });
});

router.patch(
  '/admin/users/:userId/role',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { role } = req.body ?? {};
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: 'Invalid user id', code: 'INVALID_ID' });
      return;
    }
    if (role !== 'user' && role !== 'admin') {
      res.status(400).json({ error: 'role must be user or admin', code: 'INVALID_ROLE' });
      return;
    }
    if (userId === req.user!._id && role === 'user') {
      res.status(400).json({ error: 'Cannot demote yourself', code: 'SELF_DEMOTE' });
      return;
    }
    const target = await User.findById(userId);
    if (!target) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }
    target.role = role;
    await target.save();
    res.json({
      message: 'Role updated',
      user: {
        id: target._id.toString(),
        email: target.email,
        role: target.role,
      },
    });
  },
);

export default router;

