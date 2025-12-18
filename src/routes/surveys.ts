import express, { Request, Response } from 'express';
import { Survey } from '../models/Survey';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/surveys:
 *   get:
 *     summary: Get all surveys
 *     tags: [Surveys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, completed, archived]
 *       - in: query
 *         name: createdBy
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of surveys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 surveys:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Survey'
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, createdBy } = req.query;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (createdBy) {
      filter.createdBy = createdBy;
    } else {
      // If no createdBy specified, show user's own surveys
      filter.createdBy = req.user!._id;
    }

    const surveys = await Survey.find(filter)
      .populate('createdBy', 'email profile.firstName profile.lastName')
      .sort({ createdAt: -1 });

    res.json({
      surveys,
    });
  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/surveys/{id}:
 *   get:
 *     summary: Get survey by ID
 *     tags: [Surveys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Survey details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 survey:
 *                   $ref: '#/components/schemas/Survey'
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const survey = await Survey.findById(req.params.id)
      .populate('createdBy', 'email profile.firstName profile.lastName');

    if (!survey) {
      res.status(404).json({
        error: 'Survey not found',
        code: 'SURVEY_NOT_FOUND',
      });
      return;
    }

    res.json({
      survey,
    });
  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/surveys:
 *   post:
 *     summary: Create a new survey
 *     tags: [Surveys]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               questions:
 *                 type: array
 *               repeatableSections:
 *                 type: array
 *               settings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Survey created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 survey:
 *                   $ref: '#/components/schemas/Survey'
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { title, description, questions, repeatableSections, settings } = req.body;

    if (!title) {
      res.status(400).json({
        error: 'Title is required',
        code: 'MISSING_TITLE',
      });
      return;
    }

    const survey = new Survey({
      title,
      description,
      questions: questions || [],
      repeatableSections: repeatableSections || [],
      createdBy: req.user!._id,
      settings,
    });

    await survey.save();
    await survey.populate('createdBy', 'email profile.firstName profile.lastName');

    res.status(201).json({
      survey,
    });
  } catch (error) {
    throw error;
  }
});

// Update survey
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey) {
      res.status(404).json({
        error: 'Survey not found',
        code: 'SURVEY_NOT_FOUND',
      });
      return;
    }

    // Check if user owns the survey
    if (survey.createdBy.toString() !== req.user!._id) {
      res.status(403).json({
        error: 'Forbidden: You can only update your own surveys',
        code: 'FORBIDDEN',
      });
      return;
    }

    const { title, description, questions, repeatableSections, settings, status } = req.body;

    if (title !== undefined) survey.title = title;
    if (description !== undefined) survey.description = description;
    if (questions !== undefined) survey.questions = questions;
    if (repeatableSections !== undefined) survey.repeatableSections = repeatableSections;
    if (settings !== undefined) survey.settings = { ...survey.settings, ...settings };
    if (status !== undefined) survey.status = status;

    await survey.save();
    await survey.populate('createdBy', 'email profile.firstName profile.lastName');

    res.json({
      survey,
    });
  } catch (error) {
    throw error;
  }
});

// Delete survey
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey) {
      res.status(404).json({
        error: 'Survey not found',
        code: 'SURVEY_NOT_FOUND',
      });
      return;
    }

    // Check if user owns the survey
    if (survey.createdBy.toString() !== req.user!._id) {
      res.status(403).json({
        error: 'Forbidden: You can only delete your own surveys',
        code: 'FORBIDDEN',
      });
      return;
    }

    await Survey.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Survey deleted successfully',
    });
  } catch (error) {
    throw error;
  }
});

export default router;

