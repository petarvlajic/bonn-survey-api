import express, { Request, Response } from 'express';
import { User } from '../models/User';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/users/{userId}/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.get('/:userId/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Users can only view their own profile (or implement admin check)
    if (userId !== req.user!._id) {
      res.status(403).json({
        error: 'Forbidden: You can only view your own profile',
        code: 'FORBIDDEN',
      });
      return;
    }

    const user = await User.findById(userId);
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
 * /api/users/{userId}/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
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
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 */
router.put('/:userId/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, phone, avatar, position } = req.body;

    // Users can only update their own profile
    if (userId !== req.user!._id) {
      res.status(403).json({
        error: 'Forbidden: You can only update your own profile',
        code: 'FORBIDDEN',
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    // Update profile fields
    if (firstName !== undefined) user.profile.firstName = firstName;
    if (lastName !== undefined) user.profile.lastName = lastName;
    if (phone !== undefined) user.profile.phone = phone;
    if (avatar !== undefined) user.profile.avatar = avatar;
    if (position !== undefined) user.profile.position = position;

    await user.save();

    const userObj = user.toObject();
    delete (userObj as any).password;

    res.json({
      user: userObj,
    });
  } catch (error) {
    throw error;
  }
});

export default router;

