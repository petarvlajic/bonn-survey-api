import express, { Request, Response } from 'express';
import { Draft } from '../models/Draft';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Get all drafts
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { surveyId, userId } = req.query;
    const filter: any = {};

    if (surveyId) {
      filter.surveyId = surveyId;
    }

    if (userId) {
      filter.userId = userId;
    } else {
      // If no userId specified, show user's own drafts
      filter.userId = req.user!._id;
    }

    const drafts = await Draft.find(filter)
      .populate('surveyId', 'title')
      .populate('userId', 'email profile.firstName profile.lastName')
      .sort({ updatedAt: -1 });

    res.json({
      drafts,
    });
  } catch (error) {
    throw error;
  }
});

// Get draft by ID
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const draft = await Draft.findById(req.params.id)
      .populate('surveyId', 'title description')
      .populate('userId', 'email profile.firstName profile.lastName');

    if (!draft) {
      res.status(404).json({
        error: 'Draft not found',
        code: 'DRAFT_NOT_FOUND',
      });
      return;
    }

    // Check if user owns the draft
    if (draft.userId.toString() !== req.user!._id) {
      res.status(403).json({
        error: 'Forbidden: You can only view your own drafts',
        code: 'FORBIDDEN',
      });
      return;
    }

    res.json({
      draft,
    });
  } catch (error) {
    throw error;
  }
});

// Create draft
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { surveyId, data, responseId } = req.body;

    if (!surveyId) {
      res.status(400).json({
        error: 'Survey ID is required',
        code: 'MISSING_SURVEY_ID',
      });
      return;
    }

    const draft = new Draft({
      surveyId,
      userId: req.user!._id,
      data: data || {},
      responseId,
    });

    await draft.save();
    await draft.populate('surveyId', 'title');
    await draft.populate('userId', 'email profile.firstName profile.lastName');

    res.status(201).json({
      draft,
    });
  } catch (error) {
    throw error;
  }
});

// Update draft
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const draft = await Draft.findById(req.params.id);

    if (!draft) {
      res.status(404).json({
        error: 'Draft not found',
        code: 'DRAFT_NOT_FOUND',
      });
      return;
    }

    // Check if user owns the draft
    if (draft.userId.toString() !== req.user!._id) {
      res.status(403).json({
        error: 'Forbidden: You can only update your own drafts',
        code: 'FORBIDDEN',
      });
      return;
    }

    const { data } = req.body;

    if (data !== undefined) {
      draft.data = { ...draft.data, ...data };
    }

    await draft.save();
    await draft.populate('surveyId', 'title');
    await draft.populate('userId', 'email profile.firstName profile.lastName');

    res.json({
      draft,
    });
  } catch (error) {
    throw error;
  }
});

// Delete draft
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const draft = await Draft.findById(req.params.id);

    if (!draft) {
      res.status(404).json({
        error: 'Draft not found',
        code: 'DRAFT_NOT_FOUND',
      });
      return;
    }

    // Check if user owns the draft
    if (draft.userId.toString() !== req.user!._id) {
      res.status(403).json({
        error: 'Forbidden: You can only delete your own drafts',
        code: 'FORBIDDEN',
      });
      return;
    }

    await Draft.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Draft deleted successfully',
    });
  } catch (error) {
    throw error;
  }
});

export default router;

